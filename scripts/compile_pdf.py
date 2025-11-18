#!/usr/bin/env python3
"""
Compile DALL-E generated images into a dark-themed graphic novel PDF.
Features: Dark theme, cover generation, QR codes, enhanced captions.
"""

import os
import json
import sys
from pathlib import Path
from PIL import Image, ImageStat, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
import qrcode
from io import BytesIO
from openai import OpenAI

# Dark theme colors
BG_COLOR = HexColor('#1a1a1a')  # Dark background
TEXT_COLOR = HexColor('#e0e0e0')  # Light text
ACCENT_COLOR = HexColor('#4a9eff')  # Blue accent

def generate_cover_image(title, author, output_path):
    """
    Generate a cover image using DALL-E 3.

    Args:
        title: Book title
        author: Author name
        output_path: Where to save the cover image

    Returns:
        Path to generated cover image
    """
    try:
        client = OpenAI()

        prompt = f"""Create an epic, cinematic book cover illustration for "{title}" by {author}.
        The image should be dramatic, atmospheric, and capture the essence of science fiction adventure.
        Dark, moody lighting with rich colors. No text on the image - just the visual artwork.
        High quality, professional book cover aesthetic."""

        print(f"🎨 Generating cover image for '{title}'...")

        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )

        # Download the image
        import requests
        img_url = response.data[0].url
        img_data = requests.get(img_url).content

        with open(output_path, 'wb') as f:
            f.write(img_data)

        print(f"✅ Cover image saved: {output_path}")
        return output_path

    except Exception as e:
        print(f"⚠️  Cover generation failed: {e}")
        print("   Creating placeholder cover...")

        # Create a simple placeholder cover
        img = Image.new('RGB', (1024, 1024), color='#1a1a1a')
        draw = ImageDraw.Draw(img)

        # Try to use a nice font, fall back to default
        try:
            font = ImageFont.truetype("/system/fonts/Roboto-Bold.ttf", 60)
            font_small = ImageFont.truetype("/system/fonts/Roboto-Regular.ttf", 40)
        except:
            font = ImageFont.load_default()
            font_small = font

        # Draw title and author
        draw.text((512, 400), title, fill='#e0e0e0', font=font, anchor='mm')
        draw.text((512, 500), f"by {author}", fill='#888888', font=font_small, anchor='mm')

        img.save(output_path)
        print(f"✅ Placeholder cover saved: {output_path}")
        return output_path

