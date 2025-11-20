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

def get_short_caption(img_path, descriptions):
    """Get short caption for TOC."""
    filename = Path(img_path).stem
    match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
    if match:
        chapter, scene = match.group(1), match.group(2)
        if (chapter, scene) in descriptions:
            desc = descriptions[(chapter, scene)][:50]
            if len(descriptions[(chapter, scene)]) > 50:
                desc += "..."
            return f"Ch{chapter} Sc{scene}: {desc}"
        return f"Chapter {chapter}, Scene {scene}"
    return Path(img_path).stem

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

        # Create title page
        title_xhtml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>{title}</title>
  <style>
    body {{ margin: 0; padding: 0; background: #1a1a1a; display: flex; align-items: center; justify-content: center; height: 100vh; }}
    .title-page {{ text-align: center; color: #e0e0e0; font-family: sans-serif; }}
    h1 {{ font-size: 48px; margin-bottom: 20px; }}
    .author {{ font-size: 24px; color: #888888; }}
  </style>
</head>
<body>
  <div class="title-page">
    <h1>{title}</h1>
    <p class="author">by {author}</p>
  </div>
</body>
</html>'''
        epub.writestr('OEBPS/title.xhtml', title_xhtml)
        manifest_items.append('    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>')
        spine_items.append('    <itemref idref="title"/>')

        # Create metadata page
        meta_xhtml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>About This Book</title>
  <style>
    body {{ margin: 0; padding: 40px; background: #1a1a1a; color: #e0e0e0; font-family: sans-serif; }}
    .metadata {{ max-width: 600px; margin: 0 auto; }}
    h1 {{ color: #4a9eff; font-size: 36px; text-align: center; }}
    .info {{ margin: 30px 0; }}
    .info p {{ margin: 10px 0; color: #aaaaaa; }}
    .footer {{ text-align: center; margin-top: 50px; color: #666666; font-size: 14px; }}
    .footer a {{ color: #4a9eff; text-decoration: none; }}
  </style>
</head>
<body>
  <div class="metadata">
    <h1>AI Illustrated by imaginize</h1>
    <div class="info">
      <p><strong>Title:</strong> {title}</p>
      <p><strong>Author:</strong> {author}</p>
      <p><strong>Images:</strong> {len(images)}</p>
      <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d')}</p>
    </div>
    <div class="footer">
      <p>github.com/tribixbite/imaginize</p>
    </div>
  </div>
</body>
</html>'''
        epub.writestr('OEBPS/metadata.xhtml', meta_xhtml)
        manifest_items.append('    <item id="metadata" href="metadata.xhtml" media-type="application/xhtml+xml"/>')
        spine_items.append('    <itemref idref="metadata"/>')

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

            # Create XHTML page for image with better caption handling
            caption = get_caption(img_path, descriptions)

            # Extract chapter/scene for title
            filename = Path(img_path).stem
            match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
            if match:
                page_title = f"Chapter {match.group(1)}, Scene {match.group(2)}"
            else:
                page_title = f"Page {i+1}"

            # Truncate very long captions for display
            display_caption = caption
            if len(caption) > 150:
                display_caption = caption[:147] + "..."

            xhtml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>{page_title}</title>
  <meta name="viewport" content="width={width}, height={height}"/>
  <style>
    body {{ margin: 0; padding: 0; background: #1a1a1a; }}
    .page {{ width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }}
    img {{ max-width: 100%; max-height: 85%; object-fit: contain; }}
    .caption-box {{ background: #2a2a2a; padding: 15px 20px; margin: 10px; border-radius: 8px; max-width: 90%; }}
    .caption-title {{ color: #4a9eff; font-family: sans-serif; font-size: 16px; font-weight: bold; margin-bottom: 8px; text-align: center; }}
    .caption-desc {{ color: #e0e0e0; font-family: sans-serif; font-size: 14px; text-align: center; line-height: 1.4; }}
  </style>
</head>
<body>
  <div class="page">
    <img src="images/{img_name}" alt="{page_title}"/>
    <div class="caption-box">
      <div class="caption-title">{page_title}</div>
      <div class="caption-desc">{display_caption}</div>
    </div>
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
