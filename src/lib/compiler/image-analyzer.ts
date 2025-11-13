/**
 * Image Analyzer - Background color detection for smart captions
 *
 * Analyzes images to determine optimal caption text color based on
 * the dominant background color in the caption area (bottom 10% of image).
 *
 * Uses sharp for fast image processing and color extraction.
 */

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
   *
   * Extracts the bottom 10% of the image (where caption will be placed),
   * calculates the dominant color, determines brightness, and recommends
   * white or black text color for maximum contrast.
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
      .toBuffer({ resolveWithObject: true });

    // Calculate dominant color from raw pixels
    const dominantColor = this.calculateDominantColor(
      captionRegion.data,
      captionRegion.info.channels
    );

    // Calculate brightness (0-255) using perceived luminance
    const brightness = this.calculateBrightness(dominantColor);

    // Determine text color (white for dark backgrounds, black for light)
    // Threshold at 128 (middle of 0-255 range)
    const recommendedTextColor =
      brightness < 128
        ? { r: 255, g: 255, b: 255 } // White text on dark background
        : { r: 0, g: 0, b: 0 }; // Black text on light background

    return {
      dominantColor,
      brightness,
      recommendedTextColor,
    };
  }

  /**
   * Calculate dominant color from raw pixel buffer
   *
   * Averages all pixels in the buffer to get the dominant color.
   * This is faster than k-means clustering and sufficient for caption color detection.
   */
  private calculateDominantColor(buffer: Buffer, channels: number): ColorRGB {
    let r = 0,
      g = 0,
      b = 0;
    const pixelCount = buffer.length / channels;

    for (let i = 0; i < buffer.length; i += channels) {
      r += buffer[i];
      g += buffer[i + 1];
      b += buffer[i + 2];
      // Skip alpha channel if present (channels === 4)
    }

    return {
      r: Math.floor(r / pixelCount),
      g: Math.floor(g / pixelCount),
      b: Math.floor(b / pixelCount),
    };
  }

  /**
   * Calculate brightness using perceived luminance formula
   *
   * Uses the standard formula for perceived brightness:
   * 0.299*R + 0.587*G + 0.114*B
   *
   * This accounts for human perception where green appears brighter than
   * red, which appears brighter than blue.
   *
   * Returns value 0-255 (0 = black, 255 = white)
   */
  private calculateBrightness(color: ColorRGB): number {
    return Math.floor(0.299 * color.r + 0.587 * color.g + 0.114 * color.b);
  }
}
