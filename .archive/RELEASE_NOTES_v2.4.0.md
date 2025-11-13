# imaginize v2.4.0 - Release Notes

**Release Date:** November 12, 2025
**Type:** Minor Release (Feature Addition)

## 🎨 Major Features

### Visual Style Consistency System

Automatically maintains professional, cohesive visual identity across **all** generated images:

**Before v2.4.0:**
- Each image generated independently
- Inconsistent art styles, colors, lighting
- Characters look different in every scene
- No visual coherence across the book

**After v2.4.0:**
- Automatic style extraction from first 3 images
- Consistent art style, color palette, and lighting
- Characters appear the same in all scenes
- Professional, cohesive illustration sets

### Bootstrap Phase

After generating the first N images (default: 3):
1. GPT-4 Vision analyzes all bootstrap images
2. Extracts common patterns:
   - **Art Style:** "Digital illustration with soft brush strokes"
   - **Color Palette:** `#3A5F7D`, `#C9A961`, `#8B6F47`, etc.
   - **Lighting:** "Natural daylight with warm undertones"
   - **Mood:** "Whimsical and adventurous"
   - **Composition:** "Medium shots with characters centered"
3. Saves to `data/style-guide.json`
4. Applies to **all** subsequent image prompts

### Character Appearance Tracking

Ensures characters look the same across all appearances:

**First Appearance:**
```markdown
Christopher - First seen in Chapter 1
Visual Features:
  • Hair: Dark, messy
  • Eyes: Brown, curious
  • Build: Tall, gangly
  • Clothing: Navy wool overcoat, casual underneath
```

**Subsequent Appearances:**
Every prompt with Christopher automatically includes:
```
CHARACTER APPEARANCES (maintain visual consistency):
Christopher - Appearance Reference:
  • Hair: Dark, messy
  • Eyes: Brown, curious
  • Clothing: Navy wool overcoat, casual underneath
  • IMPORTANT: Maintain visual consistency with previous 5 appearance(s)
```

### Enhanced Image Prompts

Every image prompt is automatically enriched with:

```
[Original scene description]

VISUAL STYLE GUIDE (maintain consistency):
- Art Style: Digital illustration with soft brush strokes
- Color Palette: #3A5F7D, #C9A961, #8B6F47, #E8D5B7, #5A7D8F
- Lighting: Natural lighting with balanced exposure
- Mood: Whimsical and adventurous
- Composition: Medium shots with characters centered

CHARACTER APPEARANCES (maintain visual consistency):
[Character references for all characters in scene]

IMPORTANT - Maintain Consistency:
- Maintain the established visual style
- Use the defined color palette
- Match the lighting and mood characteristics
- Ensure character appearances match their previous depictions
```

## ⚙️ Configuration

New configuration options in `.imaginize.config`:

```yaml
# Enable/disable visual consistency system (default: true)
enableStyleConsistency: true

# Number of images to analyze for style guide (default: 3)
styleBootstrapCount: 3

# Track character appearances across images (default: true)
trackCharacterAppearances: true

# Minimum consistency score for warnings (default: 0.7)
consistencyThreshold: 0.7
```

## 📁 New Output Files

### data/style-guide.json

Created automatically after bootstrap phase:

```json
{
  "artStyle": "Digital illustration with soft brush strokes",
  "colorPalette": ["#3A5F7D", "#C9A961", "#8B6F47", "#E8D5B7", "#5A7D8F"],
  "lighting": "Natural lighting with balanced exposure",
  "mood": "Whimsical and adventurous",
  "composition": "Medium shots with characters centered",
  "consistencyScore": 0.85,
  "createdAt": "2025-11-12T...",
  "bootstrapCount": 3
}
```

### data/character-registry.json

Tracks all character appearances:

