# imaginize Technical Specifications

Comprehensive architecture and feature documentation for the imaginize project.

## Table of Contents

### Core Architecture
- [System Architecture](./architecture.md) - Overall system design, components, and data flow
- [Pipeline Architecture](./pipeline-architecture.md) - Phase-based processing pipeline (Analyze, Extract, Illustrate)
- [Concurrent Processing](./concurrent-processing.md) - Two-pass analysis and manifest coordination
- [State Management](./state-management.md) - `.imaginize.state.json` and resume functionality

### Features
- [CLI Interface](./cli-interface.md) - Command-line options, flags, and usage patterns
- [Configuration System](./configuration.md) - Config file structure, providers, and defaults
- [AI Integration](./ai-integration.md) - OpenAI, OpenRouter, and custom endpoint support
- [Token Management](./token-management.md) - Counting, estimation, and cost tracking
- [Visual Style System](./visual-style-system.md) - Style consistency and character tracking
- [Dashboard System](./dashboard.md) - Real-time WebSocket monitoring UI
- [Multi-Book Series](./multi-book-series.md) - Series-wide element sharing and style inheritance (Spec only)
- [Graphic Novel Compilation](./graphic-novel-compilation.md) - PDF generation with layouts and smart captions
- [Custom Prompt Templates](./custom-prompt-templates.md) - Per-phase prompt customization with variables and presets
- [GitHub Pages Demo](./github-pages-demo.md) - Browser-based demo with E2E testing

### Data Formats
- [Output Files](./output-files.md) - Contents.md, Chapters.md, Elements.md formats
- [State File Format](./state-file-format.md) - JSON schema and phase tracking
- [Manifest Format](./manifest-format.md) - Concurrent processing coordination

### Testing & Quality
- [Test Suite](./test-suite.md) - Unit tests, integration tests, and coverage
- [CI/CD Pipeline](./cicd-pipeline.md) - GitHub Actions workflows and automation
- [Code Quality](./code-quality.md) - TypeScript, ESLint, Prettier configuration

### Advanced Features
- [Rate Limit Handling](./rate-limiting.md) - Automatic retry with exponential backoff
- [Error Recovery](./error-recovery.md) - Resume from failures, stuck chapter timeout
- [Parallel Processing](./parallel-processing.md) - Batch processing and concurrency control
- [Provider Detection](./provider-detection.md) - Auto-configuration for OpenAI/OpenRouter

### Deployment
- [npm Publishing](./npm-publishing.md) - Release process and automation
- [GitHub Releases](./github-releases.md) - Automated release creation
- [Installation Methods](./installation.md) - npx, global install, local development

## Quick Reference

### Current Status (v2.7.0+)
- **Code Quality**: 0 TypeScript errors, 0 ESLint warnings
- **Test Coverage**: 100% (527/527 main tests passing, 34 integration tests, 68 E2E tests)
- **Security**: 0 vulnerabilities in production dependencies
- **Documentation**: 10,000+ lines across 24 primary documents + specs
- **npm Package**: Published and fully functional
- **CI/CD**: Automated testing, E2E testing, and publishing

### Key Metrics
- **Lines of Code**: ~3,850+
- **Package Size**: 192.9 kB compressed
- **Bundle Size**: 211.70 kB (65.58 kB gzipped)
- **Node Support**: 18, 20, 22
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+

### Major Features Implemented
1. ✅ Phase-based CLI with resume/continue support
2. ✅ Concurrent processing with manifest coordination
3. ✅ Two-pass analysis (entity extraction → full analysis)
4. ✅ Visual style consistency system
5. ✅ Character appearance tracking
6. ✅ Real-time WebSocket dashboard
7. ✅ OpenRouter free tier support
8. ✅ Automatic rate limit handling
9. ✅ Token counting and cost estimation
10. ✅ Multi-provider configuration
11. ✅ Graphic novel PDF compilation (`imaginize compile`)
12. ✅ Interactive style wizard (`imaginize wizard`)
13. ✅ Scene regeneration system (`imaginize regenerate`)
14. ✅ GitHub Pages demo with E2E tests (68 tests)

## Document Status

### Complete ✅
- System Architecture
- Pipeline Architecture
- CLI Interface
- Configuration System
- AI Integration
- Token Management
- Visual Style System
- Dashboard System
- Graphic Novel Compilation
- Custom Prompt Templates
- GitHub Pages Demo

### Spec Only (Not Yet Implemented) 📋
- Multi-Book Series (spec complete, implementation pending)
- Concurrent Processing (documented but may need updates)

### Missing Documentation 🚧
- Output Files (needs examples)
- State File Format (needs JSON schema)
- Test Suite (needs detailed coverage report)
- CI/CD Pipeline (needs workflow details)
- Book Parsing (needs EPUB/PDF parser documentation)
- Error Recovery (needs detailed scenarios)
- Parallel Processing (needs performance benchmarks)
- Provider Detection (needs decision tree)
- Installation Methods (needs platform-specific guides)
- Rate Limiting (needs implementation details)
- Manifest Format (needs schema documentation)
- npm Publishing (needs release process)
- GitHub Releases (needs automation details)
- Code Quality (needs linting/formatting rules)

## Contributing

When adding new specifications:
1. Create the spec file in `docs/specs/`
2. Add entry to this README's Table of Contents
3. Update the Document Status section
4. Cross-reference related specs
5. Include code examples and diagrams where helpful

## Related Documentation

- [README.md](../../README.md) - User guide and quick start
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Development guidelines
- [CHANGELOG.md](../../CHANGELOG.md) - Version history
- [WORKING.md](../../WORKING.md) - Development status
- [PROJECT_OVERVIEW.md](../../PROJECT_OVERVIEW.md) - Project snapshot

---

**Last Updated**: 2025-11-13
**Version**: 2.7.0+
**Status**: Production-Ready with Optional Enhancements
