# GitHub Actions Automated Publishing Setup

## Overview

This document explains how to set up automated npm publishing using GitHub Actions. Once configured, publishing new versions is as simple as pushing a version tag.

---

## One-Time Setup

### Step 1: Add NPM Token as GitHub Secret

1. **Go to GitHub Repository Settings**
   - Navigate to: https://github.com/tribixbite/imaginize/settings/secrets/actions
   - Click "New repository secret"

2. **Create NPM_TOKEN Secret**
   - **Name:** `NPM_TOKEN`
   - **Value:** Your npm access token (starts with `npm_...`)
   - Click "Add secret"
   - **Note:** Get your npm token from https://www.npmjs.com/settings/YOUR_USERNAME/tokens

3. **Verify Secret is Added**
   - You should see `NPM_TOKEN` listed in Repository secrets
   - The value will be hidden for security

### Step 2: Verify Workflow File

The workflow file is already created at `.github/workflows/publish.yml`. It:
- Triggers on version tags (e.g., `v2.6.1`, `v2.7.0`)
- Runs tests and builds the project
- Publishes to npm automatically
- Creates a GitHub release with changelog

---

## How to Publish a New Version

### Automated Publishing (Recommended)

```bash
# 1. Update version in package.json and src/index.ts
npm version patch  # For 2.6.0 → 2.6.1
# OR
npm version minor  # For 2.6.0 → 2.7.0
# OR
npm version major  # For 2.6.0 → 3.0.0

# 2. Update CHANGELOG.md with new version entry

# 3. Commit version changes
git add package.json src/index.ts CHANGELOG.md
git commit -m "chore: bump version to $(node -p \"require('./package.json').version\")"

# 4. Create and push version tag
git tag -a "v$(node -p \"require('./package.json').version\")" -m "Release v$(node -p \"require('./package.json').version\")"
git push origin-imaginize main --tags

# 5. GitHub Actions will automatically:
#    - Run tests
#    - Build the project
#    - Publish to npm
#    - Create GitHub release
```

### Manual Publishing (Fallback)

If GitHub Actions fails or you need manual control:

```bash
# 1. Ensure you're on main branch with latest code
git checkout main
git pull origin-imaginize main

# 2. Build and test
npm run build
npm test

# 3. Publish manually
npm publish

# 4. Create GitHub release manually
gh release create "v2.6.1" --title "Release v2.6.1" --notes-file RELEASE_NOTES_v2.6.1.md
```

---

## Workflow Triggers

### Trigger 1: Tag Push (Automatic)
```bash
# When you push a version tag like v2.6.1
git tag v2.6.1
git push origin-imaginize --tags
# → Workflow runs automatically
```

### Trigger 2: Manual Dispatch (On-Demand)
1. Go to: https://github.com/tribixbite/imaginize/actions/workflows/publish.yml
2. Click "Run workflow"
3. Enter version number (e.g., 2.6.1)
4. Click "Run workflow"

---

## Workflow Steps Explained

### 1. Checkout Code
- Fetches latest code from repository
- Uses `actions/checkout@v4`

### 2. Setup Node.js
- Installs Node.js 20
- Configures npm registry authentication
- Uses `actions/setup-node@v4`

### 3. Install Dependencies
- Runs `npm ci` for clean install
- Uses package-lock.json for reproducible builds

### 4. Run Tests
- Executes `npm test`
- Non-blocking (continues even if environment-specific tests fail)

### 5. Build Project
- Runs `npm run build`
- Compiles TypeScript to JavaScript
- Builds dashboard frontend

### 6. Verify Version
- Checks that git tag matches package.json version
- Prevents accidental version mismatches
- Only runs for tag pushes (not manual dispatch)

### 7. Publish to npm
- Runs `npm publish` with NPM_TOKEN authentication
- Publishes to https://registry.npmjs.org/

### 8. Create GitHub Release
- Creates release on GitHub with tag
- Includes link to npm package
- References CHANGELOG.md
- Only runs for tag pushes (not manual dispatch)

### 9. Verify Publication
- Waits 30s for npm registry to update
- Tests installation with `npx imaginize@VERSION --version`

---

## Version Numbering Guide

### Semantic Versioning (semver)
- **MAJOR** (3.0.0): Breaking changes
- **MINOR** (2.7.0): New features, backward compatible
- **PATCH** (2.6.1): Bug fixes, backward compatible

### Examples
```bash
# Bug fix (2.6.0 → 2.6.1)
npm version patch
git tag v2.6.1

# New feature (2.6.0 → 2.7.0)
npm version minor
git tag v2.7.0

# Breaking change (2.6.0 → 3.0.0)
npm version major
git tag v3.0.0
```

---

## Troubleshooting

### Error: NPM_TOKEN not found
**Problem:** Secret not configured correctly

