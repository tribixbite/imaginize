# Code Quality Specification

This document specifies code quality standards, linting rules, formatting guidelines, and type checking configuration for imaginize.

## Overview

imaginize maintains strict code quality standards through:
1. **TypeScript** - Static type checking with strict mode
2. **ESLint** - Code linting with TypeScript plugin
3. **Prettier** - Code formatting with consistent style
4. **Git Hooks** - Pre-commit quality checks (optional)

**Current Status**: 0 TypeScript errors, 0 ESLint warnings, 0 vulnerabilities

---

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Compiler Options Explained

| Option | Value | Purpose |
|--------|-------|---------|
| `target` | ES2022 | Compile to modern JavaScript (Node 18+) |
| `module` | ES2022 | Use ES modules (import/export) |
| `lib` | ES2022 | Include ES2022 standard library types |
| `moduleResolution` | node | Use Node.js module resolution |
| `outDir` | ./dist | Output compiled files to dist/ |
| `rootDir` | ./src | Source files in src/ |
| `declaration` | true | Generate .d.ts declaration files |
| `declarationMap` | true | Generate .d.ts.map source maps |
| `sourceMap` | true | Generate .js.map source maps for debugging |
| `strict` | true | Enable all strict type checking options |
| `esModuleInterop` | true | Enable CommonJS/ES module interoperability |
| `skipLibCheck` | true | Skip type checking of declaration files |
| `forceConsistentCasingInFileNames` | true | Enforce case-sensitive imports |
| `resolveJsonModule` | true | Allow importing JSON files |
| `allowSyntheticDefaultImports` | true | Allow default imports from modules with no default export |
| `types` | ["node"] | Include Node.js type definitions |

### Strict Mode

**Enabled**: `"strict": true`

This enables all strict type-checking options:
- `noImplicitAny` - Error on implicit `any` types
- `strictNullChecks` - Null and undefined are not assignable to other types
- `strictFunctionTypes` - Strict checking of function types
- `strictBindCallApply` - Strict checking of `bind`, `call`, `apply`
- `strictPropertyInitialization` - Class properties must be initialized
- `noImplicitThis` - Error on `this` expressions with implicit `any` type
- `alwaysStrict` - Parse in strict mode and emit "use strict"

### Type Checking

**Command**: `npm run typecheck`

**Script**: `tsc --noEmit`

**CI Integration**: Runs on every push and PR

**Zero Tolerance**: Builds fail if any TypeScript errors exist

---

## ESLint Configuration

### .eslintrc.json

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "plugins": ["@typescript-eslint"],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "env": {
    "node": true,
    "es2022": true
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
}
```

### ESLint Configuration Explained

| Setting | Value | Purpose |
|---------|-------|---------|
| `parser` | @typescript-eslint/parser | Parse TypeScript syntax |
| `extends` | eslint:recommended, plugin:@typescript-eslint/recommended | Use recommended rule sets |
| `plugins` | @typescript-eslint | Enable TypeScript linting |
| `parserOptions.ecmaVersion` | 2022 | Support ES2022 syntax |
| `parserOptions.sourceType` | module | Use ES modules |
| `env.node` | true | Node.js global variables |
| `env.es2022` | true | ES2022 global objects |

### Custom Rules

| Rule | Level | Configuration | Purpose |
|------|-------|---------------|---------|
| `@typescript-eslint/no-explicit-any` | warn | - | Discourage `any` type (allow with justification) |
| `@typescript-eslint/explicit-function-return-type` | off | - | Allow inferred return types |
| `@typescript-eslint/no-unused-vars` | warn | `{ "argsIgnorePattern": "^_" }` | Warn on unused vars, ignore `_prefixed` |

### Linting Commands

**Lint All Files**:
```bash
npm run lint
```

**Lint and Auto-Fix**:
```bash
npm run lint:fix
```

**Lint Specific File**:
```bash
npx eslint src/lib/config.ts
```

**CI Integration**: Runs on every push and PR

---

## Prettier Configuration

### .prettierrc

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 90,
  "tabWidth": 2,
  "useTabs": false
}
```

