import fs from 'fs';
import prompts from 'prompts';
import minimist from 'minimist';

const manifestSrcPath = './src/manifest.json';
const manifestDistPath = './dist/manifest.json';

function loadManifest(path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

function saveManifest(manifest, path) {
  fs.writeFileSync(path, JSON.stringify(manifest, null, 4));
}

function validateVersion(version) {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!versionRegex.test(version)) {
    throw new Error(
      `Invalid version format: "${version}". Expected format is "X.Y.Z", where X, Y, and Z are integers.`
    );
  }
}

function incrementVersion(version, partIndex) {
  const parts = version.split('.').map(Number);
  parts[partIndex]++;
  for (let i = partIndex + 1; i < parts.length; i++) {
    parts[i] = 0;
  }
  return parts.join('.');
}

async function promptForVersionPart() {
  const response = await prompts({
    type: 'select',
    name: 'part',
    message: 'Which part of the version to increment?',
    choices: [
      { title: 'Major', value },
      { title: 'Minor', value },
      { title: 'Patch', value },
    ],
  });

  if (response.part === undefined) {
    throw new Error('No version part selected.');
  }

  return response.part;
}

async function getNewVersion(currentVersion) {
  const args = minimist(process.argv.slice(2));
  const cliVersion = args.version;
  const cliPart = args.part;

  if (cliVersion) {
    validateVersion(cliVersion);
    return cliVersion;
  }
  
  if (cliPart) {
    const validParts = ['major', 'minor', 'patch'];

    const partIndex = validParts.indexOf(cliPart.toLowerCase());
    if (partIndex === -1) {
      throw new Error(
        `Invalid argument for --part: "${cliPart}". Please use "major", "minor", or "patch".`
      );
    }

    return incrementVersion(currentVersion, partIndex);
  }

  const partIndex = await promptForVersionPart();
  return incrementVersion(manifest.version, partIndex);
}

const manifest = loadManifest(manifestSrcPath);

manifest.version = await getNewVersion(manifest.version);
saveManifest(manifest, manifestDistPath);

console.log(`Version set to ${manifest.version}`);
