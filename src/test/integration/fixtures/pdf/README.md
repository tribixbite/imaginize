# PDF Test Fixtures

Test fixtures for PDF parser integration tests.

## Files

### simple.pdf (1.8 KB)

**Source**: Programmatically generated
**Generator**: `scripts/generate-test-fixtures.ts`
**Created**: 2025-11-13
**Library**: pdf-lib v1.17.1

**Structure**:
- Valid PDF 1.7 format
- 3 pages with text content
- US Letter size (612 x 792 points)
- Times Roman and Times Bold fonts
- PDF metadata embedded

**Expected Parsing Results**:
- **Title**: "Simple Test Book" (from metadata)
- **Author**: "Test Author" (from metadata)
- **Pages**: 3
  - Page 1: Title page
  - Page 2: Chapter 1 content
  - Page 3: Chapter 2 content
- **Text Content**: Extractable via pdf-parse
- **Metadata**: Title, Author, Subject, Creator

**Test Coverage**:
- Basic PDF structure parsing
- Page count extraction
- Text extraction from pages
- Metadata parsing
- Multi-page document handling

**Known Limitations**:
- No images
- No complex layouts (single column)
- No bookmarks/outline
- Minimal formatting

---

## Future Fixtures

Planned additions:
- `complex.pdf` - PDF with images, TOC/bookmarks, multi-column layout
- `scanned.pdf` - Image-based PDF (scanned pages)
- `malformed.pdf` - Corrupted PDF for error handling tests
