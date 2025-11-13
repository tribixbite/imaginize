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
- [Book Parsing](./book-parsing.md) - EPUB and PDF parsing with metadata extraction
- [AI Integration](./ai-integration.md) - OpenAI, OpenRouter, and custom endpoint support
- [Token Management](./token-management.md) - Counting, estimation, and cost tracking
- [Visual Style System](./visual-style-system.md) - Style consistency and character tracking
- [Dashboard System](./dashboard.md) - Real-time WebSocket monitoring UI

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

### Current Status (v2.6.2)
- **Code Quality**: 0 TypeScript errors, 0 ESLint warnings
- **Test Coverage**: 86.0% (37/43 tests passing)
- **Security**: 0 vulnerabilities in production dependencies
- **Documentation**: 4,820+ lines across 14 primary documents
- **npm Package**: Published and fully functional
- **CI/CD**: Automated testing and publishing

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

## Document Status

### Complete ✅
- System Architecture
- Pipeline Architecture
- Concurrent Processing
- CLI Interface
- Configuration System
- Book Parsing
- AI Integration
- Token Management
- Visual Style System
- Dashboard System

### In Progress 🚧
- Output Files (partial)
- State File Format (needs JSON schema)
- Test Suite (needs coverage details)
- CI/CD Pipeline (needs workflow details)

### Planned 📋
- Error Recovery (needs detailed scenarios)
- Parallel Processing (needs performance benchmarks)
- Provider Detection (needs decision tree)
- Installation Methods (needs platform-specific guides)

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
**Version**: 2.6.2
**Status**: Active Development