def generate_qr_code(url, size=150):
    """
    Generate QR code for URL and return as PIL Image.

    Args:
        url: URL to encode
        size: Size of QR code in pixels

    Returns:
        PIL Image of QR code
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="white", back_color="black")
    img = img.resize((size, size), Image.Resampling.LANCZOS)

    return img

def load_scene_descriptions(imaginize_dir):
    """
    Load scene descriptions from progress.md file.

    Args:
        imaginize_dir: Path to imaginize output directory

    Returns:
        dict mapping (chapter, scene) tuples to descriptions
    """
    descriptions = {}
    progress_file = Path(imaginize_dir) / 'progress.md'

    if not progress_file.exists():
        return descriptions

    try:
        with open(progress_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse markdown to find image generation sections
        current_chapter = None
        lines = content.split('\n')
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            # Match chapter headers like "## Chapter 10"
            if line.startswith('## Chapter '):
                try:
                    current_chapter = line.split('## Chapter ')[1].strip()
                except:
                    pass

            # Match image generation lines with prompts
            # Format: "**[2025-11-18T11:33:05.123Z]** ℹ️ ⏳ Generating: 45 (399-414 (Lines 35-35))"
            # Followed by prompt details
            elif '⏳ Generating:' in line and current_chapter:
                # Try to extract scene number from the line number or next lines
                # Look ahead for the actual prompt which contains the description
                for j in range(i+1, min(i+10, len(lines))):
                    prompt_line = lines[j]

                    # Skip metadata lines
                    if 'Trying OpenRouter' in prompt_line or 'Using OpenRouter' in prompt_line:
                        continue

                    # Look for lines that might contain the scene description
                    # These are usually after "Generating:" and before "✅ Saved:"
                    if prompt_line.strip() and not prompt_line.startswith('**['):
                        # This might be our description
                        # Try to extract scene number from saved filename
                        saved_idx = j
                        while saved_idx < min(i+20, len(lines)):
                            if '✅ Saved:' in lines[saved_idx] or '✅ ✅ Saved:' in lines[saved_idx]:
                                # Extract filename like "chapter_10_scene_1.png"
                                match_line = lines[saved_idx]
                                if 'chapter_' in match_line and '_scene_' in match_line:
                                    try:
                                        parts = match_line.split('chapter_')[1].split('_scene_')
                                        ch = parts[0]
                                        sc = parts[1].split('.png')[0]

                                        # Use the chapter/scene
                                        descriptions[(ch, sc)] = prompt_line.strip()
                                        break
                                    except:
                                        pass
                            saved_idx += 1
                        break

            i += 1

    except Exception as e:
        print(f"⚠️  Warning: Could not parse progress.md: {e}")

    return descriptions

def parse_image_metadata(image_path, imaginize_dir, scene_descriptions=None):
    """
    Extract metadata from image filename and progress file.

    Args:
        image_path: Path to the image
        imaginize_dir: Path to imaginize output directory
        scene_descriptions: Optional dict of scene descriptions

    Returns:
        dict with chapter, scene, title, description
    """
    stem = Path(image_path).stem
    parts = stem.split('_')

    try:
        chapter = parts[1] if len(parts) > 1 else '?'
        scene = parts[3] if len(parts) > 3 else '?'
        title = f"Chapter {chapter}, Scene {scene}"
    except IndexError:
        title = stem.replace('_', ' ').title()
        chapter = '?'
        scene = '?'

    # Try to get description from scene_descriptions dict
    description = "Scene illustration"

    if scene_descriptions and (chapter, scene) in scene_descriptions:
        desc = scene_descriptions[(chapter, scene)]
        # Clean up and truncate to 1-6 words
        desc = desc.replace('**', '').replace('ℹ️', '').replace('⏳', '').strip()
        words = desc.split()[:6]
        description = ' '.join(words)
        if len(desc.split()) > 6:
            description += '...'
    elif imaginize_dir:
        # Fallback: try to parse from log file
        log_file = Path(imaginize_dir).parent / f"{Path(imaginize_dir).stem.replace('imaginize_', '')}-full.log"
        if log_file.exists():
            try:
                with open(log_file, 'r') as f:
                    log_content = f.read()
                # Simple search for the image filename and extract nearby text
                if f"chapter_{chapter}_scene_{scene}" in log_content:
                    # This is a simplified fallback
                    description = "Generated scene"
            except:
                pass

    return {
        'chapter': chapter,
        'scene': scene,
        'title': title,
        'description': description,
        'filename': Path(image_path).name
    }

def collect_images(base_dir):
    """
    Collect all PNG images from book directories.

    Returns:
        List of image paths sorted by chapter and scene
    """
    images = []
    base_path = Path(base_dir)

    # If base_dir is a specific imaginize directory, use it directly
    if base_path.name.startswith('imaginize_'):
        for img_file in base_path.glob('*.png'):
            images.append(str(img_file))
    else:
        # Otherwise scan for imaginize_* directories
        for img_dir in base_path.glob('imaginize_*'):
            if img_dir.is_dir():
                for img_file in img_dir.glob('*.png'):
                    images.append(str(img_file))

    # Sort by filename (chapter_X_scene_Y.png)
    images.sort()
    return images

def create_pdf(images, output_path, title="Illustrated Book", author="Unknown", imaginize_dir=None):
    """
    Create dark-themed PDF with cover, credits, metadata, and enhanced captions.

    Args:
        images: List of image paths
        output_path: Output PDF path
        title: Book title
        author: Author name
        imaginize_dir: Path to imaginize directory for extracting metadata
    """
    # Load scene descriptions from progress.md if available
    scene_descriptions = {}
    if imaginize_dir:
        print("📖 Loading scene descriptions...")
        scene_descriptions = load_scene_descriptions(imaginize_dir)
        print(f"   Found {len(scene_descriptions)} scene descriptions")

    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter  # 8.5 x 11 inches

    # Configuration
    images_per_page = 4
    grid_cols = 2
    grid_rows = 2
    margin = 0.5 * inch
    spacing = 0.25 * inch
    caption_height = 0.4 * inch  # Increased for more info

    # Calculate image dimensions
    available_width = width - (2 * margin) - spacing
    available_height = height - (2 * margin) - spacing - (grid_rows * caption_height)
    img_width = available_width / grid_cols
    img_height = available_height / grid_rows

    # === Page 1: Cover ===
    print("📖 Creating cover page...")

    # Generate cover image
    cover_path = Path(output_path).parent / f"{Path(output_path).stem}_cover.png"
    generate_cover_image(title, author, cover_path)

    # Dark background
    c.setFillColor(BG_COLOR)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Draw cover image
    if cover_path.exists():
        c.drawImage(str(cover_path), inch, 2*inch, width=6.5*inch, height=6.5*inch,
                   preserveAspectRatio=True, anchor='c')

    # Title and author overlay at bottom
    c.setFillColor(TEXT_COLOR)
    c.setFont("Helvetica-Bold", 42)
    c.drawCentredString(width/2, 1.5*inch, title)
    c.setFont("Helvetica", 24)
    c.drawCentredString(width/2, inch, f"by {author}")

    c.showPage()

    # === Page 2: Credits ===
    print("✨ Creating credits page...")

    # Dark background
    c.setFillColor(BG_COLOR)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Title
    c.setFillColor(TEXT_COLOR)
    c.setFont("Helvetica", 32)
    c.drawCentredString(width/2, height - 2*inch, "AI Illustrated by")

    c.setFont("Helvetica-BoldOblique", 48)
    c.setFillColor(ACCENT_COLOR)
    c.drawCentredString(width/2, height - 2.8*inch, "imaginize")

    # QR code and URL in bottom right
    github_url = "https://github.com/tribixbite/imaginize"

    # Generate QR code
    qr_img = generate_qr_code(github_url, size=120)
    qr_path = Path(output_path).parent / f"{Path(output_path).stem}_qr.png"
    qr_img.save(qr_path)

    # Draw QR code
    qr_x = width - 2*inch
    qr_y = inch
    c.drawImage(str(qr_path), qr_x, qr_y, width=1.2*inch, height=1.2*inch)

    # URL text below QR
    c.setFillColor(TEXT_COLOR)
    c.setFont("Helvetica", 8)
    c.drawCentredString(qr_x + 0.6*inch, qr_y - 0.2*inch, "github.com/tribixbite/imaginize")

    c.showPage()

    # === Page 3: Metadata ===
    print("📊 Creating metadata page...")

    # Dark background
    c.setFillColor(BG_COLOR)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setFillColor(TEXT_COLOR)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(margin, height - margin - 0.5*inch, "Generation Metadata")

    c.setFont("Helvetica", 12)
    y = height - margin - inch

    metadata = [
        ("Book Title", title),
        ("Author", author),
        ("Total Images", str(len(images))),
        ("Pages", str((len(images) + images_per_page - 1) // images_per_page + 3)),
        ("", ""),
        ("AI Models Used", ""),
        ("  Text Analysis", "Google Gemini 2.0 Flash (free tier)"),
        ("  Image Generation", "OpenAI DALL-E 3"),
        ("  PDF Compilation", "Python (Pillow + ReportLab)"),
        ("", ""),
        ("Configuration", ""),
        ("  Pages per Image", "5"),
        ("  Image Quality", "Standard (1024x1024)"),
        ("  Processing", "Automated via imaginize"),
    ]

    for label, value in metadata:
        if label:
            c.setFont("Helvetica-Bold", 11)
            c.drawString(margin + 0.25*inch, y, f"{label}:")
            c.setFont("Helvetica", 11)
            c.drawString(margin + 2.5*inch, y, value)
        y -= 0.25 * inch

        if y < 2*inch:
            break

    c.showPage()

    # === Page 4+: Table of Contents ===
    print("📑 Creating table of contents...")

    # Dark background
    c.setFillColor(BG_COLOR)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setFillColor(TEXT_COLOR)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(margin, height - margin - 0.5*inch, "Table of Contents")
    c.setFont("Helvetica", 10)

    toc_y = height - margin - inch
    page_num = 4  # Start after cover, credits, metadata

    for i in range(0, len(images), images_per_page):
        batch = images[i:i+images_per_page]
        first_meta = parse_image_metadata(batch[0], imaginize_dir, scene_descriptions)
        last_meta = parse_image_metadata(batch[-1], imaginize_dir, scene_descriptions)

        entry = f"Page {page_num}: Chapters {first_meta['chapter']}-{last_meta['chapter']}"

        c.setFillColor(TEXT_COLOR)
        c.drawString(margin + 0.25*inch, toc_y, entry)
        c.drawRightString(width - margin, toc_y, str(page_num))
        toc_y -= 0.25 * inch

        if toc_y < 2*inch:  # New TOC page if needed
            c.showPage()
            c.setFillColor(BG_COLOR)
            c.rect(0, 0, width, height, fill=1, stroke=0)
            c.setFillColor(TEXT_COLOR)
            c.setFont("Helvetica", 10)
            toc_y = height - margin - 0.5*inch

        page_num += 1

    c.showPage()

    # === Image Pages ===
    print(f"🖼️  Creating {len(images)} image pages...")

    for page_idx in range(0, len(images), images_per_page):
        # Dark background
        c.setFillColor(BG_COLOR)
        c.rect(0, 0, width, height, fill=1, stroke=0)

        batch = images[page_idx:page_idx+images_per_page]

        for idx, img_path in enumerate(batch):
            row = idx // grid_cols
            col = idx % grid_cols

            # Calculate position
            x = margin + (col * (img_width + spacing))
            y = height - margin - (row + 1) * img_height - (row * (spacing + caption_height))

            # Draw image
            try:
                c.drawImage(img_path, x, y, width=img_width, height=img_height,
                           preserveAspectRatio=True, anchor='sw')

                # Get metadata
                meta = parse_image_metadata(img_path, imaginize_dir, scene_descriptions)

                # Calculate page number from source book
                # Assume ~5 pages per image
                source_page = int(meta['chapter']) * 15 + int(meta['scene']) * 5

                # Caption with dark background
                c.setFillColorRGB(0.1, 0.1, 0.1, alpha=0.85)
                caption_y = y - caption_height
                c.rect(x, caption_y, img_width, caption_height, fill=1, stroke=0)

                # Caption text (multi-line)
                c.setFillColor(TEXT_COLOR)
                c.setFont("Helvetica-Bold", 9)
                caption_line1 = f"Ch {meta['chapter']}, Scene {meta['scene']} • Page ~{source_page}"
                c.drawCentredString(x + img_width/2, caption_y + caption_height - 0.12*inch, caption_line1)

                c.setFont("Helvetica", 8)
                c.drawCentredString(x + img_width/2, caption_y + caption_height - 0.25*inch, meta['description'])

            except Exception as e:
                print(f"⚠️  Error processing {img_path}: {e}")
                # Draw placeholder
                c.setFillColorRGB(0.2, 0.2, 0.2)
                c.rect(x, y, img_width, img_height, fill=1)
                c.setFillColor(TEXT_COLOR)
                c.drawCentredString(x + img_width/2, y + img_height/2, "Error loading image")

        # Page number at bottom
        c.setFillColor(TEXT_COLOR)
        c.setFont("Helvetica", 10)
        current_page = (page_idx // images_per_page) + 4  # +4 for cover, credits, metadata, TOC
        c.drawCentredString(width/2, 0.5*inch, str(current_page))

        c.showPage()

    # Save PDF
    c.save()

    # Clean up temp files
    if cover_path.exists():
        os.remove(cover_path)
    if qr_path.exists():
        os.remove(qr_path)

    print(f"\n✅ PDF created: {output_path}")
    print(f"   Total images: {len(images)}")
    print(f"   Total pages: {(len(images) + images_per_page - 1) // images_per_page + 4}")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Compile illustrated book PDF with dark theme')
    parser.add_argument('base_dir', help='Base directory or specific imaginize_* directory')
    parser.add_argument('output_file', help='Output PDF filename')
    parser.add_argument('--title', default='Illustrated Book', help='Book title')
    parser.add_argument('--author', default='Unknown', help='Book author')

    args = parser.parse_args()

    base_dir = args.base_dir
    output_file = args.output_file

    # Determine imaginize directory for metadata
    imaginize_dir = Path(base_dir) if Path(base_dir).name.startswith('imaginize_') else None

    print(f"📚 Compiling PDF from: {base_dir}")
    print(f"📄 Output file: {output_file}")
    print(f"📖 Title: {args.title} by {args.author}")

    # Collect images
    images = collect_images(base_dir)

    if not images:
        print("❌ No images found!")
        sys.exit(1)

    print(f"📸 Found {len(images)} images")

    # Create PDF
    create_pdf(images, output_file, title=args.title, author=args.author, imaginize_dir=imaginize_dir)

    # Show file size
    size_mb = Path(output_file).stat().st_size / (1024 * 1024)
    print(f"   File size: {size_mb:.1f} MB")
