# GitHub Releases Specification

Automated release management and GitHub integration for imaginize.

## Overview

imaginize uses GitHub Releases for:
- **Version Tracking** - Tag-based release history
- **Release Notes** - Auto-generated from conventional commits
- **Asset Distribution** - Source code archives
- **Changelog Integration** - Synchronized with CHANGELOG.md
- **npm Synchronization** - Aligned with npm package releases

---

## Release Workflow

### Automated Release

**Trigger**: npm version bump + push to main

**GitHub Actions Workflow** (`.github/workflows/release.yml`):
```yaml
name: Create GitHub Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch all history for changelog
      
      - name: Generate Release Notes
        id: notes
        run: |
          # Extract version from tag
          VERSION=${GITHUB_REF#refs/tags/v}
          
          # Generate changelog for this version
          npx conventional-changelog-cli -p angular -r 1 -o RELEASE_NOTES.md
          
          echo "version=$VERSION" >> $GITHUB_OUTPUT
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: v${{ steps.notes.outputs.version }}
          name: v${{ steps.notes.outputs.version }}
          body_path: RELEASE_NOTES.md
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Manual Release

**Using GitHub CLI**:
```bash
# Create release from tag
gh release create v2.7.0 \
  --title "v2.7.0: Custom Endpoints and Concurrent Processing" \
  --notes-file CHANGELOG.md

# Create pre-release
gh release create v2.8.0-beta.1 \
  --title "v2.8.0-beta.1" \
  --notes "Beta release for testing" \
  --prerelease

# Create draft release
gh release create v3.0.0 \
  --title "v3.0.0: Major Update" \
  --notes-file RELEASE_NOTES.md \
  --draft
```

**Using GitHub Web UI**:
1. Navigate to: https://github.com/tribixbite/imaginize/releases
2. Click "Draft a new release"
3. Choose tag: `v2.7.0` (or create new)
4. Release title: `v2.7.0: Custom Endpoints and Concurrent Processing`
5. Description: Copy from CHANGELOG.md
6. Attach assets (optional)
7. Click "Publish release"

---

## Release Notes Format

### Conventional Commits

**Auto-Generated Format**:
```markdown
# v2.7.0: Custom Endpoints and Concurrent Processing

## 🚀 Features

