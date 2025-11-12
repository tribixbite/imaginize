# Publishing imaginize v2.4.0 to npm

## Pre-Publication Checklist

✅ All items complete:

- [x] package.json version updated to 2.4.0
- [x] CHANGELOG.md updated with v2.4.0 entry
- [x] README.md updated with Visual Consistency section
- [x] RELEASE_NOTES_v2.4.0.md created
- [x] All source code complete and tested
- [x] TypeScript compilation succeeds (0 errors)
- [x] Git working directory clean
- [x] All changes committed
- [x] NEXT_STEPS.md updated (Priority 5 marked complete)
- [x] WORKING.md updated with session summary

## Publication Steps

### 1. Verify Build

```bash
# Clean build
rm -rf dist/
npm run build

# Should complete with 0 errors
```

### 2. Test Package Locally

```bash
# Test in a separate directory
mkdir /tmp/test-imaginize-v2.4.0
cd /tmp/test-imaginize-v2.4.0

# Test with local package
npm link /path/to/imaginize

# Run basic commands
imaginize --help
imaginize --init-config

# Clean up
cd -
rm -rf /tmp/test-imaginize-v2.4.0
```

### 3. Login to npm

```bash
npm login
# Enter your credentials:
# - Username
# - Password
# - Email
# - OTP (if 2FA enabled)
```

### 4. Publish to npm

```bash
# Dry run first (see what will be published)
npm publish --dry-run

# Review output carefully:
# - Check file list includes dist/
# - Verify package size is reasonable
# - Confirm version is 2.4.0

# Actually publish
npm publish

# Should see:
# + imaginize@2.4.0
```

### 5. Verify Publication

```bash
# Check npm registry
npm view imaginize

# Should show:
# imaginize@2.4.0 | MIT | deps: X | versions: Y
# Visual style consistency, character tracking, and concurrent processing...

# Test installation
npm install -g imaginize@2.4.0
imaginize --version
# Should output: 2.4.0
```

### 6. Create Git Tag

```bash
# Create annotated tag
git tag -a v2.4.0 -m "Release v2.4.0 - Visual Style Consistency System

Major Features:
- Visual style consistency with GPT-4 Vision
- Character appearance tracking
- Enhanced image prompts with style guide
- Bootstrap phase for automatic style extraction
- Configuration options for style system

See RELEASE_NOTES_v2.4.0.md for full details."

# Push tag to remote
git push origin v2.4.0

# Push all commits
git push origin main
```

### 7. Create GitHub Release

Go to: https://github.com/yourusername/imaginize/releases/new

**Tag:** v2.4.0
**Title:** imaginize v2.4.0 - Visual Style Consistency

**Description:**
```markdown
# imaginize v2.4.0 - Visual Style Consistency System

## 🎨 Major Features

- **Visual Style Consistency**: Automatic style extraction from first N images using GPT-4 Vision
- **Character Appearance Tracking**: Ensures characters look the same across all scenes
- **Enhanced Image Prompts**: All prompts enriched with style guide and character references
- **Bootstrap Phase**: Analyzes first 3 images to establish visual identity

## 📊 What's New

### Automatic Style Extraction
After generating the first 3 images, GPT-4 Vision analyzes them to extract:
- Art style (e.g., "Digital illustration with soft brush strokes")
- Color palette (dominant hex codes)
- Lighting characteristics
- Mood and atmosphere
- Composition patterns

### Character Tracking
Characters are automatically tracked across all appearances:
- First appearance registered with visual features from Elements.md
- Character descriptions included in every relevant prompt
- Consistency scores tracked per appearance

### Configuration
```yaml
enableStyleConsistency: true        # Enable/disable (default: true)
styleBootstrapCount: 3              # Images to analyze (default: 3)
trackCharacterAppearances: true     # Track characters (default: true)
consistencyThreshold: 0.7           # Consistency score threshold
```

## 📁 New Output Files

- `data/style-guide.json` - Extracted visual style
- `data/character-registry.json` - Character appearance tracking

## ⚡ Quick Start

```bash
# Install/update
npm install -g imaginize@2.4.0

# Use as normal - visual consistency automatic!
imaginize --images --file mybook.epub
```

## 📚 Full Details

See [RELEASE_NOTES_v2.4.0.md](./RELEASE_NOTES_v2.4.0.md) for complete documentation.

## 🔧 Technical

- New `src/lib/visual-style/` module (~1,300 LOC)
- GPT-4 Vision integration for style analysis
- Fully backward compatible
- Zero breaking changes

## 🆙 Upgrade

**From v2.3.0:** No changes required - fully backward compatible!

```bash
npm update -g imaginize
```

To disable visual consistency (use v2.3.0 behavior):
```yaml
enableStyleConsistency: false
```
```

### 8. Announce Release

**npm Package Page:**
- https://www.npmjs.com/package/imaginize

**X/Twitter:**
```
🎨 imaginize v2.4.0 is live!

New: Visual Style Consistency System
✨ Automatic style extraction with GPT-4 Vision
✨ Character appearance tracking
✨ Professional, cohesive illustration sets

Now your AI-generated book illustrations maintain consistent art style, colors, and character appearances across the entire book!

npm install -g imaginize@2.4.0

#AI #BookIllustration #GPT4Vision
```

**Discord/Community:**
```
imaginize v2.4.0 released! 🎉

Major new feature: Visual Style Consistency

The tool now automatically analyzes your first 3 generated images to extract a visual style guide (art style, color palette, lighting, mood, composition), then applies it to ALL subsequent images.

Plus: Character appearance tracking ensures characters look the same across all scenes!

npm install -g imaginize@2.4.0

See RELEASE_NOTES_v2.4.0.md for full details.
```

## Post-Publication Checklist

- [ ] npm package published successfully
- [ ] Git tag created and pushed
- [ ] GitHub release created
- [ ] Package installable via `npm install -g imaginize@2.4.0`
- [ ] Version command returns 2.4.0
- [ ] Release announced on social media
- [ ] Documentation links updated

## Rollback Plan

If critical issues discovered:

```bash
# Deprecate broken version
npm deprecate imaginize@2.4.0 "Critical bug - use v2.3.0 instead"

# Publish hotfix as v2.4.1
# Fix issues
# Update version to 2.4.1
npm publish

# Or revert to v2.3.0
npm dist-tag add imaginize@2.3.0 latest
```

## Version History

- **v2.4.0** (2025-11-12): Visual style consistency system
- **v2.3.0** (2025-11-12): Visual character descriptions, parallel processing
- **v2.2.0** (2025-11-12): Concurrent processing architecture
- **v2.1.0** (2025-11-06): OpenRouter support, free tier handling
- **v2.0.0** (2025-11-04): Major refactor with phase system
- **v1.0.0** (2025-11-01): Initial release

---

**Ready to publish!** 🚀

All automated tests pass, documentation complete, and the feature set is production-ready.
