# Publishing imaginize to npm

## Prerequisites

1. npm account with publish access to `imaginize` package
2. Logged in via `npm login`
3. Clean git working directory
4. All tests passing

## Version Update Process

### 1. Update Version Number

```bash
# For bug fixes (2.0.0 → 2.0.1)
npm version patch

# For new features (2.0.0 → 2.1.0)
npm version minor

# For breaking changes (2.0.0 → 3.0.0)
npm version major
```

This command:
- Updates `package.json` version
- Creates a git commit with message "v2.x.x"
- Creates a git tag "v2.x.x"

### 2. Review Changes

```bash
# Check what will be published
npm pack --dry-run

# Or create actual tarball to inspect
npm pack
tar -tzf imaginize-*.tgz
rm imaginize-*.tgz
```

### 3. Build and Test

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Test CLI locally
node bin/imaginize.js --help
```

### 4. Publish to npm

```bash
# Publish to npm (runs prepublishOnly script automatically)
npm publish

# Or publish as beta
npm publish --tag beta
```

The `prepublishOnly` script in package.json automatically runs `npm run build` before publishing.

### 5. Push to GitHub

```bash
# Push commits and tags
git push && git push --tags
```

## Current Version: 2.0.0

### Recent Changes (for v2.1.0)

- ✅ Story chapter mapping (--chapters now refers to story chapters)
- ✅ OpenRouter free tier support with auto rate limiting
- ✅ Multi-scene chapter support with correct numbering
- ✅ Comprehensive CLI options
- ✅ 131 images generated in full book test

### Recommended Next Version: 2.1.0

Rationale:
- New features added (story chapter mapping, OpenRouter support)
- No breaking changes to existing API
- All existing functionality preserved

## Publishing Checklist

- [ ] All features tested and working
- [ ] README.md updated with new features
- [ ] WORKING.md updated with latest status
- [ ] All tests passing (`npm test`)
- [ ] TypeScript builds without errors (`npm run build`)
- [ ] Git working directory clean
- [ ] Version bumped appropriately
- [ ] CHANGELOG.md updated (if exists)
- [ ] Tested locally with `npm pack`
- [ ] Published to npm (`npm publish`)
- [ ] Git tags pushed to GitHub (`git push --tags`)
- [ ] GitHub release created (optional)

## Quick Publish (Patch)

```bash
# Clean, test, version, publish
npm run build && \
npm test && \
npm version patch && \
npm publish && \
git push && git push --tags
```

## Quick Publish (Minor - New Features)

```bash
# Clean, test, version, publish
npm run build && \
npm test && \
npm version minor && \
npm publish && \
git push && git push --tags
```

## Rollback

If you need to unpublish (within 72 hours):

```bash
# Unpublish specific version
npm unpublish imaginize@2.1.0

# Deprecate instead (preferred)
npm deprecate imaginize@2.1.0 "This version has issues, use 2.1.1 instead"
```

## npm Commands Reference

```bash
# Check current published version
npm view imaginize version

# Check all published versions
npm view imaginize versions

# Check package info
npm view imaginize

# Login to npm
npm login

# Check who you're logged in as
npm whoami

# See what files will be included
npm pack --dry-run
```

## File Inclusion

Files published to npm (from `package.json` "files" field):
- `dist/` - Compiled TypeScript
- `bin/` - CLI entry point
- `README.md`
- `LICENSE`

Files NOT published:
- `src/` - Source TypeScript files
- `tests/` - Test files
- `.imaginize.state.json` - State files
- `imaginize_*` - Output directories
- Node modules

## Post-Publish

After publishing:
1. Test installation: `npx imaginize@latest --version`
2. Create GitHub release with changelog
3. Update documentation website (if applicable)
4. Announce on social media/forums
5. Monitor npm downloads: https://npm-stat.com/charts.html?package=imaginize
