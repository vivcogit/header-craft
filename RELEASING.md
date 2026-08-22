# Releasing Header Craft

Header Craft is shipped directly from its JavaScript, HTML, and image files. The release workflow archives an explicit runtime allowlist, tests the unpacked archive in Chromium, and publishes the ZIP and its SHA-256 checksum as a GitHub Release. Chrome Web Store upload and production publication remain manual.

## One-time setup

Before the first automated release:

1. Configure the `main` ruleset to require pull requests and the exact `Tests / test` check from GitHub Actions, and disallow force-pushes, deletion, and broad bypasses.
2. Configure a `v*` tag ruleset that names the release maintainer as the allowed creation actor and disallows updates and deletion.
3. Enable immutable releases in the repository settings.
4. In the Chrome Web Store Developer Dashboard:
   - use `https://github.com/vivcogit/header-craft/blob/main/policy.md` as the privacy-policy URL;
   - declare **User-generated content** and **Authentication information**, purpose **App functionality**, certify that the extension contains no remote code, and complete the Limited Use certifications;
   - add the disclosure below prominently to the Store description;
   - for every submission, disable automatic publication or select **Defer publish**, then verify that an approved revision is staged;
   - check Verified CRX Uploads: if it is enabled, stop and adapt this flow to signed CRX instead of disabling that protection; if it is disabled, record the conscious deferral.

Use this Store description disclosure:

> Header Craft stores the header profiles you create—including header names, values, and comments—using Chrome Sync. When a row is enabled, its name and value are added to requests from that tab, including third-party subresources. Extension storage is not encrypted; do not enter passwords, cookies, API keys, or tokens.

## Prepare a release

The release-flow change itself already prepares version `1.0.0`. For later versions, start from a clean, up-to-date `main` branch with Node 24 active:

```bash
nvm use
npm ci
npm run release:prepare -- 1.0.1
npm test
```

`release:prepare` updates `manifest.json`, `package.json`, and both root version fields in `package-lock.json`. It rejects malformed, unchanged, and lower versions. Review those changes in a pull request and merge only after CI passes.

## Create the release

After the release pull request is merged, create the immutable version tag. Use `1.0.0` for the first run of this flow:

```bash
git switch main
git pull --ff-only
git tag v1.0.0
git push origin v1.0.0
```

The `Release` workflow verifies that the tag version matches the committed version and that the tagged commit belongs to `main`. It then runs unit tests, creates the ZIP once, runs Chromium E2E against the unpacked ZIP, verifies its contents, and creates a GitHub Release containing:

```text
header-craft-v1.0.0.zip
header-craft-v1.0.0.zip.sha256
```

Do not rebuild the extension after this point.

## Publish to Chrome Web Store

1. Confirm that the GitHub Release is published and marked **Immutable**, and that its only attached assets are the ZIP and checksum.
2. Download both attached assets and verify the checksum on macOS:

   ```bash
   shasum -a 256 -c header-craft-v1.0.0.zip.sha256
   ```

3. Upload that exact ZIP to the existing Header Craft item in the Chrome Web Store Developer Dashboard.
4. Submit it for review with deferred publishing enabled.
5. After approval, manually publish the staged version.
6. Confirm that the store and an updated browser installation report the expected version.

## Failed release and rollback

Never move or reuse a release tag, version, or GitHub Release. If review fails or a production rollback is needed, release the corrected or previously working code under a new, higher patch version. Keep stored data backward-compatible across releases.
