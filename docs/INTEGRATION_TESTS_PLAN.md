# Integration Tests Implementation Plan

**Priority**: 1 (Optional Enhancement)
**Estimated Time**: 3-5 days
**Status**: Planning
**Started**: 2025-11-13

---

## Objectives

Implement comprehensive integration tests for EPUB and PDF parsers to validate:
- Real-world file parsing with various formats
- Chapter extraction and TOC parsing
- Metadata handling
- Image extraction capabilities
- Error handling for malformed files
- Edge cases not covered by unit tests

---

## Test Structure

### Directory Layout

```
src/test/
├── integration/
│   ├── fixtures/
│   │   ├── epub/
│   │   │   ├── simple.epub          # Basic EPUB with minimal structure
│   │   │   ├── complex.epub         # EPUB with images, TOC, metadata
│   │   │   ├── no-toc.epub          # EPUB without table of contents
│   │   │   ├── malformed.epub       # Corrupted/invalid EPUB
│   │   │   └── README.md            # Fixture documentation
│   │   └── pdf/
│   │       ├── simple.pdf           # Basic PDF with text
│   │       ├── complex.pdf          # PDF with images, formatting
│   │       ├── scanned.pdf          # Scanned pages (image-based)
│   │       ├── malformed.pdf        # Corrupted/invalid PDF
│   │       └── README.md            # Fixture documentation
│   ├── epub-parser.integration.test.ts
│   └── pdf-parser.integration.test.ts
```

---

## EPUB Parser Integration Tests

### Test File: `epub-parser.integration.test.ts`

**Test Suites:**

1. **Basic EPUB Parsing**
   - Parse simple EPUB file
   - Extract chapter count
   - Extract total page count
   - Extract book title and author
   - Verify chapter text extraction

2. **Complex EPUB Features**
   - Parse EPUB with table of contents
   - Extract TOC structure
   - Parse EPUB with images
   - Handle nested chapters
   - Extract metadata (publisher, language, etc.)

3. **Edge Cases**
   - EPUB without TOC
   - EPUB with unusual chapter structure
   - Very large EPUB (100+ chapters)
   - EPUB with special characters in titles
   - Multiple author metadata

4. **Error Handling**
   - Malformed EPUB file
   - Missing content.opf
   - Corrupted ZIP structure
   - Invalid XML in manifest
   - Missing required files

**Expected Outcomes:**
- 25-30 integration tests
- ~400-500 lines of test code
- All real EPUB files successfully parsed
- Graceful error handling validated

---

## PDF Parser Integration Tests

### Test File: `pdf-parser.integration.test.ts`

**Test Suites:**

1. **Basic PDF Parsing**
   - Parse simple text-based PDF
   - Extract page count
   - Extract text content
   - Verify text extraction accuracy

2. **Complex PDF Features**
   - Parse PDF with table of contents
   - Extract TOC/outline structure
   - Handle multi-column layouts
   - Extract embedded fonts
   - Parse PDF metadata

3. **Edge Cases**
   - PDF without outline/bookmarks
   - Scanned PDF (image-based pages)
   - PDF with encryption (if supported)
   - Very large PDF (100+ pages)
   - PDF with complex formatting

4. **Error Handling**
   - Malformed PDF file
   - Corrupted PDF structure
   - Password-protected PDF
   - Unsupported PDF version
   - Empty PDF file

**Expected Outcomes:**
- 25-30 integration tests
- ~400-500 lines of test code
- All real PDF files successfully parsed
- Graceful error handling validated

---

## Test Fixtures Strategy

### Creating Test Fixtures

**Option 1: Generate Programmatically**
- Use libraries to create minimal valid EPUB/PDF files
- Pros: Reproducible, version-controlled
- Cons: May not represent real-world files

**Option 2: Use Real Files (Recommended)**
- Source public domain books from Project Gutenberg
- Create minimal test files manually
- Pros: Tests real-world scenarios
- Cons: Larger file sizes, licensing considerations

**Recommendation**: Hybrid approach
- Generate simple fixtures programmatically
- Use curated public domain files for complex cases
- Keep fixtures small (<100KB where possible)

### Fixture Documentation

Each fixture directory will have README.md documenting:
- File source (generated vs. sourced)
- Expected parsing results
- Special characteristics being tested
- Known limitations

---

## Implementation Phases

### Phase 1: Setup and Planning (Current)
- [x] Create implementation plan
- [ ] Create directory structure
- [ ] Document fixture requirements
- [ ] Research EPUB/PDF generation libraries

### Phase 2: Fixture Creation (Day 1)
- [ ] Generate simple EPUB fixture
- [ ] Generate simple PDF fixture
- [ ] Source complex EPUB from public domain
- [ ] Source complex PDF from public domain
- [ ] Create malformed test files
- [ ] Document all fixtures

### Phase 3: EPUB Integration Tests (Day 2)
- [ ] Implement basic parsing tests
- [ ] Implement complex feature tests
- [ ] Implement edge case tests
- [ ] Implement error handling tests
- [ ] Verify all tests pass

### Phase 4: PDF Integration Tests (Day 3)
- [ ] Implement basic parsing tests
- [ ] Implement complex feature tests
- [ ] Implement edge case tests
- [ ] Implement error handling tests
- [ ] Verify all tests pass

### Phase 5: CI/CD Integration (Day 4)
- [ ] Update CI workflow to run integration tests
- [ ] Handle fixtures in version control (Git LFS if needed)
- [ ] Ensure tests run in CI environment
- [ ] Verify performance (tests should run in <30s)

### Phase 6: Documentation and Cleanup (Day 5)
- [ ] Update CHANGELOG.md
- [ ] Update PROJECT_OVERVIEW.md test counts
- [ ] Create session documentation
- [ ] Update NEXT_STEPS.md (mark Priority 1 complete)

---

## Success Criteria

1. ✅ 50+ integration tests added (25 EPUB + 25 PDF)
2. ✅ All tests passing locally
3. ✅ All tests passing in CI
4. ✅ Test fixtures documented
5. ✅ <5MB total fixture size
6. ✅ <30 second test execution time
7. ✅ Error cases gracefully handled
8. ✅ Documentation updated

---

## Technical Considerations

### EPUB Generation Libraries
- **epub-gen**: Simple EPUB generation
- **foliate-js**: EPUB reading/parsing validation
- Manual ZIP + XML for minimal fixtures

### PDF Generation Libraries
- **pdf-lib**: Programmatic PDF creation
- **pdfkit**: PDF generation with text/images
- Manual specification for minimal fixtures

### File Size Management
- Keep individual fixtures <50KB where possible
- Use Git LFS for larger files if needed
- Consider excluding fixtures from npm package

### CI Performance
- Integration tests should run quickly (<30s)
- Consider parallel test execution
- Cache fixtures if possible

---

## Risks and Mitigation

**Risk**: Large binary files in git repository
- **Mitigation**: Keep fixtures minimal, use Git LFS if needed

**Risk**: Tests depend on external files
- **Mitigation**: Version control all fixtures, no external dependencies

**Risk**: Slow test execution
- **Mitigation**: Keep fixtures small, optimize parser code if needed

**Risk**: Platform-specific parsing differences
- **Mitigation**: Test on multiple platforms, document any quirks

---

## Future Enhancements

After initial integration tests:
- Performance benchmarking for large files
- Stress testing with 1000+ page books
- Automated fixture generation pipeline
- Visual comparison of extracted content
- Integration with actual AI processing pipeline

---

**Next Steps**: Begin Phase 2 (Fixture Creation)

**Status**: PLANNING COMPLETE - Ready for implementation