```json
{
  "Christopher": {
    "firstAppearance": {
      "chapterNumber": 1,
      "sceneNumber": 1,
      "imagePath": "chapter_1_the_beginning_scene_1.png",
      "description": "A young boy with a tall, gangly build..."
    },
    "visualFeatures": {
      "hairColor": "dark",
      "hairStyle": "messy",
      "eyeColor": "brown",
      "build": "tall, gangly",
      "clothing": ["navy wool overcoat", "casual underneath"]
    },
    "appearances": [
      {"chapterNumber": 1, "sceneNumber": 1, "consistencyScore": 1.0},
      {"chapterNumber": 3, "sceneNumber": 2, "consistencyScore": 0.92},
      {"chapterNumber": 5, "sceneNumber": 1, "consistencyScore": 0.88}
    ]
  }
}
```

## 🔧 Technical Details

### New Module: `src/lib/visual-style/`

Five new files (~1,300 LOC):
- `types.ts` - TypeScript interfaces
- `style-guide.ts` - Style guide utilities
- `character-registry.ts` - CharacterRegistry class
- `style-analyzer.ts` - GPT-4 Vision integration
- `prompt-enhancer.ts` - Prompt enrichment

### Integration Changes

Modified `src/lib/phases/illustrate-phase-v2.ts`:
- Bootstrap phase logic (checkBootstrapPhase, performBootstrap)
- Enhanced prompt generation with visual style
- Character appearance registration after each image
- Elements.md integration for character descriptions

### Requirements

- **GPT-4 Vision** for style analysis (uses existing OpenAI API key)
- No additional dependencies
- Fully backward compatible

### Fallback Behavior

If GPT-4 Vision analysis fails:
- Falls back to text-based style guide (existing behavior)
- Character tracking continues with Elements.md descriptions
- No errors or interruptions

## 📊 Performance Impact

**Analysis Phase:**
- Bootstrap adds ~10-15 seconds after 3rd image (one-time)
- Uses GPT-4 Vision API (same cost as other OpenAI calls)

**Generation Phase:**
- Prompt enrichment adds ~50-100 tokens per image
- Minimal performance impact (~1-2 seconds per image)

**Total Cost Impact:**
- Bootstrap analysis: ~$0.01-0.02 (one-time per book)
- Enhanced prompts: ~$0.001-0.002 per image
- **Result:** Professional consistency at minimal cost

## 🆙 Upgrade Guide

### From v2.3.0 to v2.4.0

**No breaking changes** - fully backward compatible!

1. Update package:
   ```bash
   npm install -g imaginize@2.4.0
   # or
   npx imaginize@2.4.0
   ```

2. (Optional) Add configuration:
   ```yaml
   # .imaginize.config
   enableStyleConsistency: true
   styleBootstrapCount: 3
   trackCharacterAppearances: true
   consistencyThreshold: 0.7
   ```

3. Generate images as usual:
   ```bash
   imaginize --images --file mybook.epub
   ```

### Disabling Visual Consistency

To use v2.4.0 without visual consistency (v2.3.0 behavior):

```yaml
# .imaginize.config
enableStyleConsistency: false
trackCharacterAppearances: false
```

## 🐛 Known Issues

None at release.

## 🔮 Future Enhancements

Potential improvements for future versions:
- Support for multiple style guides per book (different sections)
- Manual style guide editing
- Style guide import/export between projects
- Advanced character pose/expression tracking
- ControlNet integration for even tighter consistency

## 📚 Documentation

- **Architecture:** `docs/IMAGE_QUALITY_ARCHITECTURE.md`
- **Status:** `docs/IMAGE_QUALITY_STATUS.md`
- **README:** New "Visual Consistency (v2.4.0+)" section
- **CHANGELOG:** Complete v2.4.0 entry

## 🙏 Acknowledgments

This feature implements the original vision for imaginize: **professional, cohesive illustration guides** that maintain visual consistency across entire books.

Special thanks to:
- GPT-4 Vision for style analysis capabilities
- OpenAI for multimodal API support
- The TypeScript community for excellent type safety

---

**Questions or feedback?** Please file issues at:
https://github.com/anthropics/imaginize/issues
