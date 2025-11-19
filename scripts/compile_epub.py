#!/usr/bin/env python3
"""
Compile images into an EPUB eBook with fixed layout for image viewing.
"""

import os
import sys
import uuid
import zipfile
from pathlib import Path
from PIL import Image
import re
from datetime import datetime

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
    """Get caption for image from descriptions."""
    filename = Path(img_path).stem
    match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
    if match:
        chapter, scene = match.group(1), match.group(2)
        if (chapter, scene) in descriptions:
            desc = descriptions[(chapter, scene)]
            # Extract 2-5 key words
            words = desc.split()
            skip_words = {'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'or', 'is', 'are'}
            key_words = [w for w in words if w.lower() not in skip_words][:5]
            return ' '.join(key_words) if key_words else ''
        return f"Chapter {chapter}, Scene {scene}"
    return ""

def create_epub(images, output_path, title="Illustrated Book", author="Unknown", imaginize_dir=None):
    """Create EPUB with fixed layout pages for each image."""

    book_uuid = str(uuid.uuid4())
    descriptions = load_scene_descriptions(imaginize_dir) if imaginize_dir else {}

    print(f"📖 Creating EPUB with {len(images)} images...")

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as epub:
        # mimetype (must be first, uncompressed)
        epub.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)

        # container.xml
        container = '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>'''
        epub.writestr('META-INF/container.xml', container)

        # Build manifest and spine items
        manifest_items = []
        spine_items = []

        # Add images and create XHTML pages
        for i, img_path in enumerate(images):
            img_name = f"image_{i:04d}.png"
            page_id = f"page_{i:04d}"

            # Add image to EPUB
            epub.write(img_path, f'OEBPS/images/{img_name}')
            manifest_items.append(f'    <item id="{img_name}" href="images/{img_name}" media-type="image/png"/>')

            # Get image dimensions
            with Image.open(img_path) as img:
                width, height = img.size

            # Create XHTML page for image
            caption = get_caption(img_path, descriptions)
            xhtml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>{caption or f"Page {i+1}"}</title>
  <meta name="viewport" content="width={width}, height={height}"/>
  <style>
    body {{ margin: 0; padding: 0; background: #1a1a1a; }}
    .page {{ width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }}
    img {{ max-width: 100%; max-height: 90%; object-fit: contain; }}
    .caption {{ color: #e0e0e0; font-family: sans-serif; font-size: 14px; text-align: center; padding: 10px; }}
  </style>
</head>
<body>
  <div class="page">
    <img src="images/{img_name}" alt="{caption}"/>
    <div class="caption">{caption}</div>
  </div>
</body>
</html>'''
            epub.writestr(f'OEBPS/{page_id}.xhtml', xhtml)
            manifest_items.append(f'    <item id="{page_id}" href="{page_id}.xhtml" media-type="application/xhtml+xml"/>')
            spine_items.append(f'    <itemref idref="{page_id}"/>')

            if (i + 1) % 10 == 0:
                print(f"   Processed {i + 1}/{len(images)} images...")

        # Create content.opf
        content_opf = f'''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:{book_uuid}</dc:identifier>
    <dc:title>{title}</dc:title>
    <dc:creator>{author}</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>imaginize</dc:publisher>
    <dc:date>{datetime.now().strftime('%Y-%m-%d')}</dc:date>
    <meta property="dcterms:modified">{datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')}</meta>
    <meta name="fixed-layout" content="true"/>
    <meta name="original-resolution" content="1024x1024"/>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
{chr(10).join(manifest_items)}
  </manifest>
  <spine>
{chr(10).join(spine_items)}
  </spine>
</package>'''
        epub.writestr('OEBPS/content.opf', content_opf)

        # Create navigation document
        nav_items = []
        for i, img_path in enumerate(images):
            caption = get_caption(img_path, descriptions) or f"Page {i+1}"
            nav_items.append(f'      <li><a href="page_{i:04d}.xhtml">{caption}</a></li>')

        nav_xhtml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
{chr(10).join(nav_items)}
    </ol>
  </nav>
</body>
</html>'''
        epub.writestr('OEBPS/nav.xhtml', nav_xhtml)

    size_mb = Path(output_path).stat().st_size / (1024 * 1024)
    print(f"\n✅ EPUB created: {output_path}")
    print(f"   Total images: {len(images)}")
    print(f"   File size: {size_mb:.1f} MB")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Compile images into EPUB eBook')
    parser.add_argument('base_dir', help='Base directory or specific imaginize_* directory')
    parser.add_argument('output_file', help='Output EPUB filename')
    parser.add_argument('--title', default='Illustrated Book', help='Book title')
    parser.add_argument('--author', default='Unknown', help='Book author')

    args = parser.parse_args()

    imaginize_dir = Path(args.base_dir) if Path(args.base_dir).name.startswith('imaginize_') else None

    print(f"📚 Compiling EPUB from: {args.base_dir}")
    print(f"📄 Output file: {args.output_file}")

    images = collect_images(args.base_dir)

    if not images:
        print("❌ No images found!")
        sys.exit(1)

    print(f"📸 Found {len(images)} images")
    create_epub(images, args.output_file, title=args.title, author=args.author, imaginize_dir=imaginize_dir)