- Add support for custom API endpoints (#45)
  - Configure base URL for self-hosted LLMs
  - Support for Ollama and LM Studio
  - Auto-detection of OpenAI vs OpenRouter vs custom

- Implement concurrent chapter processing (#47)
  - Process multiple chapters in parallel
  - Manifest-based coordination
  - 50-70% faster with batch size 3

- Add historical benchmark tracking (#52)
  - SQLite database for benchmark history
  - Chart.js visualizations
  - Regression detection

## 🐛 Bug Fixes

- Fix EPUB parsing for nested chapters (#43)
  - Correctly handle nested `<section>` tags
  - Preserve chapter hierarchy
  - Improved content extraction

- Correct token estimation for long text (#46)
  - More accurate GPT-4 token counting
  - Handle multi-byte characters correctly

## ⚡ Performance Improvements

- Optimize state file writes (#50)
  - Reduce write operations by 50%
  - Atomic writes with rename
  - Better error handling

## 📚 Documentation

- Add comprehensive test suite documentation (#48)
- Update CLI interface specification (#49)
- Add code quality standards (#51)

## 🔧 Maintenance

- Upgrade dependencies to latest versions
- Fix ESLint warnings in test files
- Improve CI/CD pipeline reliability

---

**Full Changelog**: https://github.com/tribixbite/imaginize/compare/v2.6.0...v2.7.0
```

### Manual Format

**Template**:
```markdown
# v2.7.0: [Release Title]

[Brief 2-3 sentence overview of this release]

## What's New

### Major Features
- **Custom API Endpoints**: Configure imaginize to use self-hosted LLMs
- **Concurrent Processing**: Process multiple chapters simultaneously for faster completion
- **Benchmark History**: Track performance trends over time with SQLite database

### Improvements
- Faster state file writes (50% improvement)
- Better token estimation accuracy
- Enhanced error recovery

### Bug Fixes
- Fixed EPUB parsing for books with nested chapters
- Corrected token counting for non-ASCII characters

## Breaking Changes

None in this release.

## Upgrade Guide

```bash
npm install -g imaginize@latest
```

No configuration changes required.

## Contributors

Thanks to all contributors who made this release possible!

- @tribixbite

## Full Changelog

https://github.com/tribixbite/imaginize/compare/v2.6.0...v2.7.0
```

---

## Version Tagging

### Tag Naming Convention

**Stable Releases**:
- Format: `v{MAJOR}.{MINOR}.{PATCH}`
- Example: `v2.7.0`, `v3.0.0`

**Pre-releases**:
- Beta: `v2.8.0-beta.1`
- Alpha: `v3.0.0-alpha.2`
- RC: `v3.0.0-rc.1`

### Tag Creation

**Automatic** (with npm version):
```bash
npm version 2.7.0
# Creates tag: v2.7.0
# Updates package.json
# Creates git commit
```

**Manual**:
```bash
# Create annotated tag
git tag -a v2.7.0 -m "Release v2.7.0: Custom Endpoints and Concurrent Processing"

# Push tag to remote
git push origin v2.7.0

# Push all tags
git push origin --tags
```

### Tag Management

**List Tags**:
```bash
# All tags
git tag

# Tags matching pattern
git tag -l "v2.*"
```

**Delete Tag**:
```bash
# Local
git tag -d v2.7.0

# Remote
git push origin :refs/tags/v2.7.0
```

**Move Tag** (if needed):
```bash
# Delete old tag
git tag -d v2.7.0
git push origin :refs/tags/v2.7.0

# Create new tag at current commit
git tag -a v2.7.0 -m "Release v2.7.0"
git push origin v2.7.0
```

---

## Release Assets

### Source Code Archives

**Automatically Generated**:
- `Source code (zip)` - ZIP archive of repository at tag
- `Source code (tar.gz)` - Tarball archive

**Contents**:
- All source files
- Documentation
- Tests
- Configuration files

### Custom Assets

**npm Package Tarball**:
```bash
# Generate tarball
npm pack
# Creates: imaginize-2.7.0.tgz

# Upload to release
gh release upload v2.7.0 imaginize-2.7.0.tgz
```

**Standalone Binaries** (future):
```bash
# Build binaries for multiple platforms
npm run build:binary

# Upload to release
gh release upload v2.7.0 \
  imaginize-linux-x64 \
  imaginize-darwin-x64 \
  imaginize-darwin-arm64 \
  imaginize-win-x64.exe
```

---

## Release Types

### Stable Releases

**Characteristics**:
- Fully tested
- Production-ready
- Tagged as `latest` on npm
- No pre-release suffix

**Example**: `v2.7.0`

**Release Process**:
1. All tests passing
2. Documentation complete
3. CHANGELOG updated
4. Version bump: `npm version {patch|minor|major}`
5. Push tag: `git push origin --tags`
6. GitHub release created automatically
7. npm publish: `npm publish`

### Pre-releases

**Beta Releases**:
- Feature-complete but needs testing
- May have minor bugs
- Tagged as `beta` on npm
- Suffix: `-beta.N`

**Example**: `v2.8.0-beta.1`

**Release Process**:
```bash
# Bump version
npm version 2.8.0-beta.1

# Publish to npm with beta tag
npm publish --tag beta

# Create GitHub release
gh release create v2.8.0-beta.1 \
  --title "v2.8.0-beta.1" \
  --notes "Beta release for testing new features" \
  --prerelease
```

**Alpha Releases**:
- Experimental features
- Likely has bugs
- For early adopters only
- Suffix: `-alpha.N`

**Example**: `v3.0.0-alpha.1`

**Release Candidates**:
- Final testing before stable release
- No new features, only bug fixes
- Suffix: `-rc.N`

**Example**: `v3.0.0-rc.1`

---

## Changelog Integration

### Conventional Changelog

**Generate for Current Version**:
```bash
npx conventional-changelog-cli -p angular -r 1 -o RELEASE_NOTES.md
```

**Update CHANGELOG.md**:
```bash
npx conventional-changelog-cli -p angular -i CHANGELOG.md -s
```

**Configuration** (`.changelogrc`):
```json
{
  "preset": "angular",
  "header": "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n",
  "types": [
    {"type": "feat", "section": "Features"},
    {"type": "fix", "section": "Bug Fixes"},
    {"type": "perf", "section": "Performance Improvements"},
    {"type": "docs", "section": "Documentation"},
    {"type": "style", "section": "Styles"},
    {"type": "refactor", "section": "Code Refactoring"},
    {"type": "test", "section": "Tests"},
    {"type": "chore", "section": "Maintenance"}
  ]
}
```

### Manual Changelog

**Keep a Changelog Format**:
```markdown
# Changelog

## [Unreleased]
### Added
- New features in development

## [2.7.0] - 2025-11-14
### Added
- Support for custom API endpoints
- Concurrent chapter processing
- Historical benchmark tracking

### Fixed
- EPUB parsing for nested chapters
- Token estimation accuracy

### Performance
- State file write optimization (50% faster)

[2.7.0]: https://github.com/tribixbite/imaginize/compare/v2.6.0...v2.7.0
```

---

## GitHub API Integration

### Create Release via API

**Using curl**:
```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/tribixbite/imaginize/releases \
  -d '{
    "tag_name": "v2.7.0",
    "name": "v2.7.0: Custom Endpoints and Concurrent Processing",
    "body": "Release notes...",
    "draft": false,
    "prerelease": false
  }'
```

**Using Octokit** (Node.js):
```typescript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

await octokit.repos.createRelease({
  owner: 'tribixbite',
  repo: 'imaginize',
  tag_name: 'v2.7.0',
  name: 'v2.7.0: Custom Endpoints and Concurrent Processing',
  body: releaseNotes,
  draft: false,
  prerelease: false
});
```

### List Releases

**GitHub CLI**:
```bash
# List all releases
gh release list

# View specific release
gh release view v2.7.0
```

**API**:
```bash
curl -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/tribixbite/imaginize/releases
```

---

## Best Practices

### Release Checklist

**Before Release**:
- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped
- [ ] Breaking changes documented
- [ ] Migration guide (if needed)

**During Release**:
- [ ] Tag created
- [ ] Release notes comprehensive
- [ ] Assets uploaded (if any)
- [ ] Pre-release flag set correctly

**After Release**:
- [ ] npm package published
- [ ] GitHub release verified
- [ ] Social media announcement
- [ ] Documentation site updated

### Release Timing

**Regular Releases**:
- Patch: Weekly (bug fixes)
- Minor: Monthly (new features)
- Major: Quarterly (breaking changes)

**Hotfix Releases**:
- Critical bugs: Immediate
- Security issues: Within 24 hours

---

## Rollback Procedures

### Delete Release

**GitHub CLI**:
```bash
gh release delete v2.7.0 --yes
```

**Keep Tag**:
```bash
# Delete release but keep tag
gh release delete v2.7.0 --yes

# Tag still exists
git tag -l v2.7.0
```

### Edit Release

**GitHub CLI**:
```bash
# Update release notes
gh release edit v2.7.0 --notes "Updated release notes"

# Mark as pre-release
gh release edit v2.7.0 --prerelease

# Change title
gh release edit v2.7.0 --title "v2.7.0: Updated Title"
```

---

## Security

### Release Verification

**GPG Signing** (future):
```bash
# Sign tag
git tag -s v2.7.0 -m "Release v2.7.0"

# Verify signature
git tag -v v2.7.0
```

**Checksum Verification**:
```bash
# Generate checksums for assets
sha256sum imaginize-2.7.0.tgz > SHA256SUMS

# Upload to release
gh release upload v2.7.0 SHA256SUMS
```

### Access Control

**Required Permissions**:
- Push access to `main` branch
- Create/delete tags
- Create/edit releases

**Branch Protection**:
- Require pull request reviews
- Require status checks
- Require signed commits (optional)

---

## Related Documentation

- [npm Publishing](./npm-publishing.md) - Package publishing
- [CI/CD Pipeline](./cicd-pipeline.md) - Automated workflows
- [Code Quality](./code-quality.md) - Release standards

---

**Status**: Complete ✅
**Last Updated**: 2025-11-14
**Latest Release**: v2.7.0
**Release Cadence**: Patch (weekly), Minor (monthly), Major (quarterly)
