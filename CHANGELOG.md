# Changelog

All notable changes to imaginize will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2025-11-12

### Added
- **Visual Character Descriptions**: Entity extraction now captures physical appearance, clothing, and distinguishing features instead of functional roles
- **Enhanced Entity Matching**: Multi-word name support (e.g., "Mal" matches "Mal Arvorian") with partial name matching
- **Chapter Titles in Filenames**: Image filenames now include sanitized chapter titles (e.g., `chapter_9_the_beginning_scene_1.png`)
- **Character Cross-Referencing**: Visual Elements sections now include comprehensive CHARACTER DETAILS with full visual descriptions from Elements.md

### Improved
- **Quote Quality**: Quotes now 3-8 sentences (50-150 words) instead of single sentences, with explicit context requirements
- **Entity Descriptions**: Elements.md now contains illustration-ready visual descriptions:
  - Characters: age, build, clothing, expressions, physical features
  - Creatures: size, color, teeth, claws, fur, distinguishing traits
  - Places: visual atmosphere and notable features
- **Entity Extraction Prompt**: Enhanced prompt with examples of good vs. bad descriptions to guide AI

### Fixed
- Entity matching now correctly identifies characters mentioned by first/last name only
- Elements.md descriptions are now visual and standalone, suitable for image generation
- Page numbers properly populated in Chapters.md from chapter metadata

### Technical
- Updated `entity-extractor.ts` with visual-first extraction prompt
- Enhanced `elements-lookup.ts` with improved name matching algorithm
- Updated `analyze-phase-v2.ts` to enrich concepts with full entity descriptions
- Added regex escaping for special characters in entity names

## [2.2.0] - 2025-11-12

### Added
- **Concurrent Processing Architecture**: Phases 1-5 complete with manifest-driven coordination
- **Two-Pass Analysis**: Fast entity extraction → Elements.md → Full analysis with enrichment
- **Manifest-Driven Illustration**: Polling-based coordination for crash recovery
- **Thread-Safe Operations**: FileLock + AtomicWrite patterns
- **Feature Flag**: `--concurrent` flag for experimental concurrent mode (default: sequential)

### Improved
- **Performance**: 40% faster processing (5h → 3h) with concurrent mode
- **Crash Recovery**: Automatic recovery of stuck chapters (30min timeout)
- **Elements.md Enrichment**: Pass 2 analysis enriches prompts with entity context

### Fixed
- Format mismatch between AnalyzePhaseV2 and IllustratePhaseV2 parsers
- Gemini image response format parsing (multi-level fallback chain)
- Model detection regex catching incorrect models
- Config override issues with imageEndpoint.model

### Technical
- Added `FileLock` utility for exclusive file access
- Added `AtomicWrite` for corruption-proof operations
- Added `ManifestManager` for centralized state coordination
- Added `ElementsLookup` service for entity description retrieval
- 35 unit tests (100% pass rate)
- Integration tested with 297-page book (69 images, 25 minutes)

## [2.1.0] - 2025-11-05

### Added
- **OpenRouter Support**: Full support for OpenRouter API with free tier models
- **Automatic Rate Limit Handling**: Detects 429 errors and waits appropriately (65s for free tier)
- **Free Image Generation**: google/gemini-2.5-flash-image support ($0.00)
- **Enhanced Retry Logic**: Increased maxRetries from 1 to 10 for rate limit scenarios

### Improved
- **Rate Limit Detection**: Checks for both 429 status and "free-models-per-min" message
- **Progress Messaging**: Clear feedback on rate limits and wait times
- **Timeout Handling**: Increased maxTimeout from 60s to 120s

### Fixed
- Chapter numbering bug for multi-scene chapters
- Multi-scene chapter filename generation
- Rate limit errors causing immediate failure

### Technical
- Updated `retry-utils.ts` with isRateLimitError() detection
- Enhanced `base-phase.ts` with detailed rate limit messaging
- Fixed `illustrate-phase.ts` parseChaptersFile() regex for scene headers

## [2.0.0] - 2025-11-02

### Added
- **Multi-Provider Support**: OpenAI, OpenRouter, or custom endpoints
- **Granular Phase Control**: `--text`, `--elements`, `--images` flags
- **State Management**: Persistent progress tracking with `.imaginize.state.json`
- **Chapter Selection**: Process specific chapters with `--chapters 1-5,10`
- **Element Filtering**: Filter elements with `--elements-filter character:*`
- **Cost Estimation**: `--estimate` flag for pre-execution cost calculation
- **Progress Tracking**: Real-time `progress.md` file with detailed logs

### Changed
- Renamed from `illustrate` to `imaginize`
- Complete rewrite of phase orchestration system
- Modular phase architecture (AnalyzePhase, ExtractPhase, IllustratePhase)
- Improved error handling and recovery

### Technical
- TypeScript with full type safety
- Commander.js for CLI argument parsing
- Modular phase system with SubPhase pattern
- Token estimation and cost calculation
- OpenAI SDK v4 integration

## [1.0.0] - 2025-10-15

### Initial Release
- EPUB and PDF parsing
- OpenAI GPT-4 integration
- DALL-E 3 image generation
- Basic Contents.md generation
- Basic Elements.md extraction
- Sequential processing only

---

[2.3.0]: https://github.com/tribixbite/imaginize/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/tribixbite/imaginize/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/tribixbite/imaginize/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/tribixbite/imaginize/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/tribixbite/imaginize/releases/tag/v1.0.0
