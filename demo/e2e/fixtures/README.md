# E2E Test Fixtures

Test files for Playwright E2E tests of the imaginize GitHub Pages demo.

## Files

### sample.epub (2.0 KB)

**Source**: Copied from `src/test/integration/fixtures/epub/simple.epub`

**Format**: EPUB 3.0

**Contents**:
- **Title**: "Simple Test Book"
- **Author**: "Test Author"
- **Language**: en
- **Chapters**: 2
  - Chapter 1: "The Beginning"
  - Chapter 2: "The Middle"

**Expected Parsing Results**:
- Metadata extraction: title, author, language
- 2 chapters with valid content
- XHTML content properly processed
- No HTML tags in extracted text

**Use Cases**:
- File upload validation
- EPUB parsing tests
- Processing flow tests
- Results validation

---

### sample.pdf (1.8 KB)

**Source**: Copied from `src/test/integration/fixtures/pdf/simple.pdf`

**Format**: PDF 1.7

**Contents**:
- **Title**: "Simple Test Book"
- **Author**: "Test Author"
- **Pages**: 3
  - Page 1: Title page
  - Page 2: Chapter 1 "The Beginning"
  - Page 3: Chapter 2 "The Middle"

**Expected Parsing Results**:
- Metadata extraction: title, author, totalPages
- Text extraction from all pages
- Chapter content properly separated
- Multi-page handling validated

**Use Cases**:
- File upload validation
- PDF parsing tests
- Processing flow tests
- Results validation

---

## Generation

These fixtures are programmatically generated using:
- **EPUB**: AdmZip library (creates valid EPUB 3.0 structure)
- **PDF**: pdf-lib library (creates valid PDF 1.7 documents)

To regenerate fixtures, run:
```bash
# From repository root
bun run scripts/generate-test-fixtures.ts
# Then copy to demo/e2e/fixtures/
cp src/test/integration/fixtures/epub/simple.epub demo/e2e/fixtures/sample.epub
cp src/test/integration/fixtures/pdf/simple.pdf demo/e2e/fixtures/sample.pdf
```

## Notes

- **Small Size**: Fixtures are intentionally small (< 5KB total) for fast test execution
- **Version Control**: Binary files are committed to ensure test reproducibility
- **Validity**: All fixtures are spec-compliant and parse correctly in browsers
- **Realism**: Fixtures contain realistic book structure (metadata, chapters, content)

## Usage in Tests

```typescript
import { test } from '@playwright/test';
import path from 'path';

test('upload EPUB file', async ({ page }) => {
  const filePath = path.join(__dirname, '../fixtures/sample.epub');
  await page.setInputFiles('input[type="file"]', filePath);
  // ... test continues
});
```
