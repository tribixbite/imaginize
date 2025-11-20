#!/usr/bin/env python3
"""
Generate an HTML gallery from images with dark theme and captions.
"""

import os
import sys
import shutil
import base64
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
    return Path(img_path).stem

def get_short_caption(img_path, descriptions):
    """Get short caption for TOC display."""
    filename = Path(img_path).stem
    match = re.search(r'chapter_(\d+)_scene_(\d+)', filename)
    if match:
        chapter, scene = match.group(1), match.group(2)
        if (chapter, scene) in descriptions:
            desc = descriptions[(chapter, scene)][:50]
            if len(descriptions[(chapter, scene)]) > 50:
                desc += "..."
            return f"Ch {chapter}, Sc {scene}: {desc}"
        return f"Chapter {chapter}, Scene {scene}"
    return Path(img_path).stem

def create_html_gallery(images, output_path, title="Illustrated Book", author="Unknown", imaginize_dir=None):
    """Create HTML gallery with embedded images."""

    descriptions = load_scene_descriptions(imaginize_dir) if imaginize_dir else {}
    output_dir = Path(output_path).parent
    html_file = Path(output_path)

    print(f"🌐 Creating HTML gallery with {len(images)} images...")

    # Build gallery items
    gallery_items = []
    for i, img_path in enumerate(images):
        caption = get_caption(img_path, descriptions)

        # Read image and convert to base64 for embedding
        with open(img_path, 'rb') as f:
            img_data = base64.b64encode(f.read()).decode('utf-8')

        gallery_items.append(f'''
    <div class="gallery-item" onclick="openModal({i})">
      <img src="data:image/png;base64,{img_data}" alt="{caption}" loading="lazy"/>
      <div class="caption">{caption}</div>
    </div>''')

        if (i + 1) % 10 == 0:
            print(f"   Processed {i + 1}/{len(images)} images...")

    # Build modal data
    modal_data = []
    for i, img_path in enumerate(images):
        caption = get_caption(img_path, descriptions)
        with open(img_path, 'rb') as f:
            img_data = base64.b64encode(f.read()).decode('utf-8')
        modal_data.append(f'{{src: "data:image/png;base64,{img_data}", caption: "{caption}"}}')

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} - Image Gallery</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      padding: 20px;
      background: #1a1a1a;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }}
    header {{
      text-align: center;
      padding: 20px 0 40px;
    }}
    h1 {{
      margin: 0 0 10px;
      color: #fff;
    }}
    .subtitle {{
      color: #888;
      font-size: 14px;
    }}
    .gallery {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }}
    .gallery-item {{
      background: #2a2a2a;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }}
    .gallery-item:hover {{
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }}
    .gallery-item img {{
      width: 100%;
      height: 280px;
      object-fit: cover;
      display: block;
    }}
    .caption {{
      padding: 12px;
      font-size: 13px;
      color: #ccc;
      text-align: center;
    }}
    .modal {{
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.95);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }}
    .modal.active {{
      display: flex;
    }}
    .modal-content {{
      max-width: 90%;
      max-height: 90%;
      text-align: center;
    }}
    .modal-content img {{
      max-width: 100%;
      max-height: 80vh;
      border-radius: 4px;
    }}
    .modal-caption {{
      margin-top: 15px;
      font-size: 16px;
    }}
    .modal-nav {{
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255,255,255,0.1);
      border: none;
      color: #fff;
      font-size: 30px;
      padding: 20px;
      cursor: pointer;
    }}
    .modal-nav:hover {{
      background: rgba(255,255,255,0.2);
    }}
    .modal-prev {{ left: 20px; }}
    .modal-next {{ right: 20px; }}
    .modal-close {{
      position: absolute;
      top: 20px;
      right: 30px;
      background: none;
      border: none;
      color: #fff;
      font-size: 40px;
      cursor: pointer;
    }}
    footer {{
      text-align: center;
      padding: 40px 20px;
      color: #666;
      font-size: 12px;
    }}
    footer a {{
      color: #4a9eff;
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <header>
    <h1>{title}</h1>
    <div class="subtitle">by {author} • {len(images)} images • Generated by imaginize</div>
  </header>

  <div class="gallery">
    {''.join(gallery_items)}
  </div>

  <div class="modal" id="modal">
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <button class="modal-nav modal-prev" onclick="prevImage()">&#10094;</button>
    <div class="modal-content">
      <img id="modal-img" src="" alt="">
      <div class="modal-caption" id="modal-caption"></div>
    </div>
    <button class="modal-nav modal-next" onclick="nextImage()">&#10095;</button>
  </div>

  <footer>
    Generated by <a href="https://github.com/tribixbite/imaginize">imaginize</a>
  </footer>

  <script>
    const images = [{','.join(modal_data)}];
    let currentIndex = 0;

    function openModal(index) {{
      currentIndex = index;
      updateModal();
      document.getElementById('modal').classList.add('active');
    }}

    function closeModal() {{
      document.getElementById('modal').classList.remove('active');
    }}

    function updateModal() {{
      document.getElementById('modal-img').src = images[currentIndex].src;
      document.getElementById('modal-caption').textContent = images[currentIndex].caption;
    }}

    function prevImage() {{
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      updateModal();
    }}

    function nextImage() {{
      currentIndex = (currentIndex + 1) % images.length;
      updateModal();
    }}

    document.addEventListener('keydown', (e) => {{
      if (!document.getElementById('modal').classList.contains('active')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    }});
  </script>
</body>
</html>'''

    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html)

    size_mb = html_file.stat().st_size / (1024 * 1024)
    print(f"\n✅ HTML gallery created: {html_file}")
    print(f"   Total images: {len(images)}")
    print(f"   File size: {size_mb:.1f} MB")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Generate HTML image gallery')
    parser.add_argument('base_dir', help='Base directory or specific imaginize_* directory')
    parser.add_argument('output_file', help='Output HTML filename')
    parser.add_argument('--title', default='Illustrated Book', help='Book title')
    parser.add_argument('--author', default='Unknown', help='Book author')

    args = parser.parse_args()

    imaginize_dir = Path(args.base_dir) if Path(args.base_dir).name.startswith('imaginize_') else None

    print(f"📚 Creating HTML gallery from: {args.base_dir}")
    print(f"📄 Output file: {args.output_file}")

    images = collect_images(args.base_dir)

    if not images:
        print("❌ No images found!")
        sys.exit(1)

    print(f"📸 Found {len(images)} images")
    create_html_gallery(images, args.output_file, title=args.title, author=args.author, imaginize_dir=imaginize_dir)
