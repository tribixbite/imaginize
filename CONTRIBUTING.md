# Contributing to imaginize

Thank you for your interest in contributing to **imaginize**! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

This project follows a simple code of conduct:
- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

---

## Getting Started

### Prerequisites

- **Node.js** 18+ or **Bun** runtime
- **npm** or **bun** package manager
- **Git** for version control
- **OpenRouter API key** for testing (free tier available)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/imaginize.git
   cd imaginize
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/tribixbite/imaginize.git
   ```

---

## Development Setup

### Install Dependencies

```bash
npm install
# or
bun install
```

### Build the Project

```bash
npm run build
```

This compiles TypeScript source files from `src/` to JavaScript in `dist/`.

### Run Tests

```bash
# Run all tests
npm run test

# Run specific test file
bun test test/pipeline.test.ts

# Run tests in watch mode (bun only)
bun test --watch
```

### Configure API Keys

Create a `.imaginize.config.json` in your home directory or use environment variables:

```bash
export OPENROUTER_API_KEY="your-key-here"
```

Get a free API key at https://openrouter.ai/keys

---

## Project Structure

```
imaginize/
├── src/                    # TypeScript source code
│   ├── index.ts           # CLI entry point
│   ├── lib/               # Core library code
│   │   ├── phases/        # Pipeline phases (analyze, extract, illustrate)
│   │   ├── providers/     # AI provider implementations
│   │   ├── parsers/       # EPUB/PDF parsers
│   │   └── utils/         # Utility functions
│   └── dashboard/         # Real-time web dashboard (React + TypeScript)
├── test/                  # Test suite
├── bin/                   # CLI executable
├── dist/                  # Compiled output (generated)
├── docs/                  # Technical documentation
└── *.md                   # Project documentation
```

### Key Components

- **CLI** (`src/index.ts`): Command-line interface using Commander.js
- **Phases** (`src/lib/phases/`): Three-phase pipeline architecture
  - **Analyze**: Extract visual scenes and prompts
  - **Extract**: Identify story elements (characters, locations, etc.)
  - **Illustrate**: Generate images using DALL-E
- **Providers** (`src/lib/providers/`): AI service integrations
- **Dashboard** (`dashboard/`): React-based real-time monitoring UI

---

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### Making Changes

1. **Write code** following the [Code Style](#code-style) guidelines
2. **Add tests** for new functionality
3. **Update documentation** if needed
4. **Build and test** locally:
   ```bash
   npm run build
   npm run test
   ```

### Keeping Your Fork Updated

```bash
git fetch upstream
git rebase upstream/main
```

---

## Code Style

### TypeScript Guidelines

- **Use TypeScript** for all new code
- **Enable strict mode** (already configured in `tsconfig.json`)
- **Use ES modules** (import/export) syntax
- **Destructure imports** when possible:
  ```typescript
  // Good
  import { parseEpub, parsePdf } from './lib/parsers.js';

  // Avoid
  import * as parsers from './lib/parsers.js';
  ```

### Naming Conventions

- **Classes**: PascalCase (`StateManager`, `AnalyzePhase`)
- **Functions**: camelCase (`parseEpub`, `generateImage`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_CONFIG`)
- **Interfaces**: PascalCase with `I` prefix optional (`BookMetadata` or `IBookMetadata`)

### Code Organization

- **Prefer `const`** over `let`, avoid `var`
- **Use async/await** instead of Promise chains
- **Add JSDoc comments** for public APIs:
  ```typescript
  /**
   * Parses an EPUB file and extracts chapters
   * @param filePath - Path to the EPUB file
   * @returns Array of chapter objects with title and content
   */
  export async function parseEpub(filePath: string): Promise<Chapter[]> {
    // ...
  }
  ```

### Error Handling

- **Throw descriptive errors** with helpful messages
- **Use try/catch** for async operations
- **Log errors** with context for debugging:
  ```typescript
  try {
    await processChapter(chapter);
  } catch (error) {
    console.error(`Failed to process chapter ${chapter.title}:`, error);
    throw error;
  }
  ```

---

## Testing

### Test Structure

Tests are located in `test/` and use **Bun's built-in test runner**.

### Writing Tests

```typescript
import { describe, test, expect } from 'bun:test';

describe('MyFeature', () => {
  test('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expectedValue);
  });

  test('should handle errors', () => {
    expect(() => myFunction(invalidInput)).toThrow();
  });
});
```

### Running Specific Tests

```bash
# Run only tests matching pattern
bun test --name "should do something"

# Run tests in specific file
bun test test/my-feature.test.ts
```

### Test Coverage Goals

- **Unit tests**: Aim for 80%+ coverage of core functionality
- **Integration tests**: Test complete workflows (require API keys)
- **CLI tests**: Verify command-line interface behavior

### Current Test Status

- **37/43 tests passing (86.0%)**
- 6 integration tests require API keys (expected)
- All unit and CLI tests should pass before submitting PR

