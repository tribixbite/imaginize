#!/usr/bin/env python3
"""
Compile images into optimized WebP format album (smaller than PNG).
Creates a directory of WebP images with metadata JSON.
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
                full_desc = desc_line
                k = i + 1
                while k < len(lines) and lines[k].strip() and not lines[k].startswith('**'):
                    full_desc += ' ' + lines[k].strip()
                    k += 1

                # Look for the FIRST image reference only
                for j in range(i, min(i+15, len(lines))):
                    if 'chapter_' in lines[j] and '_scene_' in lines[j]:
                        match = re.search(r'chapter_(\d+)_scene_(\d+)', lines[j])
                        if match:
                            descriptions[(match.group(1), match.group(2))] = full_desc.strip()
                        break
            i += 1

    except Exception as e:
        print(f"⚠️  Warning: Could not parse Chapters.md: {e}")

    return descriptions

def extract_smart_caption(desc):
    """Extract a concise caption (5-8 words) focusing on subject and location."""
    if not desc:
        return ""

    words = desc.split()
    result = []

    # Words to skip entirely
    skip = {'a', 'an', 'the', 'is', 'are', 'was', 'were', 'has', 'have', 'had',
            'and', 'or', 'but', 'with', 'by', 'for', 'to', 'from', 'of',
            'tall', 'short', 'out', 'shape', 'dressed', 'appearing', 'blurred',
            'contrasting', 'standing', 'sitting', 'looking', 'like'}

    # Capture first sentence only (before first period)
    first_sentence = []
    for w in words:
        first_sentence.append(w)
        if w.endswith('.'):
            break

    # Build caption from key words, preserving proper nouns
    for word in first_sentence:
        clean = word.rstrip(',.;:')
        if not clean:
            continue

        # Always keep capitalized words (proper nouns) and location prepositions
        if clean[0].isupper() or clean.lower() in ['in', 'at', 'on', 'near', 'before']:
            result.append(clean)
        elif clean.lower() not in skip and len(clean) > 2:
            result.append(clean)

        if len(result) >= 7:
            break

    return ' '.join(result) if result else desc[:50]

def get_caption(img_path, descriptions):
    """Get concise caption for image from descriptions."""
    filename = Path(img_path).stem
    match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
    if match:
        chapter, scene = match.group(1), match.group(2)
        if (chapter, scene) in descriptions:
            return extract_smart_caption(descriptions[(chapter, scene)])
        return f"Chapter {chapter}, Scene {scene}"
    return ""

def get_font(size, bold=False):
    """Get a font, falling back to default if custom fonts unavailable."""
    font_paths = [
        "/system/fonts/Roboto-Bold.ttf" if bold else "/system/fonts/Roboto-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for font_path in font_paths:
        try:
            return ImageFont.truetype(font_path, size)
        except:
            continue
    return ImageFont.load_default()

def create_page_image(width=1024, height=1024):
    """Create a dark background image for front matter pages."""
    return Image.new('RGB', (width, height), color='#1a1a1a')

def create_webp_album(images, output_path, title="Illustrated Book", author="Unknown", imaginize_dir=None, quality=95):
    """
    Convert images to WebP format with caption overlays and front matter pages.

    Args:
        images: List of image paths
        output_path: Output directory
        title: Book title
        author: Author name
        imaginize_dir: Path to imaginize directory
        quality: WebP quality (0-100), default 95
    """
    from datetime import datetime
    from PIL import ImageDraw

    descriptions = load_scene_descriptions(imaginize_dir) if imaginize_dir else {}

    # Create output directory
    output_dir = Path(output_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"🖼️  Creating WebP album with {len(images)} images...")

    metadata = {
        'title': title,
        'author': author,
        'total_images': len(images),
        'quality': quality,
        'images': []
    }

    total_original = 0
    total_webp = 0

    # Create cover page
    cover = create_page_image()
    draw = ImageDraw.Draw(cover)
    title_font = get_font(60, bold=True)
    author_font = get_font(30)
    draw.text((512, 400), title, fill='#e0e0e0', font=title_font, anchor='mm')
    draw.text((512, 500), f"by {author}", fill='#888888', font=author_font, anchor='mm')
    draw.text((512, 600), f"{len(images)} illustrations", fill='#4a9eff', font=get_font(24), anchor='mm')
    cover_path = output_dir / '0000_cover.webp'
    cover.save(cover_path, 'WEBP', quality=quality, method=6)

    # Create metadata page
    meta = create_page_image()
    draw = ImageDraw.Draw(meta)
    draw.text((512, 300), "AI Illustrated by imaginize", fill='#4a9eff', font=get_font(36, bold=True), anchor='mm')
    draw.text((512, 400), f"Title: {title}", fill='#aaaaaa', font=get_font(20), anchor='mm')
    draw.text((512, 450), f"Author: {author}", fill='#aaaaaa', font=get_font(20), anchor='mm')
    draw.text((512, 500), f"Images: {len(images)}", fill='#aaaaaa', font=get_font(20), anchor='mm')
    draw.text((512, 550), f"Generated: {datetime.now().strftime('%Y-%m-%d')}", fill='#aaaaaa', font=get_font(20), anchor='mm')
    draw.text((512, 700), "github.com/tribixbite/imaginize", fill='#4a9eff', font=get_font(16), anchor='mm')
    meta_path = output_dir / '0001_metadata.webp'
    meta.save(meta_path, 'WEBP', quality=quality, method=6)

    # Create TOC page(s)
    toc_font = get_font(14)
    items_per_page = 25
    for page_num in range((len(images) + items_per_page - 1) // items_per_page):
        toc = create_page_image()
        draw = ImageDraw.Draw(toc)
        draw.text((512, 50), f"Table of Contents{' (cont.)' if page_num > 0 else ''}", fill='#e0e0e0', font=get_font(24, bold=True), anchor='mm')

        start_idx = page_num * items_per_page
        end_idx = min(start_idx + items_per_page, len(images))
        y = 120
        for i in range(start_idx, end_idx):
            caption = get_caption(images[i], descriptions)
            draw.text((50, y), f"{i+1}. {caption}", fill='#aaaaaa', font=toc_font, anchor='lm')
            y += 35

        toc_path = output_dir / f'000{2 + page_num}_toc.webp'
        toc.save(toc_path, 'WEBP', quality=quality, method=6)

    # Convert images with caption overlays
    for i, img_path in enumerate(images):
        filename = Path(img_path).stem
        match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
        if match:
            webp_name = f"{i+10:04d}_ch{match.group(1)}_sc{match.group(2)}.webp"
        else:
            webp_name = f"{i+10:04d}_{filename}.webp"

        webp_path = output_dir / webp_name

        # Open and add caption overlay
        with Image.open(img_path) as img:
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            width, height = img.size
            draw = ImageDraw.Draw(img)

            # Add caption overlay at bottom
            caption = get_caption(img_path, descriptions)
            caption_height = 60
            draw.rectangle([0, height - caption_height, width, height], fill='#1a1a1aCC')
            caption_font = get_font(16, bold=True)
            draw.text((width // 2, height - caption_height // 2), caption,
                     fill='#e0e0e0', font=caption_font, anchor='mm')

            img.save(webp_path, 'WEBP', quality=quality, method=6)

        original_size = Path(img_path).stat().st_size
        webp_size = webp_path.stat().st_size
        total_original += original_size
        total_webp += webp_size

        metadata['images'].append({
            'filename': webp_name,
            'caption': caption,
            'original_size': original_size,
            'webp_size': webp_size
        })

        if (i + 1) % 10 == 0:
            print(f"   Converted {i + 1}/{len(images)} images...")

    # Save metadata
    metadata_path = output_dir / 'album.json'
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)

    # Calculate savings
    savings = (1 - total_webp / total_original) * 100 if total_original > 0 else 0

    print(f"\n✅ WebP album created: {output_dir}")
    print(f"   Total images: {len(images)}")
    print(f"   Original size: {total_original / (1024*1024):.1f} MB")
    print(f"   WebP size: {total_webp / (1024*1024):.1f} MB")
    print(f"   Savings: {savings:.1f}%")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Create WebP image album')
    parser.add_argument('base_dir', help='Base directory or specific imaginize_* directory')
    parser.add_argument('output_dir', help='Output directory for WebP images')
    parser.add_argument('--title', default='Illustrated Book', help='Book title')
    parser.add_argument('--author', default='Unknown', help='Book author')
    parser.add_argument('--quality', type=int, default=85, help='WebP quality (0-100)')

    args = parser.parse_args()

    imaginize_dir = Path(args.base_dir) if Path(args.base_dir).name.startswith('imaginize_') else None

    print(f"📚 Creating WebP album from: {args.base_dir}")
    print(f"📄 Output directory: {args.output_dir}")

    images = collect_images(args.base_dir)

    if not images:
        print("❌ No images found!")
        sys.exit(1)

    print(f"📸 Found {len(images)} images")
    create_webp_album(images, args.output_dir, title=args.title, author=args.author,
                      imaginize_dir=imaginize_dir, quality=args.quality)