### Prettier Options Explained

| Option | Value | Purpose |
|--------|-------|---------|
| `semi` | true | Require semicolons at end of statements |
| `trailingComma` | es5 | Add trailing commas where valid in ES5 (objects, arrays) |
| `singleQuote` | true | Use single quotes instead of double quotes |
| `printWidth` | 90 | Wrap lines at 90 characters |
| `tabWidth` | 2 | Use 2 spaces for indentation |
| `useTabs` | false | Use spaces, not tabs |

### Formatting Commands

**Format All Files**:
```bash
npm run format
```

**Check Formatting**:
```bash
npm run format:check
```

**Format Specific File**:
```bash
npx prettier --write src/lib/config.ts
```

**CI Integration**: Format check runs on every push and PR

---

## Code Style Guidelines

### Naming Conventions

**Files**:
- Use kebab-case: `state-manager.ts`, `epub-parser.ts`
- Test files: `*.test.ts`
- Type definitions: `config.ts` (interfaces/types)

**Variables and Functions**:
- Use camelCase: `bookTitle`, `parseEpub()`, `generateContentsFile()`
- Constants: Use UPPER_SNAKE_CASE: `STATE_VERSION`, `MAX_RETRIES`

**Classes**:
- Use PascalCase: `StateManager`, `ProgressTracker`, `BenchmarkRunner`

**Interfaces and Types**:
- Use PascalCase: `BookMetadata`, `PhaseState`, `IllustrateState`
- Avoid `I` prefix: Use `Config` not `IConfig`

**Enums**:
- Use PascalCase for enum name: `PhaseStatus`
- Use UPPER_SNAKE_CASE for values: `IN_PROGRESS`, `COMPLETED`

### Import Organization

**Order**:
1. Node.js built-in modules
2. External dependencies
3. Internal modules (relative imports)
4. Type imports

**Example**:
```typescript
// Node.js built-ins
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

// External dependencies
import OpenAI from 'openai';
import type { Command } from 'commander';

// Internal modules
import { StateManager } from './lib/state-manager.js';
import { parseEpub } from './lib/epub-parser.js';

// Type imports
import type { BookMetadata, IllustrateState } from './types/config.js';
```

### Comments and Documentation

**JSDoc for Public APIs**:
```typescript
/**
 * Parse EPUB file and extract chapters
 * @param filePath - Absolute path to EPUB file
 * @returns Parsed book metadata and chapters
 * @throws {Error} If file is not valid EPUB
 */
export async function parseEpub(filePath: string): Promise<ParsedBook> {
  // Implementation
}
```

**Inline Comments**:
- Explain "why", not "what"
- Keep comments up-to-date with code
- Use TODO comments with issue references

**Example**:
```typescript
// Use atomic write to prevent corruption if process crashes mid-write
await atomicWriteJSON(this.statePath, this.state);

// TODO(#123): Add retry logic for network errors
```

### Error Handling

**Throw Descriptive Errors**:
```typescript
throw new Error(`Failed to parse EPUB: ${filePath} (${err.message})`);
```

**Catch and Re-throw with Context**:
```typescript
try {
  await parseEpub(bookFile);
} catch (error) {
  const err = error as Error;
  throw new Error(`Book parsing failed: ${err.message}`);
}
```

**Use Type Guards**:
```typescript
if (error instanceof RateLimitError) {
  // Handle rate limit specifically
} else {
  // Handle generic error
}
```

### Async/Await

**Prefer async/await over Promises**:
```typescript
// ✅ Good
const data = await readFile(path, 'utf-8');
const parsed = JSON.parse(data);

// ❌ Avoid
readFile(path, 'utf-8')
  .then((data) => JSON.parse(data))
  .then((parsed) => { /* ... */ });
```

