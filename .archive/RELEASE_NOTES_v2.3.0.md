# imaginize v2.3.0 Release Notes

## 🎉 Major Features

### Visual Character Descriptions
Entity extraction now captures **physical appearance** instead of functional roles:
- **Before:** "Christopher: main character waiting for his grandfather"
- **After:** "Christopher: A young boy with a tall, gangly build, wearing a long navy wool overcoat. He has a soft expression that brightens around animals..."

This makes Elements.md immediately usable for image generation prompts.

### Parallel Chapter Analysis
Pass 2 analysis now processes multiple chapters simultaneously:
- **Free tier (OpenRouter):** Batch size 1 (respects 1 req/min rate limit)
- **Paid tier:** Batch size 3 with 2-second delays between batches
- **Performance improvement:** Up to 50% faster for paid tier APIs (3h → 1.5-2h for large books)

### Enhanced Quote Quality
Quotes are now substantial and context-rich:
- **Length:** 3-8 sentences (50-150 words) instead of single sentences
- **Context:** Includes character actions, setting details, and mood
- **Standalone:** Usable as complete reference without reading full chapter

### Character Cross-Referencing
Visual Elements sections now include comprehensive CHARACTER DETAILS:
- Automatically matches multi-word names (e.g., "Mal" → "Mal Arvorian")
- Appends full visual descriptions from Elements.md
- Every scene includes relevant character appearance details

### Chapter Titles in Filenames
Image filenames now include sanitized chapter titles:
- **Before:** `chapter_9_scene_1.png`
- **After:** `chapter_9_the_beginning_scene_1.png`

## 🚀 Performance Improvements

- **Free Tier:** 40% faster (5h → 3h) with two-pass concurrent processing
- **Paid Tier:** Additional 50% speedup (3h → 1.5-2h) with parallel batch processing
- **Smart Rate Limiting:** Auto-detection of free vs paid tier with appropriate batch sizes
- **Inter-Batch Delays:** 2-second delays prevent rate limit violations

## 🐛 Bug Fixes

- Entity matching now correctly identifies characters mentioned by first/last name only
- Elements.md descriptions are now visual and standalone, suitable for image generation
- Page numbers properly populated in Chapters.md from chapter metadata

## 🔧 Technical Changes

### New/Modified Files
- `src/lib/phases/analyze-phase-v2.ts` - Refactored with batch processing using Promise.all()
- `src/lib/concurrent/entity-extractor.ts` - Enhanced prompt with visual-first extraction
- `src/lib/concurrent/elements-lookup.ts` - Improved name matching algorithm with regex escaping

### Architecture Improvements
- Added `analyzeChapterWithTracking()` method for parallel execution
- Implemented auto-detection of batch size based on model name (free vs paid tier)
- Enhanced entity extraction prompt with examples of good vs bad descriptions
- Multi-word name support with partial matching and duplicate prevention

## 📊 Test Coverage

- 35 unit tests (100% pass rate)
- Integration tested with 297-page book (69 images, 25 minutes)
- Verified visual character descriptions with ImpossibleCreatures.epub chapters 1-3

## 🆓 OpenRouter Free Tier

Fully functional with $0 cost:
- Text analysis: `google/gemini-2.0-flash-exp:free`
- Image generation: `google/gemini-2.5-flash-image`
- Automatic rate limit handling (65s waits)
- Batch size 1 for analysis (respects 1 req/min limit)

## 📚 Documentation

- Comprehensive CHANGELOG.md with all versions
- Updated README.md with v2.3.0 features and examples
- Complete WORKING.md documenting all implementation phases
- Enhanced NEXT_STEPS.md with future priorities

## 🔜 Coming Soon

Looking ahead to future releases:
- **Priority 3:** Named Entity Recognition (NER) for faster, more accurate entity detection
- **Priority 4:** Real-time progress UI with WebSocket updates
- **Priority 5:** Image quality improvements with style consistency

## 📦 Upgrade from v2.2.0

No breaking changes! Simply update:
```bash
npm install -g imaginize@2.3.0
```

All existing configurations and state files remain compatible.

## 🙏 Acknowledgments

Special thanks to the community for feedback on character description quality. This release directly addresses the need for visual, illustration-ready entity descriptions.

## 📖 Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

**Full Diff:** [v2.2.0...v2.3.0](https://github.com/tribixbite/imaginize/compare/v2.2.0...v2.3.0)
