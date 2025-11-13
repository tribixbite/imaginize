# EPUB Test Fixtures

Test fixtures for EPUB parser integration tests.

## Files

### simple.epub (2.0 KB)

**Source**: Programmatically generated
**Generator**: `scripts/generate-test-fixtures.ts`
**Created**: 2025-11-13

**Structure**:
- Valid EPUB 3.0 format
- 2 chapters with simple text content
- Navigation document (TOC)
- Minimal metadata

**Expected Parsing Results**:
- **Title**: "Simple Test Book"
- **Author**: "Test Author"
- **Chapters**: 2
  - Chapter 1: "The Beginning" (3 paragraphs)
  - Chapter 2: "The Middle" (2 paragraphs)
- **Language**: en
- **Total Pages**: ~2 (varies by renderer)

**Test Coverage**:
- Basic EPUB structure parsing
- Chapter extraction
- TOC/navigation parsing
- Metadata extraction (title, author, language)
- XHTML content extraction

**Known Limitations**:
- No images
- No complex formatting
- Minimal CSS
- No nested TOC structure

---

## Future Fixtures

Planned additions:
- `complex.epub` - EPUB with images, nested TOC, rich metadata
- `no-toc.epub` - EPUB without navigation document
- `malformed.epub` - Corrupted EPUB for error handling tests