### E2E Testing (Demo)

The `demo/` directory includes comprehensive E2E tests using Playwright:

**Running E2E Tests**:
```bash
cd demo
npm run test:e2e          # Run all 68 E2E tests
npm run test:e2e:ui       # Open Playwright UI (visual test runner)
npm run test:e2e:debug    # Debug mode with inspector
npm run test:e2e:report   # View HTML test report
```

**E2E Test Coverage** (68 tests across 8 suites):
- Page load validation and initial state
- File upload (EPUB/PDF, drag-and-drop, validation)
- API key management (security, persistence, visibility toggle)
- Processing pipeline (start, progress, phases, completion)
- Results view (downloads, state reset)
- Error scenarios (API errors, offline mode, retry, recovery)
- Mobile responsive (iPhone/Android viewports, touch interactions)
- Accessibility (WCAG 2.1 AA compliance with @axe-core/playwright)

**E2E Test Requirements**:
- E2E tests run in GitHub Actions CI/CD automatically
- Playwright browsers cannot be installed on Android/Termux
- For local development on standard systems: `npx playwright install --with-deps`
- All E2E tests must pass before demo deployment
- Mock API is used to avoid costs and rate limits

**When to Add E2E Tests**:
- When adding new demo features or UI components
- When modifying user flows (upload → process → download)
- When adding new error handling or edge cases
- When implementing mobile-specific features
- When updating accessibility features

See `demo/e2e/README.md` for detailed E2E testing documentation.

---

## Submitting Changes

### Before Submitting

1. **Build successfully**: `npm run build` completes without errors
2. **Tests pass**: `npm run test` shows 37/43+ passing
3. **No TypeScript errors**: Build output is clean
4. **Documentation updated**: If adding features, update README.md
5. **Commits are clean**: Use conventional commit messages

### Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear change history:

```bash
# Feature
git commit -m "feat: add character consistency tracking"

# Bug fix
git commit -m "fix: resolve memory leak in log buffer"

# Documentation
git commit -m "docs: update API examples in README"

# Refactor
git commit -m "refactor: simplify chapter processing logic"

# Tests
git commit -m "test: add integration tests for dashboard"

# Chore (deps, config, etc.)
git commit -m "chore: update dependencies to latest versions"
```

### Pull Request Process

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub
   - Use a clear, descriptive title
   - Reference any related issues (#123)
   - Describe what changed and why
   - Include test results if applicable

3. **PR Description Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Tests pass locally
   - [ ] Added new tests for changes
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows project style guidelines
   - [ ] Documentation updated
   - [ ] No TypeScript errors
   - [ ] Conventional commit messages used
   ```

4. **Code Review**: Address feedback promptly and update PR as needed

5. **Merge**: Once approved, maintainers will merge your PR

---

## Reporting Issues

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check documentation** (README.md, docs/)
3. **Verify you're using latest version**: `npm install imaginize@latest`

### Bug Reports

Use this template for bug reports:

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Run command: `imaginize --text --file book.epub`
2. Observe error message
3. ...

## Expected Behavior
What should happen

## Actual Behavior
What actually happened

## Environment
- imaginize version: `2.6.2`
- Node/Bun version: `node --version`
- OS: `Windows/Mac/Linux/Termux`
- API Provider: OpenRouter/OpenAI

## Error Output
```
Paste full error output here
```

## Additional Context
Any other relevant information
```

### Feature Requests

Use this template for feature requests:

```markdown
## Feature Description
Clear description of proposed feature

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Solution
How you envision this feature working

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Mockups, examples, or related issues
```

---

## Development Tips

### Quick Testing

Test CLI commands locally without publishing:

```bash
# Build and run
npm run build
npx . --help

# Or use direct path
node bin/imaginize.js --help
```

### Dashboard Development

The real-time dashboard uses React + Vite:

```bash
cd dashboard
npm install
npm run dev  # Start development server
npm run build  # Build for production
```

See `dashboard/README.md` for detailed dashboard development guide.

### Debugging

Enable verbose logging:

```bash
npx imaginize --verbose --text --file book.epub
```

Check generated files:
```bash
ls -la imaginize_BOOKNAME/
cat imaginize_BOOKNAME/progress.md
```

### Performance Profiling

Use concurrent mode for faster processing:

```bash
npx imaginize --concurrent --text --chapters 1-10 --file book.epub
```

Monitor with the dashboard:

```bash
npx imaginize --dashboard --concurrent --text --file book.epub
```

---

## Additional Resources

- **README.md**: User guide and feature overview
- **CHANGELOG.md**: Version history and breaking changes
- **WORKING.md**: Development journal with technical details
- **CONCURRENT_ARCHITECTURE.md**: Concurrent processing design
- **docs/**: Additional technical documentation

---

## Questions?

- **GitHub Issues**: https://github.com/tribixbite/imaginize/issues
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check README.md and docs/ folder

---

## License

By contributing to imaginize, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to imaginize! 🎨📚
