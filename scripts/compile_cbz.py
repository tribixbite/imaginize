#!/usr/bin/env python3
"""
Compile images into a CBZ (Comic Book Zip) archive with metadata pages.
CBZ is a widely supported format for comic readers.
"""

import os
import sys
import json
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import re

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

def load_scene_descriptions(imaginize_dir):
    """Load full scene descriptions from Chapters.md file."""
    descriptions = {}
    chapters_file = Path(imaginize_dir) / 'Chapters.md'

    if not chapters_file.exists():
        return descriptions

    try:
        with open(chapters_file, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.split('\n')
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            if '**Visual Elements:**' in line:
                desc_line = line.split('**Visual Elements:**', 1)[1].strip()
                full_desc = desc_line
                k = i + 1
                while k < len(lines) and lines[k].strip() and not lines[k].startswith('**'):
                    full_desc += ' ' + lines[k].strip()
                    k += 1

                # Look for the image reference
                for j in range(i, min(i+15, len(lines))):
                    if 'chapter_' in lines[j] and '_scene_' in lines[j]:
                        match = re.search(r'chapter_(\d+)_scene_(\d+)', lines[j])
                        if match:
                            descriptions[(match.group(1), match.group(2))] = full_desc.strip()
                        break
            i += 1

        print(f"✅ Loaded {len(descriptions)} scene descriptions")

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
    """Get concise caption for image."""
    filename = Path(img_path).stem
    match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
    if match:
        chapter, scene = match.group(1), match.group(2)
        if (chapter, scene) in descriptions:
            return extract_smart_caption(descriptions[(chapter, scene)])
        return f"Chapter {chapter}, Scene {scene}"
    return Path(img_path).stem

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

def create_page_image(width, height, bg_color='#1a1a1a'):
    """Create a blank page image with dark background."""
    return Image.new('RGB', (width, height), color=bg_color)

def create_title_page(title, author, width=1024, height=1024):
    """Create title/cover page."""
    img = create_page_image(width, height)
    draw = ImageDraw.Draw(img)

    title_font = get_font(60, bold=True)
    author_font = get_font(36)

    # Title
    draw.text((width//2, height//2 - 50), title, fill='#e0e0e0', font=title_font, anchor='mm')
    # Author
    draw.text((width//2, height//2 + 50), f"by {author}", fill='#888888', font=author_font, anchor='mm')

    return img

def create_metadata_page(title, author, num_images, width=1024, height=1024):
    """Create metadata/credits page."""
    img = create_page_image(width, height)
    draw = ImageDraw.Draw(img)

    title_font = get_font(36, bold=True)
    text_font = get_font(24)
    accent_font = get_font(48, bold=True)

    y = 200
    draw.text((width//2, y), "AI Illustrated by", fill='#e0e0e0', font=title_font, anchor='mm')
    y += 80
    draw.text((width//2, y), "imaginize", fill='#4a9eff', font=accent_font, anchor='mm')

    y += 150
    metadata = [
        f"Title: {title}",
        f"Author: {author}",
        f"Images: {num_images}",
        "",
        "github.com/tribixbite/imaginize"
    ]

    for line in metadata:
        draw.text((width//2, y), line, fill='#aaaaaa', font=text_font, anchor='mm')
        y += 40

    return img

def create_toc_page(images, descriptions, width=1024, height=1024):
    """Create table of contents page."""
    img = create_page_image(width, height)
    draw = ImageDraw.Draw(img)

    title_font = get_font(36, bold=True)
    item_font = get_font(16)

    draw.text((width//2, 80), "Table of Contents", fill='#e0e0e0', font=title_font, anchor='mm')

    y = 150
    max_items = (height - 200) // 25

    for i, img_path in enumerate(images[:max_items]):
        filename = Path(img_path).stem
        match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
        if match:
            chapter, scene = match.group(1), match.group(2)
            # Get short caption (first 40 chars)
            caption = get_caption(img_path, descriptions)[:40]
            if len(get_caption(img_path, descriptions)) > 40:
                caption += "..."
            text = f"{i+1}. Ch{chapter} Sc{scene}: {caption}"
        else:
            text = f"{i+1}. {filename}"

        draw.text((50, y), text, fill='#aaaaaa', font=item_font, anchor='lm')
        y += 25

    if len(images) > max_items:
        draw.text((50, y + 10), f"... and {len(images) - max_items} more", fill='#666666', font=item_font, anchor='lm')

    return img

def add_caption_overlay(img_path, caption, output_path):
    """Add caption overlay to image and save as PNG."""
    with Image.open(img_path) as img:
        if img.mode != 'RGB':
            img = img.convert('RGB')

        draw = ImageDraw.Draw(img)
        width, height = img.size

        # Caption background
        caption_height = 80
        draw.rectangle([0, height - caption_height, width, height], fill='#1a1a1aCC')

        # Caption text (wrap if needed)
        font = get_font(18, bold=True)
        small_font = get_font(14)

        # Split caption into title and description
        if len(caption) > 60:
            # Show chapter/scene on top, description below
            match = re.search(r'chapter_(\d+)_scene_(\d+)', Path(img_path).stem)
            if match:
                title = f"Chapter {match.group(1)}, Scene {match.group(2)}"
                desc = caption[:80] + "..." if len(caption) > 80 else caption
            else:
                title = caption[:40]
                desc = caption[40:120] if len(caption) > 40 else ""

            draw.text((width//2, height - caption_height + 25), title, fill='#e0e0e0', font=font, anchor='mm')
            draw.text((width//2, height - caption_height + 55), desc, fill='#aaaaaa', font=small_font, anchor='mm')
        else:
            draw.text((width//2, height - caption_height//2), caption, fill='#e0e0e0', font=font, anchor='mm')

        img.save(output_path, 'PNG')

def create_comicinfo_xml(title, author, num_pages):
    """Create ComicInfo.xml for CBZ metadata."""
    return f'''<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Title>{title}</Title>
  <Writer>{author}</Writer>
  <Publisher>imaginize</Publisher>
  <Genre>AI Illustrated</Genre>
  <PageCount>{num_pages}</PageCount>
  <Notes>Generated by imaginize - AI-powered book illustration</Notes>
  <Web>https://github.com/tribixbite/imaginize</Web>
</ComicInfo>'''

def create_cbz(images, output_path, title="Illustrated Book", author="Unknown", imaginize_dir=None):
    """Create CBZ archive with metadata pages and captioned images."""

    descriptions = load_scene_descriptions(imaginize_dir) if imaginize_dir else {}

    print(f"📦 Creating CBZ archive with {len(images)} images...")

    # Create temp directory for processed images
    import tempfile
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        page_num = 0

        # Create title page
        title_img = create_title_page(title, author)
        title_path = temp_path / f"{page_num:04d}_title.png"
        title_img.save(title_path)
        page_num += 1

        # Create metadata page
        meta_img = create_metadata_page(title, author, len(images))
        meta_path = temp_path / f"{page_num:04d}_metadata.png"
        meta_img.save(meta_path)
        page_num += 1

        # Create TOC page
        toc_img = create_toc_page(images, descriptions)
        toc_path = temp_path / f"{page_num:04d}_toc.png"
        toc_img.save(toc_path)
        page_num += 1

        # Process images with captions
        for i, img_path in enumerate(images):
            filename = Path(img_path).stem
            match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
            if match:
                new_name = f"{page_num:04d}_ch{match.group(1)}_sc{match.group(2)}.png"
            else:
                new_name = f"{page_num:04d}_{filename}.png"

            caption = get_caption(img_path, descriptions)
            out_path = temp_path / new_name
            add_caption_overlay(img_path, caption, out_path)
            page_num += 1

            if (i + 1) % 10 == 0:
                print(f"   Processed {i + 1}/{len(images)} images...")

        # Create CBZ
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as cbz:
            # Add ComicInfo.xml
            comic_info = create_comicinfo_xml(title, author, page_num)
            cbz.writestr('ComicInfo.xml', comic_info)

            # Add all pages
            for png_file in sorted(temp_path.glob('*.png')):
                cbz.write(png_file, png_file.name)

    size_mb = Path(output_path).stat().st_size / (1024 * 1024)
    print(f"\n✅ CBZ created: {output_path}")
    print(f"   Total pages: {page_num}")
    print(f"   File size: {size_mb:.1f} MB")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Compile images into CBZ comic archive')
    parser.add_argument('base_dir', help='Base directory or specific imaginize_* directory')
    parser.add_argument('output_file', help='Output CBZ filename')
    parser.add_argument('--title', default='Illustrated Book', help='Book title')
    parser.add_argument('--author', default='Unknown', help='Book author')

    args = parser.parse_args()

    imaginize_dir = Path(args.base_dir) if Path(args.base_dir).name.startswith('imaginize_') else None

    print(f"📚 Compiling CBZ from: {args.base_dir}")
    print(f"📄 Output file: {args.output_file}")

    images = collect_images(args.base_dir)

    if not images:
        print("❌ No images found!")
        sys.exit(1)

    print(f"📸 Found {len(images)} images")
    create_cbz(images, args.output_file, title=args.title, author=args.author, imaginize_dir=imaginize_dir)
