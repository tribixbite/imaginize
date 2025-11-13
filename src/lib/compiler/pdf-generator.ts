/**
 * PDF Generator - Graphic novel compilation
 *
 * Compiles generated images into a professional graphic novel PDF with:
 * - Multiple layout options (4x1, 2x2, 1x1, 6x2)
 * - Styled captions with smart color detection
 * - Table of contents with page numbers
 * - Element glossary with page references
 * - Optional cover page
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ImageAnalyzer, type ImageAnalysis } from './image-analyzer.js';
import { CaptionRenderer } from './caption-renderer.js';
import type { ImageConcept } from '../../types/config.js';

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
  concept: ImageConcept;
  analysis?: ImageAnalysis;
}

interface LayoutGrid {
  rows: number;
  cols: number;
  imagesPerPage: number;
}

/**
 * Graphic Novel PDF Compiler
 */
export class GraphicNovelCompiler {
  private pdfDoc?: PDFDocument;
  private options: CompilationOptions;
  private analyzer: ImageAnalyzer;
  private renderer: CaptionRenderer;
  private pageWidth = 612; // US Letter: 8.5in * 72pt/in
  private pageHeight = 792; // US Letter: 11in * 72pt/in
  private margin = 36; // 0.5in margins

  constructor(options: CompilationOptions) {
    this.options = options;
    this.analyzer = new ImageAnalyzer();
    this.renderer = new CaptionRenderer();
  }

  /**
   * Main compilation entry point
   */
  async compile(): Promise<void> {
    console.log('🎨 Compiling graphic novel PDF...');

    // 1. Initialize PDF document
    this.pdfDoc = await PDFDocument.create();

    // 2. Load all images and metadata
    console.log('📂 Loading images and metadata...');
    const images = await this.loadImages();

    if (images.length === 0) {
      throw new Error('No images found in input directory');
    }

    console.log(`   Found ${images.length} images`);

    // 3. Analyze images for caption colors
    if (this.options.captionStyle !== 'none') {
      console.log('🔍 Analyzing images for caption colors...');
      await this.analyzeImages(images);
    }

    // 4. Generate cover page (if title provided)
    if (this.options.bookTitle) {
      console.log('📖 Generating cover page...');
      await this.generateCoverPage();
    }

    // 5. Generate table of contents (if enabled)
    if (this.options.includeToc) {
      console.log('📑 Generating table of contents...');
      await this.generateTableOfContents(images);
    }

    // 6. Generate image pages with captions
    console.log(`🖼️  Generating image pages (${this.options.layout} layout)...`);
    await this.generateImagePages(images);

    // 7. Generate glossary (if enabled)
    if (this.options.includeGlossary) {
      console.log('📚 Generating glossary...');
      await this.generateGlossary();
    }

    // 8. Save PDF
    console.log('💾 Saving PDF...');
    await this.savePDF();

    console.log(`✅ Graphic novel compiled: ${this.options.outputPath}`);
  }

  /**
   * Load all images from output directory
   */
  private async loadImages(): Promise<ImageMetadata[]> {
    const imagesDir = join(this.options.inputDir, 'images');
    const conceptsPath = join(this.options.inputDir, '.concepts.json');

    // Check if images directory exists
    if (!existsSync(imagesDir)) {
      throw new Error(`Images directory not found: ${imagesDir}`);
    }

    // Load concepts if available
    let concepts: ImageConcept[] = [];
    if (existsSync(conceptsPath)) {
      const conceptsData = await readFile(conceptsPath, 'utf-8');
      concepts = JSON.parse(conceptsData);
    }

    // List all PNG files in images directory
    const files = await readdir(imagesDir);
    const imageFiles = files.filter((f) => f.endsWith('.png')).sort();

    // Match images with concepts
    const images: ImageMetadata[] = [];

    for (const file of imageFiles) {
      const imagePath = join(imagesDir, file);

      // Find matching concept by image filename
      const concept = concepts.find((c) => c.imageUrl?.endsWith(file));

      images.push({
        path: imagePath,
        concept: concept || {
          chapter: 'Unknown Chapter',
          chapterNumber: 0,
          pageRange: '',
          quote: '',
          description: file.replace('.png', '').replace(/-/g, ' '),
        },
      });
    }

    return images;
  }

