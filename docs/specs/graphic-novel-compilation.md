# Graphic Novel Compilation Specification

## Overview

imaginize can compile all generated images into a professional graphic novel PDF with styled captions, table of contents, and element glossary. This feature transforms the collection of chapter images into a cohesive, publishable document.

## Architecture

```
Compilation Pipeline:
─────────────────────────────────────────────────────────────
Input:
  ├─ output/images/*.png          # All generated images
  ├─ output/Contents.md           # Chapter list and page numbers
  ├─ output/Elements.md           # Characters, places, items catalog
  └─ output/.concepts.json        # Image concepts with titles/descriptions

Processing:
  ├─ 1. Load all images and metadata
  ├─ 2. Analyze image backgrounds for caption color
  ├─ 3. Generate PDF with layout engine
  ├─ 4. Add styled captions to each image
  ├─ 5. Generate table of contents with page refs
  └─ 6. Generate glossary with page refs

Output:
  └─ output/graphic-novel.pdf     # Complete graphic novel PDF
```

## Configuration

### CLI Command

```bash
imaginize compile [options]

Options:
  --input <dir>           Input directory (default: current dir's output/)
  --output <file>         Output PDF path (default: graphic-novel.pdf)
  --layout <layout>       Images per page (default: 4x1)
  --caption-style <style> Caption styling (default: modern)
  --include-toc           Include table of contents (default: true)
  --include-glossary      Include elements glossary (default: true)
  --page-numbers          Show page numbers (default: true)
  --title <title>         Book title for cover page
```

### Layout Options

#### `4x1` - Four Vertical Panels (Default)
```
┌─────────────────────────┐
│      Image 1            │
├─────────────────────────┤
│      Image 2            │
├─────────────────────────┤
│      Image 3            │
├─────────────────────────┤
│      Image 4            │
└─────────────────────────┘
```
- Best for narrative flow
- Easy reading top-to-bottom
- Standard graphic novel format

#### `2x2` - Grid Layout
```
┌───────────┬───────────┐
│  Image 1  │  Image 2  │
├───────────┼───────────┤
│  Image 3  │  Image 4  │
└───────────┴───────────┘
```
- Balanced, magazine-style
- Good for scene comparisons

#### `1x1` - Full Page
```
┌─────────────────────────┐
│                         │
│      Image 1            │
│                         │
└─────────────────────────┘
```
- Maximum image size
- Best for high-detail art
- Most immersive

#### `6x2` - Dense Layout
```
┌──────┬──────┬──────┐
│ Img1 │ Img2 │ Img3 │
├──────┼──────┼──────┤
│ Img4 │ Img5 │ Img6 │
└──────┴──────┴──────┘
```
- Maximum images per page
- Compact reference format

### Caption Styles

#### `modern` (Default)
```
Image: [          Centered Caption Text          ]
       ╚══════════════════════════════════════════╝
       Semi-transparent black background (#000000AA)
       White text with shadow
       Sans-serif font (Helvetica)
```

#### `classic`
```
Image: [    Serif Caption with Border    ]
       ╔══════════════════════════════════╗
       ║  Centered Caption Text           ║
       ╚══════════════════════════════════╝
       White background with border
       Black text
       Serif font (Times)
```

#### `minimal`
```
Image: Centered Caption Text (no background)
       Auto-contrast text color based on image
       Clean, distraction-free
```

#### `none`
```
No captions on images
```

## Implementation

### 1. PDF Generation Library

