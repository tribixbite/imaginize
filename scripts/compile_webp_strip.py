#!/usr/bin/env python3
"""
Create a single vertical WebP strip with all images, captions, and metadata.
Perfect for web sharing and social media.
"""

import os
import sys
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import re

def collect_images(base_dir):
    """Collect all PNG images sorted by chapter and scene."""
    images = []
    base_path = Path(base_dir)

    if base_path.name.startswith('imaginize_'):
        for img_file in base_path.glob('*.png'):
            images.append(str(img_file))
    else:
        for img_dir in base_path.glob('imaginize_*'):
            if img_dir.is_dir():
                for img_file in img_dir.glob('*.png'):
                    images.append(str(img_file))

    def sort_key(path):
        filename = Path(path).stem
        match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
        if match:
            return (int(match.group(1)), int(match.group(2)))
        return (999, 999)

    images.sort(key=sort_key)
    return images

def load_scene_descriptions(imaginize_dir):
    """Load scene descriptions from Chapters.md file."""
    descriptions = {}
    chapters_file = Path(imaginize_dir) / 'Chapters.md'

    if not chapters_file.exists():
        return descriptions

    try:
        with open(chapters_file, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.split('\n')
        i = 0
        current_desc = ''

        while i < len(lines):
            line = lines[i].strip()

            if '**Visual Elements:**' in line:
                desc_line = line.split('**Visual Elements:**', 1)[1].strip()
                current_desc = desc_line
                k = i + 1
                while k < len(lines) and lines[k].strip() and not lines[k].startswith('**'):
                    current_desc += ' ' + lines[k].strip()
                    k += 1

            if '**Generated Image:**' in line or 'View Image' in line:
                match = re.search(r'chapter_(\d+)_scene_(\d+)\.png', line)
                if match and current_desc:
                    descriptions[(match.group(1), match.group(2))] = current_desc.strip()
                current_desc = ''
            i += 1

    except Exception as e:
        print(f"⚠️  Warning: Could not parse Chapters.md: {e}")

    return descriptions

def get_caption(img_path, descriptions):
    """Get full caption for image from descriptions."""
    filename = Path(img_path).stem
    match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
    if match:
        chapter, scene = match.group(1), match.group(2)
        if (chapter, scene) in descriptions:
            desc = descriptions[(chapter, scene)]
            # Return full description, truncated if too long
            if len(desc) > 100:
                desc = desc[:97] + "..."
            return f"Ch {chapter}, Sc {scene}: {desc}"
        return f"Chapter {chapter}, Scene {scene}"
    return Path(img_path).stem

def get_font(size, bold=False):
    """Get a font, falling back to default if custom fonts unavailable."""
    font_paths = [
        "/system/fonts/Roboto-Bold.ttf" if bold else "/system/fonts/Roboto-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ]

    for font_path in font_paths:
        try:
            return ImageFont.truetype(font_path, size)
        except:
            continue

    return ImageFont.load_default()

def create_webp_strip(images, output_path, title="Illustrated Book", author="Unknown", imaginize_dir=None, quality=85):
    """
    Create vertical WebP strip(s) with all images and metadata.
    Splits into multiple files if total height exceeds WebP limit.

    Args:
        images: List of image paths
        output_path: Output WebP path
        title: Book title
        author: Author name
        imaginize_dir: Path to imaginize directory
        quality: WebP quality (0-100)
    """
    descriptions = load_scene_descriptions(imaginize_dir) if imaginize_dir else {}

    print(f"🎞️  Creating WebP strip with {len(images)} images...")

    # Configuration
    strip_width = 1024
    header_height = 200
    caption_height = 60
    toc_item_height = 30
    spacing = 20
    bg_color = '#1a1a1a'
    text_color = '#e0e0e0'
    accent_color = '#4a9eff'
    max_webp_height = 16000  # WebP limit is 16383, leave margin

    # Calculate TOC height
    toc_height = 100 + (len(images) * toc_item_height) + spacing * 2

    # Calculate total height
    total_height = header_height + spacing  # Title section
    total_height += toc_height + spacing  # TOC section

    for img_path in images:
        with Image.open(img_path) as img:
            # Scale image to strip width
            scale = strip_width / img.width
            img_height = int(img.height * scale)
            total_height += img_height + caption_height + spacing

    total_height += 100  # Footer

    # Check if we need to split
    if total_height > max_webp_height:
        # Calculate images per strip more carefully
        # First strip has TOC, subsequent strips don't
        avg_img_height = (total_height - header_height - toc_height - 100) // len(images)

        # For first strip: need room for header + TOC + images + footer
        first_strip_available = max_webp_height - header_height - toc_height - 100 - spacing * 3
        images_in_first_strip = max(1, first_strip_available // avg_img_height)

        # For subsequent strips: no TOC
        other_strip_available = max_webp_height - header_height - 100 - spacing * 2
        images_per_other_strip = max(1, other_strip_available // avg_img_height)

        # Calculate total strips needed
        remaining_images = len(images) - images_in_first_strip
        if remaining_images > 0:
            num_other_strips = (remaining_images + images_per_other_strip - 1) // images_per_other_strip
            num_strips = 1 + num_other_strips
        else:
            num_strips = 1

        print(f"   Image too large ({total_height}px), splitting into {num_strips} strips...")

        output_base = Path(output_path).stem
        output_ext = Path(output_path).suffix
        output_dir = Path(output_path).parent

        current_idx = 0
        for strip_idx in range(num_strips):
            if strip_idx == 0:
                # First strip includes TOC
                count = images_in_first_strip
            else:
                # Other strips have no TOC
                count = images_per_other_strip

            end_idx = min(current_idx + count, len(images))
            strip_images = images[current_idx:end_idx]

            strip_path = output_dir / f"{output_base}_part{strip_idx + 1}{output_ext}"
            strip_title = f"{title} (Part {strip_idx + 1}/{num_strips})"

            _create_single_strip(strip_images, str(strip_path), strip_title, author,
                               descriptions, strip_width, header_height, caption_height,
                               spacing, bg_color, text_color, accent_color, quality,
                               include_toc=(strip_idx == 0), toc_images=images if strip_idx == 0 else None)

            current_idx = end_idx

        # Create index file
        index_path = output_dir / f"{output_base}_index.txt"
        with open(index_path, 'w') as f:
            f.write(f"{title} - WebP Strip Index\n")
            f.write(f"Total images: {len(images)}\n")
            f.write(f"Split into {num_strips} parts\n\n")
            for i in range(num_strips):
                f.write(f"Part {i+1}: {output_base}_part{i+1}{output_ext}\n")

        print(f"\n✅ WebP strips created: {num_strips} parts")
        print(f"   Index file: {index_path}")
        return

    # Single strip
    _create_single_strip(images, output_path, title, author, descriptions,
                        strip_width, header_height, caption_height, spacing,
                        bg_color, text_color, accent_color, quality,
                        include_toc=True, toc_images=images)


def _create_single_strip(images, output_path, title, author, descriptions,
                         strip_width, header_height, caption_height, spacing,
                         bg_color, text_color, accent_color, quality,
                         include_toc=True, toc_images=None):
    """Create a single WebP strip."""

    toc_item_height = 30

    # Calculate heights
    if include_toc and toc_images:
        toc_height = 100 + (len(toc_images) * toc_item_height) + spacing * 2
    else:
        toc_height = 0

    total_height = header_height + spacing
    if include_toc:
        total_height += toc_height + spacing

    for img_path in images:
        with Image.open(img_path) as img:
            scale = strip_width / img.width
            img_height = int(img.height * scale)
            total_height += img_height + caption_height + spacing

    total_height += 100  # Footer

    # Create the strip
    strip = Image.new('RGB', (strip_width, total_height), color=bg_color)
    draw = ImageDraw.Draw(strip)

    # Fonts
    title_font = get_font(48, bold=True)
    subtitle_font = get_font(24)
    caption_font = get_font(18, bold=True)
    toc_font = get_font(16)
    footer_font = get_font(14)

    y_pos = spacing

    # === Title Section ===
    # Title
    draw.text((strip_width // 2, y_pos + 40), title, fill=text_color, font=title_font, anchor='mm')
    # Subtitle
    draw.text((strip_width // 2, y_pos + 100), f"by {author}", fill='#888888', font=subtitle_font, anchor='mm')
    # Image count
    draw.text((strip_width // 2, y_pos + 140), f"{len(images)} illustrations", fill=accent_color, font=toc_font, anchor='mm')

    y_pos += header_height + spacing

    # === Table of Contents (only on first strip) ===
    if include_toc and toc_images:
        draw.text((strip_width // 2, y_pos + 30), "Table of Contents", fill=text_color, font=caption_font, anchor='mm')

        toc_y = y_pos + 70
        for i, img_path in enumerate(toc_images):
            caption = get_caption(img_path, descriptions)
            draw.text((50, toc_y), f"{i+1}. {caption}", fill='#aaaaaa', font=toc_font, anchor='lm')
            toc_y += toc_item_height

        y_pos += toc_height + spacing

    # === Images with Captions ===
    for i, img_path in enumerate(images):
        with Image.open(img_path) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Scale to strip width
            scale = strip_width / img.width
            new_height = int(img.height * scale)
            img_resized = img.resize((strip_width, new_height), Image.Resampling.LANCZOS)

            # Paste image
            strip.paste(img_resized, (0, y_pos))
            y_pos += new_height

            # Draw caption background
            draw.rectangle([0, y_pos, strip_width, y_pos + caption_height], fill='#2a2a2a')

            # Draw caption text
            caption = get_caption(img_path, descriptions)
            draw.text((strip_width // 2, y_pos + caption_height // 2), caption,
                     fill=text_color, font=caption_font, anchor='mm')

            y_pos += caption_height + spacing

    # === Footer ===
    draw.text((strip_width // 2, y_pos + 30), "Generated by imaginize", fill='#666666', font=footer_font, anchor='mm')
    draw.text((strip_width // 2, y_pos + 55), "github.com/tribixbite/imaginize", fill=accent_color, font=footer_font, anchor='mm')

    # Save as WebP with high quality
    strip.save(output_path, 'WEBP', quality=95, method=6)

    size_mb = Path(output_path).stat().st_size / (1024 * 1024)
    print(f"   Created: {output_path} ({size_mb:.1f} MB, {strip_width}x{total_height}px)")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Create vertical WebP strip')
    parser.add_argument('base_dir', help='Base directory or specific imaginize_* directory')
    parser.add_argument('output_file', help='Output WebP filename')
    parser.add_argument('--title', default='Illustrated Book', help='Book title')
    parser.add_argument('--author', default='Unknown', help='Book author')
    parser.add_argument('--quality', type=int, default=85, help='WebP quality (0-100)')

    args = parser.parse_args()

    imaginize_dir = Path(args.base_dir) if Path(args.base_dir).name.startswith('imaginize_') else None

    print(f"📚 Creating WebP strip from: {args.base_dir}")
    print(f"📄 Output file: {args.output_file}")

    images = collect_images(args.base_dir)

    if not images:
        print("❌ No images found!")
        sys.exit(1)

    print(f"📸 Found {len(images)} images")
    create_webp_strip(images, args.output_file, title=args.title, author=args.author,
                      imaginize_dir=imaginize_dir, quality=args.quality)