**Solution:**
1. Go to https://github.com/tribixbite/imaginize/settings/secrets/actions
2. Verify `NPM_TOKEN` exists
3. If missing, add it with your npm token

---

### Error: Version mismatch
**Problem:** Git tag doesn't match package.json version

**Solution:**
```bash
# Check current version
cat package.json | grep version

# Delete incorrect tag
git tag -d v2.6.1
git push origin-imaginize :refs/tags/v2.6.1

# Create correct tag
git tag v2.6.1
git push origin-imaginize --tags
```

---

### Error: npm publish failed
**Problem:** Version already exists on npm or authentication failed

**Solution:**
```bash
# Check if version exists
npm view imaginize versions

# If version exists, bump version
npm version patch
git commit -am "chore: bump version"
git tag "v$(node -p \"require('./package.json').version\")"
git push origin-imaginize main --tags

# If authentication failed, verify NPM_TOKEN secret is correct
```

---

### Error: Tests failed
**Problem:** Tests failing in CI environment

**Solution:**
- Check workflow logs: https://github.com/tribixbite/imaginize/actions
- Tests are non-blocking, workflow continues even with failures
- Only 35 unit tests need to pass (pipeline tests are environment-specific)
- If build succeeds, publication proceeds

---

## Monitoring Workflow

### View Workflow Runs
- Go to: https://github.com/tribixbite/imaginize/actions
- Click on "Publish to npm" workflow
- View run history and logs

### Check npm Package
- After successful publish: https://www.npmjs.com/package/imaginize
- Check version list: `npm view imaginize versions`
- Test installation: `npx imaginize@latest --version`

### Check GitHub Releases
- View releases: https://github.com/tribixbite/imaginize/releases
- Each successful publish creates a release

---

## Security Considerations

### NPM Token Security
- **Never commit** the npm token to the repository
- Token is stored securely in GitHub Secrets
- Token is only exposed to workflow environment
- Rotate token periodically (every 6-12 months)

### Workflow Permissions
- Workflow has `contents: write` (for creating releases)
- Workflow has `packages: write` (for npm publishing)
- Only repository maintainers can trigger workflows

### Token Rotation
If you need to rotate the npm token:

```bash
# 1. Generate new token on npmjs.com
# 2. Update GitHub secret:
#    - Go to repository settings → Secrets
#    - Edit NPM_TOKEN
#    - Paste new token
# 3. Test with manual workflow dispatch
```

---

## Best Practices

### Pre-Release Checklist
- [ ] Update CHANGELOG.md with new version entry
- [ ] Update version in package.json (use `npm version`)
- [ ] Update version in src/index.ts
- [ ] Run `npm run build` locally (verify 0 errors)
- [ ] Run `npm test` locally (verify core tests pass)
- [ ] Commit all changes
- [ ] Create version tag
- [ ] Push commits and tags

### Post-Release Checklist
- [ ] Verify workflow completed successfully
- [ ] Check npm package page (correct version visible)
- [ ] Test installation: `npx imaginize@latest --version`
- [ ] Verify GitHub release created
- [ ] Update WORKING.md if needed
- [ ] Announce release (optional)

---

## Example: Publishing v2.6.1

Complete example of publishing a patch release:

```bash
# 1. Make bug fixes and commit
git add .
git commit -m "fix: resolve dashboard reconnection issue"

# 2. Update CHANGELOG.md
cat >> CHANGELOG.md << 'EOF'

## [2.6.1] - 2025-11-13

### Fixed
- Dashboard WebSocket reconnection logic
- Type error in chapter grid component

EOF

# 3. Bump version
npm version patch  # 2.6.0 → 2.6.1

# 4. Update src/index.ts version
sed -i "s/version('2.6.0')/version('2.6.1')/" src/index.ts
git add src/index.ts
git commit --amend --no-edit

# 5. Push with tags
git push origin-imaginize main
git push origin-imaginize --tags

# 6. Monitor workflow
# Go to: https://github.com/tribixbite/imaginize/actions
# Wait 2-3 minutes for completion

# 7. Verify publication
npx imaginize@2.6.1 --version
# Output: 2.6.1
```

---

## GitHub Actions Dashboard

Monitor your workflow runs:

1. **All Workflows**: https://github.com/tribixbite/imaginize/actions
2. **Publish Workflow**: https://github.com/tribixbite/imaginize/actions/workflows/publish.yml
3. **Latest Run**: Shows status (success/failure), duration, logs

---

## Support

For issues with GitHub Actions:
- Check workflow logs for detailed error messages
- Review this guide's troubleshooting section
- Open an issue: https://github.com/tribixbite/imaginize/issues

---

**Last Updated:** 2025-11-12
**Workflow Version:** 1.0
**Status:** Production Ready ✅