**Choice**: `pdf-lib` (https://pdf-lib.js.org/)

**Rationale**:
- Pure JavaScript (no native dependencies)
- Modern async/await API
- Excellent image embedding support
- Can draw text, shapes, and overlays
- Active maintenance, 6.5k+ stars
- Works in Node.js and browsers
- MIT licensed

**Installation**:
```bash
npm install pdf-lib
```

### 2. Image Analysis Library

**Choice**: `sharp` (https://sharp.pixelplumbing.com/)

**Rationale**:
- Fast image processing (libvips)
- Can extract dominant colors from regions
- Widely used, 28k+ stars
- Supports PNG, JPEG, WebP, etc.
- Excellent performance

**Installation**:
```bash
npm install sharp
```

### 3. Core Modules

#### `src/lib/compiler/pdf-generator.ts`

```typescript
import { PDFDocument, rgb, PDFPage } from 'pdf-lib';
import { readFile } from 'fs/promises';

export interface CompilationOptions {
  inputDir: string;
  outputPath: string;
  layout: '4x1' | '2x2' | '1x1' | '6x2';
  captionStyle: 'modern' | 'classic' | 'minimal' | 'none';
  includeToc: boolean;
  includeGlossary: boolean;
  pageNumbers: boolean;
  bookTitle?: string;
}

export interface ImageMetadata {
  path: string;
  concept: {
    chapter: string;
    chapterNumber: number;
    description: string;
    quote: string;
  };
  captionColor: { r: number; g: number; b: number };
  backgroundColor: { r: number; g: number; b: number };
}

export class GraphicNovelCompiler {
  private pdfDoc?: PDFDocument;
  private options: CompilationOptions;

  constructor(options: CompilationOptions) {
    this.options = options;
  }

  /**
   * Main compilation entry point
   */
  async compile(): Promise<void> {
    // 1. Initialize PDF document
    this.pdfDoc = await PDFDocument.create();

    // 2. Load all images and metadata
    const images = await this.loadImages();

    // 3. Analyze images for caption colors
    const analyzed = await this.analyzeImages(images);

    // 4. Generate cover page (if title provided)
    if (this.options.bookTitle) {
      await this.generateCoverPage();
    }

    // 5. Generate table of contents (if enabled)
    if (this.options.includeToc) {
      await this.generateTableOfContents(analyzed);
    }

    // 6. Generate image pages with captions
    await this.generateImagePages(analyzed);

    // 7. Generate glossary (if enabled)
    if (this.options.includeGlossary) {
      await this.generateGlossary(analyzed);
    }

    // 8. Save PDF
    await this.savePDF();
  }

  /**
   * Load all images from output directory
   */
  private async loadImages(): Promise<ImageMetadata[]> {
    // Read .concepts.json
    // Match with image files
    // Return metadata array
  }

  /**
   * Analyze images for background colors
   */
  private async analyzeImages(
    images: ImageMetadata[]
  ): Promise<ImageMetadata[]> {
    // Use sharp to extract dominant color from bottom 10% of each image
    // Determine optimal caption text color (black or white)
    // Return enriched metadata
  }

  /**
   * Generate cover page
   */
  private async generateCoverPage(): Promise<void> {
    // Create title page with book title
    // Center aligned, large font
    // "Generated with imaginize" subtitle
  }

  /**
   * Generate table of contents
   */
  private async generateTableOfContents(
    images: ImageMetadata[]
  ): Promise<void> {
    // Group images by chapter
    // List chapters with page numbers
    // Clickable links to pages (PDF internal links)
  }

  /**
   * Generate image pages with layout and captions
   */
  private async generateImagePages(
    images: ImageMetadata[]
  ): Promise<void> {
    // Calculate layout grid based on this.options.layout
    // Batch images according to layout (4 per page for 4x1, etc.)
    // For each page:
    //   - Add images to grid positions
    //   - Add captions with smart color
    //   - Add page numbers (if enabled)
  }

  /**
   * Generate elements glossary
   */
  private async generateGlossary(
    images: ImageMetadata[]
  ): Promise<void> {
    // Read Elements.md
    // Extract characters, creatures, places, items
    // For each element, list pages where it appears
    // Alphabetically sorted sections
  }

  /**
   * Save PDF to disk
   */
  private async savePDF(): Promise<void> {
    const pdfBytes = await this.pdfDoc!.saveAsBase64();
    // Write to this.options.outputPath
  }
}
```

#### `src/lib/compiler/image-analyzer.ts`

```typescript
import sharp from 'sharp';

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface ImageAnalysis {
  dominantColor: ColorRGB;
  brightness: number;
  recommendedTextColor: ColorRGB;
}

/**
 * Analyze image to determine optimal caption styling
 */
export class ImageAnalyzer {
  /**
   * Analyze bottom portion of image for caption overlay
   */
  async analyzeForCaption(imagePath: string): Promise<ImageAnalysis> {
    // Load image with sharp
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error(`Cannot read image metadata: ${imagePath}`);
    }

    // Extract bottom 10% for caption area
    const captionHeight = Math.floor(metadata.height * 0.1);
    const captionRegion = await image
      .extract({
        left: 0,
        top: metadata.height - captionHeight,
        width: metadata.width,
        height: captionHeight,
      })
      .raw()
      .toBuffer();

    // Calculate dominant color
    const dominantColor = this.calculateDominantColor(captionRegion);

    // Calculate brightness (0-255)
    const brightness = this.calculateBrightness(dominantColor);

    // Determine text color (white for dark backgrounds, black for light)
    const recommendedTextColor =
      brightness < 128
        ? { r: 255, g: 255, b: 255 } // White text
        : { r: 0, g: 0, b: 0 }; // Black text

    return {
      dominantColor,
      brightness,
      recommendedTextColor,
    };
  }

  /**
   * Calculate dominant color from raw pixel buffer
   */
  private calculateDominantColor(buffer: Buffer): ColorRGB {
    let r = 0,
      g = 0,
      b = 0;
    const pixelCount = buffer.length / 3;

    for (let i = 0; i < buffer.length; i += 3) {
      r += buffer[i];
      g += buffer[i + 1];
      b += buffer[i + 2];
    }

    return {
      r: Math.floor(r / pixelCount),
      g: Math.floor(g / pixelCount),
      b: Math.floor(b / pixelCount),
    };
  }

  /**
   * Calculate brightness using perceived luminance formula
   */
  private calculateBrightness(color: ColorRGB): number {
    // Perceived luminance: 0.299*R + 0.587*G + 0.114*B
    return Math.floor(0.299 * color.r + 0.587 * color.g + 0.114 * color.b);
  }
}
```

#### `src/lib/compiler/caption-renderer.ts`

```typescript
import { PDFPage, rgb, PDFFont } from 'pdf-lib';
import type { ColorRGB } from './image-analyzer.js';

export interface CaptionOptions {
  text: string;
  style: 'modern' | 'classic' | 'minimal' | 'none';
  textColor: ColorRGB;
  backgroundColor?: ColorRGB;
  position: { x: number; y: number; width: number };
}

/**
 * Render styled captions on PDF pages
 */
export class CaptionRenderer {
  /**
   * Render caption on page at specified position
   */
  renderCaption(
    page: PDFPage,
    font: PDFFont,
    options: CaptionOptions
  ): void {
    if (options.style === 'none') return;

    const { x, y, width } = options.position;
    const fontSize = 12;
    const padding = 8;

    // Calculate text dimensions
    const textWidth = font.widthOfTextAtSize(options.text, fontSize);
    const textX = x + (width - textWidth) / 2; // Center align
    const textY = y + padding;

    if (options.style === 'modern') {
      // Semi-transparent background
      page.drawRectangle({
        x,
        y,
        width,
        height: fontSize + padding * 2,
        color: rgb(0, 0, 0),
        opacity: 0.7,
      });

      // White text with shadow effect
      page.drawText(options.text, {
        x: textX + 1,
        y: textY + 1,
        size: fontSize,
        font,
        color: rgb(0, 0, 0), // Shadow
        opacity: 0.5,
      });

      page.drawText(options.text, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(1, 1, 1), // White text
      });
    } else if (options.style === 'classic') {
      // White background with border
      page.drawRectangle({
        x,
        y,
        width,
        height: fontSize + padding * 2,
        color: rgb(1, 1, 1),
        borderColor: rgb(0, 0, 0),
        borderWidth: 2,
      });

      // Black text
      page.drawText(options.text, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    } else if (options.style === 'minimal') {
      // No background, just text with auto-contrast color
      const c = options.textColor;
      page.drawText(options.text, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(c.r / 255, c.g / 255, c.b / 255),
      });
    }
  }
}
```

### 4. CLI Integration

Modify **`src/index.ts`** to add `compile` command:

```typescript
program
  .command('compile')
  .description('Compile images into graphic novel PDF')
  .option('--input <dir>', 'Input directory', './output')
  .option('--output <file>', 'Output PDF path', 'graphic-novel.pdf')
  .option(
    '--layout <layout>',
    'Images per page (4x1, 2x2, 1x1, 6x2)',
    '4x1'
  )
  .option(
    '--caption-style <style>',
    'Caption styling (modern, classic, minimal, none)',
    'modern'
  )
  .option('--no-toc', 'Exclude table of contents')
  .option('--no-glossary', 'Exclude elements glossary')
  .option('--no-page-numbers', 'Hide page numbers')
  .option('--title <title>', 'Book title for cover page')
  .action(async (options) => {
    const compiler = new GraphicNovelCompiler({
      inputDir: options.input,
      outputPath: options.output,
      layout: options.layout,
      captionStyle: options.captionStyle,
      includeToc: options.toc !== false,
      includeGlossary: options.glossary !== false,
      pageNumbers: options.pageNumbers !== false,
      bookTitle: options.title,
    });

    await compiler.compile();
  });
```

## File Formats

### Input: `.concepts.json`

```json
[
  {
    "chapter": "Chapter 1: The Beginning",
    "chapterNumber": 1,
    "pageRange": "1-15",
    "quote": "It was a dark and stormy night...",
    "description": "Dark stormy castle on cliff",
    "imageUrl": "chapter-1-scene-1.png"
  }
]
```

### Output: PDF Structure

```
graphic-novel.pdf
├─ Page 1: Cover (optional)
├─ Pages 2-3: Table of Contents
├─ Pages 4-25: Image Pages (4 images per page)
│  ├─ Each image with styled caption
│  └─ Page numbers in footer
└─ Pages 26-28: Glossary
   ├─ Characters (with page refs)
   ├─ Creatures (with page refs)
   ├─ Places (with page refs)
   └─ Items (with page refs)
```

## Usage Examples

### Basic Compilation

```bash
cd my-book/output
imaginize compile
# Creates graphic-novel.pdf with default settings
```

### Full Page Layout with Classic Captions

```bash
imaginize compile \
  --layout 1x1 \
  --caption-style classic \
  --title "The Great Adventure"
```

### Dense Reference Format

```bash
imaginize compile \
  --layout 6x2 \
  --caption-style minimal \
  --no-toc
```

### Minimal PDF (Images Only)

```bash
imaginize compile \
  --caption-style none \
  --no-toc \
  --no-glossary \
  --no-page-numbers
```

## Performance Considerations

### Image Processing
- **sharp** operations are fast (~10-20ms per image)
- Batch processing: 100 images analyzed in <2 seconds
- Memory efficient (streaming pipeline)

### PDF Generation
- **pdf-lib** is pure JavaScript (no native deps)
- Memory usage: ~50MB for 100-page PDF
- Generation time: ~5-10 seconds for 100 images

### Disk Space
- Input images: ~100MB (100 images at 1MB each)
- Output PDF: ~80MB (embedded images, slightly compressed)
- Temporary files: None (in-memory processing)

## Testing Strategy

### Unit Tests
- Caption color detection (light vs dark backgrounds)
- Layout grid calculations (4x1, 2x2, etc.)
- Text centering and positioning
- TOC generation and page numbering

### Integration Tests
- Full compilation workflow
- All layout options
- All caption styles
- TOC and glossary generation

### Manual Tests
- Real book with 20+ images
- Verify caption readability
- Check TOC links work
- Validate glossary page refs

## Future Enhancements

### Interactive PDF Features
- Clickable glossary entries (jump to first appearance)
- Image zoom annotations
- Searchable text layer

### Advanced Layouts
- Custom grid patterns (e.g., 3x1, 5x2)
- Mixed layouts (full page for key scenes, 4x1 for others)
- Panel borders and gutters customization

### Caption Enhancements
- Multi-line text wrapping
- Character dialogue vs narration styling
- Custom fonts from system

### Export Formats
- EPUB with embedded images
- CBZ/CBR comic book formats
- HTML flipbook

## Dependencies

```json
{
  "dependencies": {
    "pdf-lib": "^1.17.1",
    "sharp": "^0.33.0"
  }
}
```

## Summary

Graphic novel compilation transforms generated images into a polished, publishable PDF:
- ✅ Professional layouts (4x1, 2x2, 1x1, 6x2)
- ✅ Smart caption colors based on image background
- ✅ Styled captions (modern, classic, minimal, none)
- ✅ Table of contents with page numbers
- ✅ Element glossary with page references
- ✅ Cover page with book title
- ✅ Fast processing with pdf-lib and sharp
- ✅ Pure JavaScript (no native dependencies except sharp)

**Status**: Specification complete, implementation next.
