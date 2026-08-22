import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url));

const RELEASE_FILES = [
  'LICENSE',
  'background.js',
  'client/files.js',
  'client/state.js',
  'client/store.js',
  'client/ui.js',
  'icon_128-active.png',
  'icon_128.png',
  'manifest.json',
  'popup.html',
  'popup.js',
];
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseVersion(value) {
  if (!VERSION_PATTERN.test(value ?? '')) {
    throw new Error(`Expected a Chrome version in X.Y.Z format, got: ${value ?? '<missing>'}`);
  }

  const parts = value.split('.').map(Number);
  if (parts.every((part) => part === 0)) {
    throw new Error('Chrome does not allow version 0.0.0');
  }
  if (parts.some((part) => part > 65_535)) {
    throw new Error(`Chrome version components must not exceed 65535: ${value}`);
  }

  return value;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8'));
}

function writeJson(path, value) {
  const absolutePath = resolve(REPOSITORY_ROOT, path);
  const source = readFileSync(absolutePath, 'utf8');
  const indent = source.match(/\n([ \t]+)"/)?.[1] ?? '  ';
  writeFileSync(absolutePath, `${JSON.stringify(value, null, indent)}\n`);
}

function git(args, options = {}) {
  return execFileSync('git', ['-C', REPOSITORY_ROOT, ...args], options);
}

function getVersions(read = readJson) {
  const manifest = read('manifest.json');
  const packageJson = read('package.json');
  const packageLock = read('package-lock.json');

  return {
    lock: packageLock.version,
    lockRoot: packageLock.packages?.['']?.version,
    manifest: manifest.version,
    package: packageJson.version,
  };
}

function checkVersions(expectedVersion, read) {
  const versions = getVersions(read);
  const uniqueVersions = new Set(Object.values(versions));

  if (uniqueVersions.size !== 1) {
    throw new Error(`Release versions differ: ${JSON.stringify(versions)}`);
  }

  const version = parseVersion(versions.manifest);
  if (expectedVersion !== undefined && version !== parseVersion(expectedVersion)) {
    throw new Error(`Expected version ${expectedVersion}, found ${version}`);
  }

  return version;
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left).split('.').map(Number);
  const rightParts = parseVersion(right).split('.').map(Number);

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }

  return 0;
}

function prepareVersion(version) {
  parseVersion(version);
  assertTrackedTreeIsClean();

  const currentVersion = checkVersions();
  if (compareVersions(version, currentVersion) <= 0) {
    throw new Error(`Release version ${version} must be newer than ${currentVersion}`);
  }

  const manifest = readJson('manifest.json');
  const packageJson = readJson('package.json');
  const packageLock = readJson('package-lock.json');

  if (!packageLock.packages?.['']) {
    throw new Error('package-lock.json does not contain the root package');
  }

  manifest.version = version;
  packageJson.version = version;
  packageLock.version = version;
  packageLock.packages[''].version = version;

  writeJson('manifest.json', manifest);
  writeJson('package.json', packageJson);
  writeJson('package-lock.json', packageLock);
  checkVersions(version);

  console.log(`Prepared release ${version}`);
}

function assertTrackedTreeIsClean() {
  const status = git(
    ['status', '--porcelain', '--untracked-files=no'],
    { encoding: 'utf8' },
  ).trim();

  if (status) {
    throw new Error('Tracked files must be clean before running this command');
  }
}

function packageRelease(expectedVersion) {
  assertTrackedTreeIsClean();

  const commit = git(['rev-parse', 'HEAD^{commit}'], { encoding: 'utf8' }).trim();
  const readFromCommit = (path) => JSON.parse(git(
    ['show', `${commit}:${path}`],
    { encoding: 'utf8' },
  ));
  const version = checkVersions(expectedVersion, readFromCommit);

  const treeEntries = git(
    ['ls-tree', '-z', commit, '--', ...RELEASE_FILES],
    { encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const [metadata, path] = entry.split('\t');
      const [mode, type] = metadata.split(' ');
      return { mode, path, type };
    });
  const regularFiles = treeEntries
    .filter(({ mode, type }) => type === 'blob' && /^100(644|755)$/.test(mode))
    .map(({ path }) => path)
    .sort();

  if (JSON.stringify(regularFiles) !== JSON.stringify([...RELEASE_FILES].sort())) {
    throw new Error('Release allowlist contains a missing or non-regular file');
  }

  const artifactsDirectory = resolve(REPOSITORY_ROOT, 'artifacts');
  const extensionDirectory = resolve(artifactsDirectory, 'extension');
  const zipPath = resolve(artifactsDirectory, `header-craft-v${version}.zip`);
  const checksumPath = `${zipPath}.sha256`;

  mkdirSync(artifactsDirectory, { recursive: true });
  rmSync(extensionDirectory, { force: true, recursive: true });
  rmSync(zipPath, { force: true });
  rmSync(checksumPath, { force: true });

  git([
    'archive',
    '--format=zip',
    `--output=${zipPath}`,
    commit,
    '--',
    ...RELEASE_FILES,
  ]);

  mkdirSync(extensionDirectory, { recursive: true });
  execFileSync('unzip', ['-q', zipPath, '-d', extensionDirectory]);

  const packagedFiles = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((path) => path && !path.endsWith('/'))
    .sort();
  const expectedFiles = [...RELEASE_FILES].sort();

  if (JSON.stringify(packagedFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Unexpected ZIP contents: ${JSON.stringify(packagedFiles)}`);
  }

  const packagedManifest = readJson(resolve(extensionDirectory, 'manifest.json'));
  if (packagedManifest.version !== version) {
    throw new Error(`Packaged manifest version is ${packagedManifest.version}, expected ${version}`);
  }

  const checksum = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
  writeFileSync(checksumPath, `${checksum}  ${basename(zipPath)}\n`);

  console.log(`Commit ${commit}`);
  console.log(`Created ${zipPath}`);
  console.log(`SHA-256 ${checksum}`);
}

const [command, argument, ...extraArguments] = process.argv.slice(2);

try {
  if (extraArguments.length > 0) {
    throw new Error('Too many arguments');
  }

  switch (command) {
    case 'prepare':
      prepareVersion(argument);
      break;
    case 'check':
      console.log(`Release version ${checkVersions(argument)} is consistent`);
      break;
    case 'package':
      packageRelease(argument);
      break;
    default:
      throw new Error('Usage: release.mjs <prepare|check|package> [X.Y.Z]');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
