#!/usr/bin/env bun
/**
 * Generate minimal test fixtures for integration tests
 * Creates simple EPUB and PDF files for parser testing
 */

import AdmZip from 'adm-zip';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const fixturesDir = join(process.cwd(), 'src', 'test', 'integration', 'fixtures');

/**
 * Generate a minimal valid EPUB file
 */
async function generateSimpleEpub() {
  const zip = new AdmZip();

  // mimetype file (must be first, uncompressed)
  zip.addFile('mimetype', Buffer.from('application/epub+zip'), '', 0);

  // META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.addFile('META-INF/container.xml', Buffer.from(containerXml));

  // OEBPS/content.opf
  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">simple-test-book-001</dc:identifier>
    <dc:title>Simple Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2025-11-13T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`;
  zip.addFile('OEBPS/content.opf', Buffer.from(contentOpf));

  // OEBPS/nav.xhtml (navigation document)
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="chapter1.xhtml">Chapter 1: The Beginning</a></li>
      <li><a href="chapter2.xhtml">Chapter 2: The Middle</a></li>
    </ol>
  </nav>
</body>
</html>`;
  zip.addFile('OEBPS/nav.xhtml', Buffer.from(navXhtml));

  // OEBPS/chapter1.xhtml
  const chapter1 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1: The Beginning</title>
</head>
<body>
  <h1>Chapter 1: The Beginning</h1>
  <p>This is the first chapter of the test book. It contains some sample text to test the EPUB parser.</p>
  <p>The parser should extract this text correctly and identify this as Chapter 1.</p>
  <p>This chapter has multiple paragraphs to test paragraph extraction.</p>
</body>
</html>`;
  zip.addFile('OEBPS/chapter1.xhtml', Buffer.from(chapter1));

  // OEBPS/chapter2.xhtml
  const chapter2 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 2: The Middle</title>
</head>
<body>
  <h1>Chapter 2: The Middle</h1>
  <p>This is the second chapter. It should be parsed as a separate chapter.</p>
  <p>Chapter 2 contains different content from Chapter 1.</p>
</body>
</html>`;
  zip.addFile('OEBPS/chapter2.xhtml', Buffer.from(chapter2));

  // Save EPUB file
  const epubPath = join(fixturesDir, 'epub', 'simple.epub');
  zip.writeZip(epubPath);

  console.log(`✓ Created simple.epub (${zip.toBuffer().length} bytes)`);
}

/**
 * Generate a minimal valid PDF file
 */
async function generateSimplePdf() {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // Page 1
  const page1 = pdfDoc.addPage([612, 792]); // US Letter size
  const { width, height } = page1.getSize();

  page1.drawText('Simple Test Book', {
    x: 50,
    y: height - 50,
    size: 24,
    font: timesBoldFont,
    color: rgb(0, 0, 0),
  });

  page1.drawText('by Test Author', {
    x: 50,
    y: height - 80,
    size: 14,
    font: timesRomanFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Page 2 - Chapter 1
  const page2 = pdfDoc.addPage([612, 792]);

  page2.drawText('Chapter 1: The Beginning', {
    x: 50,
    y: height - 50,
    size: 18,
    font: timesBoldFont,
    color: rgb(0, 0, 0),
  });

  page2.drawText('This is the first chapter of the test book. It contains some sample text', {
    x: 50,
    y: height - 100,
    size: 12,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page2.drawText('to test the PDF parser. The parser should extract this text correctly', {
    x: 50,
    y: height - 120,
    size: 12,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page2.drawText('and identify this as Chapter 1.', {
    x: 50,
    y: height - 140,
    size: 12,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  // Page 3 - Chapter 2
  const page3 = pdfDoc.addPage([612, 792]);

  page3.drawText('Chapter 2: The Middle', {
    x: 50,
    y: height - 50,
    size: 18,
    font: timesBoldFont,
    color: rgb(0, 0, 0),
  });

  page3.drawText('This is the second chapter. It should be parsed as a separate chapter.', {
    x: 50,
    y: height - 100,
    size: 12,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page3.drawText('Chapter 2 contains different content from Chapter 1.', {
    x: 50,
    y: height - 120,
    size: 12,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  // Set PDF metadata
  pdfDoc.setTitle('Simple Test Book');
  pdfDoc.setAuthor('Test Author');
  pdfDoc.setSubject('Integration test fixture');
  pdfDoc.setCreator('imaginize test fixture generator');

  // Save PDF file
  const pdfBytes = await pdfDoc.save();
  const pdfPath = join(fixturesDir, 'pdf', 'simple.pdf');
  writeFileSync(pdfPath, pdfBytes);

  console.log(`✓ Created simple.pdf (${pdfBytes.length} bytes)`);
}

/**
 * Main function
 */
async function main() {
  console.log('Generating test fixtures...\n');

  try {
    await generateSimpleEpub();
    await generateSimplePdf();

    console.log('\n✓ All fixtures generated successfully');
    console.log(
      '\nNext steps:\n  1. Verify fixtures can be parsed\n  2. Create fixture documentation\n  3. Implement integration tests'
    );
  } catch (error) {
    console.error('Error generating fixtures:', error);
    process.exit(1);
  }
}

main();