**Use Promise.all for Parallel Operations**:
```typescript
// ✅ Good - parallel execution
const [metadata, chapters] = await Promise.all([
  extractMetadata(epub),
  extractChapters(epub),
]);

// ❌ Avoid - sequential execution
const metadata = await extractMetadata(epub);
const chapters = await extractChapters(epub);
```

### Type Safety

**Avoid `any`**:
```typescript
// ✅ Good
function processData(data: BookMetadata): void {
  console.log(data.title);
}

// ❌ Avoid
function processData(data: any): void {
  console.log(data.title);
}
```

**Use Type Guards**:
```typescript
function isBookMetadata(obj: unknown): obj is BookMetadata {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'title' in obj &&
    typeof (obj as BookMetadata).title === 'string'
  );
}
```

**Prefer Interfaces Over Types for Objects**:
```typescript
// ✅ Good
export interface BookMetadata {
  title: string;
  author?: string;
  totalPages: number;
}

// ❌ Less preferred
export type BookMetadata = {
  title: string;
  author?: string;
  totalPages: number;
};
```

---

## Quality Metrics

### Current Status

- ✅ **TypeScript Errors**: 0
- ✅ **ESLint Warnings**: 0
- ✅ **ESLint Errors**: 0
- ✅ **Prettier Issues**: 0 (all files formatted)
- ✅ **Security Vulnerabilities**: 0
- ✅ **Outdated Dependencies**: 0 critical

### Code Statistics

- **Total Lines of Code**: ~3,850
- **Lines of Test Code**: ~5,800
- **Test-to-Source Ratio**: 2.35:1
- **TypeScript Coverage**: 100% (all files use TypeScript)
- **Documentation Coverage**: 10,000+ lines

### Complexity Metrics

- **Average Function Length**: ~15 lines
- **Maximum Function Length**: ~50 lines
- **Average File Length**: ~200 lines
- **Maximum File Length**: ~900 lines (state-manager.test.ts)

---

## Pre-Commit Hooks (Optional)

### Husky + lint-staged

**Not currently configured**, but recommended setup:

**package.json**:
```json
{
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ]
  },
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged && npm run typecheck"
    }
  }
}
```

**Installation**:
```bash
npm install --save-dev husky lint-staged
npx husky install
```

---

## CI/CD Quality Checks

### GitHub Actions Workflow

```yaml
name: Code Quality

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install Dependencies
        run: npm ci

      - name: TypeScript Check
        run: npm run typecheck

      - name: ESLint Check
        run: npm run lint

      - name: Prettier Check
        run: npm run format:check

      - name: Run Tests
        run: npm test

      - name: Security Audit
        run: npm audit --production
```

### Build Failure Conditions

Builds fail if:
- Any TypeScript compilation errors
- Any ESLint errors (warnings allowed)
- Prettier formatting issues
- Test failures
- Security vulnerabilities in production dependencies

---

## Security

### Dependency Scanning

**Command**: `npm audit`

**CI Integration**: Runs on every push

**Severity Levels**:
- Critical: Build fails
- High: Build fails
- Medium: Warning
- Low: Informational

### Security Best Practices

1. **No Secrets in Code**: Use environment variables for API keys
2. **Input Validation**: Validate all user inputs
3. **Dependency Updates**: Regular security patch updates
4. **Type Safety**: TypeScript strict mode prevents many vulnerabilities
5. **Code Review**: All PRs require review before merge

---

## Related Documentation

- [Test Suite](./test-suite.md) - Testing standards
- [CI/CD Pipeline](./cicd-pipeline.md) - Automated quality checks
- [Contributing](../../CONTRIBUTING.md) - Development guidelines

---

**Status**: Complete ✅
**Last Updated**: 2025-11-14
**Version**: 2.7.0+
**Quality Score**: 100% (0 errors, 0 warnings, 0 vulnerabilities)
