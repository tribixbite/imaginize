# npm Publishing Specification

Automated package publishing and release management for imaginize.

## Overview

imaginize uses automated npm publishing with:
- **GitHub Actions** - Automated publish on successful CI
- **Semantic Versioning** - Version bumping based on commit types
- **Changelog Generation** - Auto-generated from conventional commits
- **Quality Gates** - Tests + type checks + linting before publish
- **Registry**: npm (https://www.npmjs.com/package/imaginize)

---

## Publishing Workflow

### Manual Publishing

**Prerequisites**:
1. npm account with publish access
2. Logged in: `npm login`
3. All tests passing: `npm test`
4. Build successful: `npm run build`

**Steps**:
```bash
# 1. Ensure clean working directory
git status
# Should show: working tree clean

# 2. Run full test suite
npm test

# 3. Run quality checks
npm run typecheck
npm run lint
npm run format:check

# 4. Build project
npm run build

# 5. Bump version
npm version patch  # or minor or major

# 6. Publish to npm
npm publish

# 7. Push version tag
git push origin main --tags
```

### Automated Publishing

**Trigger**: Push to `main` branch

**GitHub Actions Workflow** (`.github/workflows/publish.yml`):
```yaml
name: Publish to npm

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      
      - run: npm ci
      - run: npm test
      - run: npm run build
      
      - run: npm version patch
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      
      - run: git push origin main --tags
```

---

## Version Management

### Semantic Versioning

**Format**: `MAJOR.MINOR.PATCH`

**Version Bump Rules**:
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backward compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

**Conventional Commits**:
```bash
# Patch version bump
git commit -m "fix: correct EPUB parsing for nested chapters"

# Minor version bump
git commit -m "feat: add support for MOBI format"

# Major version bump
git commit -m "feat!: redesign CLI interface

BREAKING CHANGE: --output flag renamed to --output-dir"
```

### Version Commands

**Bump Patch**:
```bash
npm version patch
# 2.7.0 → 2.7.1
```

**Bump Minor**:
```bash
npm version minor
# 2.7.0 → 2.8.0
```

**Bump Major**:
```bash
npm version major
# 2.7.0 → 3.0.0
```

**Specific Version**:
```bash
npm version 3.0.0
```

**Pre-release Version**:
```bash
npm version 2.8.0-beta.1
```

---

## Pre-Publish Checks

### Automated Checks

**package.json Validation**:
```json
{
  "name": "imaginize",
  "version": "2.7.0",
  "description": "Transform books into illustrated guides with AI-powered scene detection and image generation",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "imaginize": "dist/cli.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "keywords": [
    "epub",
    "pdf",
    "ai",
    "illustration",
    "ebook",
    "scene-detection",
    "image-generation"
  ],
  "author": "tribixbite",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/tribixbite/imaginize.git"
  }
}
```

**TypeScript Build**:
```bash
npm run build
# Ensures:
# - TypeScript compilation succeeds
# - Declaration files (.d.ts) generated
# - Source maps created
```

**Test Suite**:
```bash
npm test
# Ensures:
# - All unit tests pass
# - Integration tests pass
# - No regressions introduced
```

**Quality Checks**:
```bash
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
npm run format:check  # Prettier
```

### Manual Checks

**Verify Build Output**:
```bash
ls -lh dist/
# Should contain:
# - cli.js (CLI entry point)
# - index.js (programmatic API)
# - *.d.ts (TypeScript declarations)
# - *.js.map (source maps)
```

**Test Package Locally**:
```bash
# Pack tarball
npm pack

# Install locally
npm install -g imaginize-2.7.0.tgz

# Test CLI
imaginize --version
imaginize --help

# Cleanup
npm uninstall -g imaginize
```

**Verify README**:
- Up-to-date installation instructions
- Correct usage examples
- Accurate API documentation
- Valid badges (CI, npm version, license)

---

## npm Registry Configuration

### Registry Settings

**Default Registry**:
```bash
npm config get registry
# https://registry.npmjs.org/
```

**Authentication**:
```bash
# Login (interactive)
npm login

# Verify authentication
npm whoami
# Should output: tribixbite
```

### Access Control

**Package Scope**:
- **Unscoped**: `imaginize` (public)
- **Scoped** (future): `@tribixbite/imaginize` (public or private)

**Publish Access**:
```bash
# Public package (default)
npm publish --access public

# Private package (requires paid npm account)
npm publish --access restricted
```

**Collaborators**:
```bash
# Add collaborator
npm owner add username imaginize

# List owners
npm owner ls imaginize

# Remove owner
npm owner rm username imaginize
```

---

## Changelog Generation

### Conventional Changelog

**Generate Changelog**:
```bash
npx conventional-changelog -p angular -i CHANGELOG.md -s
```

**Example Output**:
```markdown
# Changelog

## [2.7.0] - 2025-11-14

### Features
- Add support for custom API endpoints (#45)
- Implement concurrent chapter processing (#47)
- Add historical benchmark tracking (#52)

### Bug Fixes
- Fix EPUB parsing for nested chapters (#43)
- Correct token estimation for long text (#46)

### Performance Improvements
- Optimize state file writes (50% faster) (#50)

### Documentation
- Add comprehensive test suite documentation (#48)
- Update CLI interface specification (#49)
```

### Manual Changelog

**Format**:
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New feature descriptions

### Changed
- Changes to existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes

## [2.7.0] - 2025-11-14

### Added
- Support for custom API endpoints
- Concurrent chapter processing
- Historical benchmark tracking
```

---

## GitHub Integration

### Git Tags

**Create Tag**:
```bash
# Automatic (with npm version)
npm version 2.7.0
# Creates tag: v2.7.0

# Manual
git tag v2.7.0
git push origin v2.7.0
```

**List Tags**:
```bash
git tag
# v2.0.0
# v2.1.0
# ...
# v2.7.0
```

### GitHub Releases

**Create Release** (via GitHub CLI):
```bash
gh release create v2.7.0 \
  --title "v2.7.0: Custom Endpoints and Concurrent Processing" \
  --notes-file CHANGELOG.md
```

**Release Assets**:
- Source code (.zip, .tar.gz) - automatic
- Package tarball (optional): `npm pack`

---

## Distribution Tags

### Latest Tag

**Default Tag**:
```bash
npm publish
# Automatically tags as 'latest'
```

**Users Install**:
```bash
npm install imaginize
# Installs 'latest' tag
```

### Beta/Alpha Tags

**Publish Pre-release**:
```bash
npm publish --tag beta
npm publish --tag alpha
```

**Users Install**:
```bash
npm install imaginize@beta
npm install imaginize@alpha
```

**Promote to Latest**:
```bash
npm dist-tag add imaginize@2.8.0-beta.3 latest
```

---

## Post-Publish Tasks

### Verification

**Check npm Registry**:
```bash
# View package info
npm view imaginize

# Check version
npm view imaginize version
# Should output: 2.7.0

# Check files
npm view imaginize files
```

**Test Installation**:
```bash
# Fresh install
npm install -g imaginize

# Verify version
imaginize --version
# Should output: imaginize v2.7.0

# Test basic functionality
imaginize --help
```

### Documentation Updates

**Update README.md**:
- Bump version badge
- Update installation instructions
- Add new features to documentation

**Update GitHub**:
- Create release notes
- Update project description
- Add release tag

**Social Announcements**:
- Twitter/X post
- GitHub discussions
- Dev.to article (major releases)

---

## Rollback Procedures

### Unpublish (24-hour window)

**Remove Version**:
```bash
npm unpublish imaginize@2.7.0
```

**Restrictions**:
- Only possible within 24 hours of publish
- Cannot unpublish if version has >1,000 downloads
- Use with caution (breaks installs)

### Deprecate (Preferred)

**Mark as Deprecated**:
```bash
npm deprecate imaginize@2.7.0 "Critical bug. Use 2.7.1 instead."
```

**Users See**:
```
npm WARN deprecated imaginize@2.7.0: Critical bug. Use 2.7.1 instead.
```

**Publish Fix**:
```bash
# Fix the bug
git commit -m "fix: critical bug in chapter parsing"

# Bump patch version
npm version patch

# Publish fix
npm publish
```

---

## Security

### Two-Factor Authentication

**Enable 2FA**:
```bash
npm profile enable-2fa auth-and-writes
```

**Publish with 2FA**:
```bash
npm publish
# Prompts for OTP code
```

### Access Tokens

**Create Token** (for CI/CD):
1. Login to npmjs.com
2. Access Tokens → Generate New Token
3. Type: Automation
4. Copy token (only shown once)

**Use in GitHub Actions**:
```yaml
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Package Signing

**Sign Package**:
```bash
# Future feature (not yet implemented)
npm publish --sign
```

---

## Troubleshooting

### Publish Failures

**Issue**: `npm ERR! 403 Forbidden`

**Causes**:
- Not logged in: `npm login`
- No publish permission: Check `npm owner ls imaginize`
- Package name conflict: Choose different name

**Issue**: `npm ERR! 402 Payment Required`

**Cause**: Private scoped package requires paid account

**Solution**: Use `--access public` or upgrade npm account

**Issue**: Version already exists

**Solution**:
```bash
# Bump version
npm version patch

# Retry publish
npm publish
```

---

## Best Practices

### Before Publishing

1. ✅ All tests passing
2. ✅ Documentation updated
3. ✅ CHANGELOG.md updated
4. ✅ Version bumped appropriately
5. ✅ Clean working directory
6. ✅ Build artifacts generated

### During Publishing

1. Use automated CI/CD (GitHub Actions)
2. Enable 2FA on npm account
3. Use distribution tags for pre-releases
4. Include comprehensive README

### After Publishing

1. Verify package on npm registry
2. Test fresh installation
3. Create GitHub release
4. Update documentation
5. Announce on social media

---

## Related Documentation

- [GitHub Releases](./github-releases.md) - Release automation
- [CI/CD Pipeline](./cicd-pipeline.md) - Automated publishing
- [Code Quality](./code-quality.md) - Pre-publish checks

---

**Status**: Complete ✅
**Last Updated**: 2025-11-14
**Registry**: https://www.npmjs.com/package/imaginize
**Current Version**: 2.7.0
