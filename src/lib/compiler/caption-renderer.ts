/**
 * Caption Renderer - Styled text overlays for images
 *
 * Renders captions on PDF pages with various styles:
 * - modern: Semi-transparent background with white text and shadow
 * - classic: White background with black border and serif text
 * - minimal: No background, auto-contrast text color
 * - none: No captions
 */

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
   *
   * @param page - PDF page to draw on
   * @param font - Font to use for text
   * @param options - Caption styling options
   */
  renderCaption(page: PDFPage, font: PDFFont, options: CaptionOptions): void {
    if (options.style === 'none') return;

    const { x, y, width } = options.position;
    const fontSize = 12;
    const padding = 8;

    // Calculate text dimensions for centering
    const textWidth = font.widthOfTextAtSize(options.text, fontSize);
    const textX = x + (width - textWidth) / 2; // Center horizontally
    const textY = y + padding;

    // Render based on style
    if (options.style === 'modern') {
      this.renderModernCaption(page, font, options, {
        x,
        y,
        width,
        textX,
        textY,
        fontSize,
        padding,
      });
    } else if (options.style === 'classic') {
      this.renderClassicCaption(page, font, options, {
        x,
        y,
        width,
        textX,
        textY,
        fontSize,
        padding,
      });
    } else if (options.style === 'minimal') {
      this.renderMinimalCaption(page, font, options, {
        textX,
        textY,
        fontSize,
      });
    }
  }

  /**
   * Modern style: Semi-transparent black background with white text and shadow
   */
  private renderModernCaption(
    page: PDFPage,
    font: PDFFont,
    options: CaptionOptions,
    layout: {
      x: number;
      y: number;
      width: number;
      textX: number;
      textY: number;
      fontSize: number;
      padding: number;
    }
  ): void {
    const { x, y, width, textX, textY, fontSize, padding } = layout;

    // Semi-transparent black background
    page.drawRectangle({
      x,
      y,
      width,
      height: fontSize + padding * 2,
      color: rgb(0, 0, 0),
      opacity: 0.7,
    });

    // Text shadow effect (offset by 1pt)
    page.drawText(options.text, {
      x: textX + 1,
      y: textY - 1,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      opacity: 0.5,
    });

    // White text
    page.drawText(options.text, {
      x: textX,
      y: textY,
      size: fontSize,
      font,
      color: rgb(1, 1, 1),
    });
  }

  /**
   * Classic style: White background with black border and black text
   */
  private renderClassicCaption(
    page: PDFPage,
    font: PDFFont,
    options: CaptionOptions,
    layout: {
      x: number;
      y: number;
      width: number;
      textX: number;
      textY: number;
      fontSize: number;
      padding: number;
    }
  ): void {
    const { x, y, width, textX, textY, fontSize, padding } = layout;

    // White background with black border
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
  }

  /**
   * Minimal style: No background, just text with auto-contrast color
   */
  private renderMinimalCaption(
    page: PDFPage,
    font: PDFFont,
    options: CaptionOptions,
    layout: { textX: number; textY: number; fontSize: number }
  ): void {
    const { textX, textY, fontSize } = layout;

    // Convert RGB 0-255 to PDF 0-1 range
    const c = options.textColor;
    const color = rgb(c.r / 255, c.g / 255, c.b / 255);

    // Just text, no background
    page.drawText(options.text, {
      x: textX,
      y: textY,
      size: fontSize,
      font,
      color,
    });
  }
}
