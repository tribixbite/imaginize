#!/usr/bin/env python3
"""
Compile images into optimized WebP format album (smaller than PNG).
Creates a directory of WebP images with metadata JSON.
"""

import os
import sys
import json
from pathlib import Path
from PIL import Image
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
            # Return full description for metadata
            return descriptions[(chapter, scene)]
        return f"Chapter {chapter}, Scene {scene}"
    return ""

def create_webp_album(images, output_path, title="Illustrated Book", author="Unknown", imaginize_dir=None, quality=85):
    """
    Convert images to WebP format and create album.

    Args:
        images: List of image paths
        output_path: Output directory or zip path
        title: Book title
        author: Author name
        imaginize_dir: Path to imaginize directory
        quality: WebP quality (0-100)
    """
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

    for i, img_path in enumerate(images):
        filename = Path(img_path).stem
        match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
        if match:
            webp_name = f"{i:04d}_ch{match.group(1)}_sc{match.group(2)}.webp"
        else:
            webp_name = f"{i:04d}_{filename}.webp"

        webp_path = output_dir / webp_name

        # Convert to WebP
        with Image.open(img_path) as img:
            # Convert to RGB if necessary (WebP doesn't support all modes)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            img.save(webp_path, 'WEBP', quality=quality, method=6)

        original_size = Path(img_path).stat().st_size
        webp_size = webp_path.stat().st_size
        total_original += original_size
        total_webp += webp_size

        caption = get_caption(img_path, descriptions)

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