  /**
   * Analyze images for background colors
   */
  private async analyzeImages(images: ImageMetadata[]): Promise<void> {
    for (let i = 0; i < images.length; i++) {
      try {
        const analysis = await this.analyzer.analyzeForCaption(images[i].path);
        images[i].analysis = analysis;

        if ((i + 1) % 10 === 0) {
          console.log(`   Analyzed ${i + 1}/${images.length} images`);
        }
      } catch (error: any) {
        console.warn(`   Warning: Could not analyze ${images[i].path}: ${error.message}`);
      }
    }

    console.log(`   Analyzed ${images.length}/${images.length} images`);
  }

  /**
   * Generate cover page
   */
  private async generateCoverPage(): Promise<void> {
    if (!this.pdfDoc) return;

    const page = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    const font = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const titleSize = 36;
    const subtitleSize = 14;

    // Title (centered vertically and horizontally)
    const titleWidth = font.widthOfTextAtSize(this.options.bookTitle!, titleSize);
    page.drawText(this.options.bookTitle!, {
      x: (this.pageWidth - titleWidth) / 2,
      y: this.pageHeight / 2 + 50,
      size: titleSize,
      font,
      color: rgb(0, 0, 0),
    });

    // Subtitle
    const subtitle = 'Generated with imaginize';
    const subtitleWidth = font.widthOfTextAtSize(subtitle, subtitleSize);
    page.drawText(subtitle, {
      x: (this.pageWidth - subtitleWidth) / 2,
      y: this.pageHeight / 2 - 50,
      size: subtitleSize,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  /**
   * Generate table of contents
   */
  private async generateTableOfContents(images: ImageMetadata[]): Promise<void> {
    if (!this.pdfDoc) return;

    const page = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    const font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = this.pageHeight - this.margin - 50;

    // Title
    page.drawText('Table of Contents', {
      x: this.margin,
      y,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    y -= 40;

    // Group images by chapter
    const byChapter = new Map<string, ImageMetadata[]>();
    for (const img of images) {
      const chapter = img.concept.chapter || 'Unknown';
      if (!byChapter.has(chapter)) {
        byChapter.set(chapter, []);
      }
      byChapter.get(chapter)!.push(img);
    }

    // Calculate starting page number (after cover and TOC)
    let currentPage = this.pdfDoc.getPageCount() + 1;

    // List chapters
    for (const [chapter, chapterImages] of byChapter.entries()) {
      page.drawText(`${chapter}`, {
        x: this.margin + 20,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText(`Page ${currentPage}`, {
        x: this.pageWidth - this.margin - 80,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      y -= 20;

      // Update page count based on layout
      const layout = this.getLayoutGrid();
      currentPage += Math.ceil(chapterImages.length / layout.imagesPerPage);

      if (y < this.margin + 50) break; // Page full
    }
  }

  /**
   * Generate image pages with layout and captions
   */
  private async generateImagePages(images: ImageMetadata[]): Promise<void> {
    if (!this.pdfDoc) return;

    const layout = this.getLayoutGrid();
    const font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);

    // Calculate cell dimensions
    const contentWidth = this.pageWidth - this.margin * 2;
    const contentHeight = this.pageHeight - this.margin * 2;
    const cellWidth = contentWidth / layout.cols;
    const cellHeight = contentHeight / layout.rows;
    const imagePadding = 10;

    // Process images in batches per page
    for (let i = 0; i < images.length; i += layout.imagesPerPage) {
      const batch = images.slice(i, i + layout.imagesPerPage);
      const page = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);

      // Place each image in the grid
      for (let j = 0; j < batch.length; j++) {
        const img = batch[j];
        const row = Math.floor(j / layout.cols);
        const col = j % layout.cols;

        // Calculate position
        const x = this.margin + col * cellWidth + imagePadding;
        const y = this.pageHeight - this.margin - (row + 1) * cellHeight + imagePadding;
        const w = cellWidth - imagePadding * 2;
        const h = cellHeight - imagePadding * 2;

        // Embed and draw image
        try {
          const imageBytes = await readFile(img.path);
          const pdfImage = await this.pdfDoc.embedPng(imageBytes);

          // Calculate aspect-fit scaling
          const imageAspect = pdfImage.width / pdfImage.height;
          const cellAspect = w / h;

          let drawWidth = w;
          let drawHeight = h - 30; // Reserve 30pt for caption

          if (imageAspect > cellAspect) {
            // Image is wider - fit to width
            drawHeight = drawWidth / imageAspect;
          } else {
            // Image is taller - fit to height
            drawWidth = drawHeight * imageAspect;
          }

          // Center image in cell
          const imageX = x + (w - drawWidth) / 2;
          const imageY = y + 30 + (h - 30 - drawHeight) / 2;

          page.drawImage(pdfImage, {
            x: imageX,
            y: imageY,
            width: drawWidth,
            height: drawHeight,
          });

          // Add caption
          if (this.options.captionStyle !== 'none') {
            const captionText =
              img.concept.description || img.concept.chapter || 'Untitled';

            const textColor = img.analysis?.recommendedTextColor || {
              r: 255,
              g: 255,
              b: 255,
            };

            this.renderer.renderCaption(page, font, {
              text: captionText,
              style: this.options.captionStyle,
              textColor,
              position: { x, y, width: w },
            });
          }
        } catch (error: any) {
          console.warn(`   Warning: Could not embed image ${img.path}: ${error.message}`);
        }
      }

      // Add page number
      if (this.options.pageNumbers) {
        const pageNum = this.pdfDoc.getPageCount();
        const pageText = `${pageNum}`;
        const pageTextWidth = font.widthOfTextAtSize(pageText, 10);

        page.drawText(pageText, {
          x: (this.pageWidth - pageTextWidth) / 2,
          y: this.margin / 2,
          size: 10,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      if ((i + batch.length) % 20 === 0) {
        console.log(`   Generated ${i + batch.length}/${images.length} images`);
      }
    }

    console.log(`   Generated ${images.length}/${images.length} images`);
  }

  /**
   * Generate elements glossary
   */
  private async generateGlossary(): Promise<void> {
    if (!this.pdfDoc) return;

    const elementsPath = join(this.options.inputDir, 'Elements.md');

    if (!existsSync(elementsPath)) {
      console.log('   No Elements.md found, skipping glossary');
      return;
    }

    const page = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    const font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = this.pageHeight - this.margin - 50;

    // Title
    page.drawText('Glossary', {
      x: this.margin,
      y,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    y -= 40;

    // Parse Elements.md (simplified - just show it exists)
    const elementsContent = await readFile(elementsPath, 'utf-8');
    const lines = elementsContent.split('\n').slice(0, 30); // First 30 lines

    for (const line of lines) {
      if (y < this.margin + 20) break; // Page full

      if (line.startsWith('###')) {
        // Entity name
        const name = line.replace('###', '').trim();
        page.drawText(name, {
          x: this.margin + 20,
          y,
          size: 12,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        y -= 15;
      } else if (line.startsWith('**Type:**')) {
        // Type
        const type = line.replace('**Type:**', '').trim();
        page.drawText(`  ${type}`, {
          x: this.margin + 20,
          y,
          size: 10,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        y -= 15;
      }
    }
  }

  /**
   * Save PDF to disk
   */
  private async savePDF(): Promise<void> {
    if (!this.pdfDoc) return;

    const pdfBytes = await this.pdfDoc.save();
    const { writeFile } = await import('fs/promises');
    await writeFile(this.options.outputPath, pdfBytes);
  }

  /**
   * Get layout grid configuration
   */
  private getLayoutGrid(): LayoutGrid {
    switch (this.options.layout) {
      case '1x1':
        return { rows: 1, cols: 1, imagesPerPage: 1 };
      case '2x2':
        return { rows: 2, cols: 2, imagesPerPage: 4 };
      case '4x1':
        return { rows: 4, cols: 1, imagesPerPage: 4 };
      case '6x2':
        return { rows: 3, cols: 2, imagesPerPage: 6 };
      default:
        return { rows: 4, cols: 1, imagesPerPage: 4 };
    }
  }
}
