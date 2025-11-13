# Visual Style System Specification

## Overview

imaginize implements an automatic visual style consistency system to ensure all generated images maintain a cohesive look and feel throughout the book. The system uses GPT-4 Vision to analyze initial images, extract style characteristics, and apply them to subsequent image generation.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Illustrate Phase                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Bootstrap Phase (First 3 images)                        │
│     ├─ Generate images with minimal style constraints       │
│     ├─ No style guide applied                               │
│     └─ Establishes baseline visual style                    │
│                                                              │
│  2. Style Analysis (After 3 images)                         │
│     ├─ Use GPT-4 Vision to analyze images                  │
│     ├─ Extract: colors, composition, technique, mood       │
│     ├─ Generate style-guide.json                            │
│     └─ Save for all subsequent images                       │
│                                                              │
│  3. Style-Guided Generation (Remaining images)              │
│     ├─ Read style-guide.json                                │
│     ├─ Inject style constraints into prompts               │
│     ├─ Maintain consistency across chapters                 │
│     └─ Update character-registry.json                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Enable/Disable Style System
```yaml
# .imaginize.config
enableVisualStyleConsistency: true   # Default: true
styleBootstrapImageCount: 3          # Default: 3
trackCharacterAppearances: true      # Default: true
```

### Configuration Options

#### `enableVisualStyleConsistency` (boolean)
- **Default**: `true`
- **Description**: Enable automatic style guide generation and application
- **Impact**: When `true`, analyzes first 3 images and applies style to remaining images

#### `styleBootstrapImageCount` (number)
- **Default**: `3`
- **Range**: `1-10`
- **Description**: Number of images to generate before style analysis
- **Recommended**: `3` (good balance of variety and speed)

#### `trackCharacterAppearances` (boolean)
- **Default**: `true`
- **Description**: Track character appearances across chapters
- **Output**: `character-registry.json` with per-chapter appearance details

## Style Guide Generation

### Bootstrap Phase

**First 3 Images**:
```typescript
// Generate without style constraints
const imagePrompt = `
GENRE: Fantasy
MOOD: ${scene.mood}
LIGHTING: ${scene.lighting}

SCENE: ${scene.description}

CHARACTERS:
${characterDescriptions}

TECHNICAL REQUIREMENTS:
- High detail, professional illustration quality
- 1024x1024 resolution
- No text overlays
`;

// No style guide injected
const imageUrl = await generateImage(imagePrompt);
```

**Why Bootstrap?**
- Let AI establish natural visual style
- Avoid premature style constraints
- Ensure variety before locking in style
- First images set the tone for entire book

### Style Analysis with GPT-4 Vision

**After 3rd Image Generated**:
```typescript
// src/lib/style-analyzer.ts

async function analyzeVisualStyle(
  imageUrls: string[],
  bookGenre: string
): Promise<StyleGuide> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze these ${imageUrls.length} illustrations from a ${bookGenre} book.

Extract the visual style characteristics that should be maintained across all future illustrations:

1. **Color Palette**: Dominant colors, color temperature, saturation levels
2. **Composition**: Framing, perspective, focal points, rule of thirds
3. **Art Style**: Technique (digital painting, watercolor, etc.), level of detail
4. **Lighting**: Quality (soft/hard), direction, mood, time of day
5. **Character Design**: Proportions, level of realism, clothing details
6. **Mood/Atmosphere**: Overall tone, emotional quality

Output a JSON style guide that can be used to instruct future image generation.`,
          },
          ...imageUrls.map(url => ({
            type: 'image_url' as const,
            image_url: { url },
          })),
        ],
      },
    ],
    max_tokens: 1000,
  });

  const styleText = response.choices[0]?.message?.content || '';
  return parseStyleGuide(styleText);
}
```

### Style Guide Format

**File**: `style-guide.json`

```json
{
  "version": 1,
  "generatedAt": "2025-11-13T12:00:00.000Z",
  "analyzedImages": [
    "chapter_1_the_beginning_scene_1.png",
    "chapter_2_discovery_scene_1.png",
    "chapter_3_first_encounter_scene_1.png"
  ],
  "bookGenre": "Fantasy",
  "styleGuide": {
    "colorPalette": {
      "dominantColors": ["#2C3E50", "#E74C3C", "#ECF0F1"],
      "temperature": "cool",
      "saturation": "moderate",
      "description": "Cool blues and grays with warm red accents, muted saturation for atmospheric feel"
    },
    "composition": {
      "framing": "medium-wide shots with emphasis on environment",
      "perspective": "eye-level to slightly low angle",
      "focalPoints": "rule of thirds, characters positioned off-center",
      "description": "Balanced compositions with environmental context, characters interact with setting"
    },
    "artStyle": {
      "technique": "digital painting with painterly brushwork",
      "detailLevel": "high detail on characters, moderate on backgrounds",
      "lineWork": "soft edges, minimal hard lines",
      "textures": "visible brush strokes, organic textures",
      "description": "Semi-realistic digital painting style with painterly quality"
    },
    "lighting": {
      "quality": "soft, diffused natural light",
      "direction": "three-quarter front lighting",
      "mood": "mysterious yet hopeful",
      "timeOfDay": "golden hour, dusk, overcast",
      "description": "Soft natural lighting with emphasis on mood and atmosphere"
    },
    "characterDesign": {
      "proportions": "realistic with slight stylization",
      "realism": "semi-realistic, expressive faces",
      "clothingDetail": "historically-inspired with fantasy elements",
      "description": "Believable characters with distinct personalities and period-appropriate clothing"
    },
    "moodAtmosphere": {
      "tone": "sense of wonder mixed with danger",
      "emotional": "tense yet adventurous",
      "description": "Atmospheric fantasy with emphasis on mystery and discovery"
    }
  },
  "promptTemplate": "Digital painting in semi-realistic style. Cool color palette with blues, grays, and warm red accents. Soft natural lighting, golden hour or overcast atmosphere. Medium-wide framing with characters positioned using rule of thirds. Painterly brushwork with visible strokes, high detail on characters. Mysterious yet hopeful mood with sense of wonder."
}
```

### Prompt Template Generation
```typescript
function generatePromptTemplate(styleGuide: StyleGuide): string {
  const { colorPalette, artStyle, lighting, composition, moodAtmosphere } = styleGuide;

  return `
${artStyle.description}.
${colorPalette.description}.
${lighting.description}.
${composition.description}.
${artStyle.textures ? `Textures: ${artStyle.textures}.` : ''}
${moodAtmosphere.description}.
  `.trim();
}
```

## Style-Guided Image Generation

### Prompt Injection
```typescript
// src/lib/image-generator.ts

async function generateImageWithStyle(
  scene: VisualScene,
  characters: EntityDescription[],
  styleGuide: StyleGuide | null
): Promise<string> {
  let prompt = `
GENRE: Fantasy
MOOD: ${scene.mood}
LIGHTING: ${scene.lighting}

SCENE: ${scene.description}

CHARACTERS:
${formatCharacters(characters)}

TECHNICAL REQUIREMENTS:
- High detail, professional illustration quality
- 1024x1024 resolution
- No text overlays
`;

  // Inject style guide if available
  if (styleGuide) {
    prompt += `\n\nSTYLE REQUIREMENTS (CRITICAL - MAINTAIN CONSISTENCY):
${styleGuide.promptTemplate}

Specific style constraints:
- Color palette: ${styleGuide.styleGuide.colorPalette.description}
- Art technique: ${styleGuide.styleGuide.artStyle.technique}
- Lighting: ${styleGuide.styleGuide.lighting.description}
- Composition: ${styleGuide.styleGuide.composition.description}
- Match the established visual style from previous illustrations
`;
  }

  return await generateImage(prompt);
}
```

### Example: Before vs After Style Guide

**Before Style Guide (Image 1)**:
```
GENRE: Fantasy
MOOD: tense
LIGHTING: late afternoon, golden hour

SCENE: Christopher stands at the edge of Irongate Forest, tall pines looming overhead...

CHARACTERS:
- Christopher: Young boy, tall and gangly, navy wool overcoat...

TECHNICAL REQUIREMENTS:
- High detail, professional illustration quality
- 1024x1024 resolution
```

**After Style Guide (Image 4+)**:
```
GENRE: Fantasy
MOOD: tense
LIGHTING: late afternoon, golden hour

SCENE: Christopher stands at the edge of Irongate Forest, tall pines looming overhead...

CHARACTERS:
- Christopher: Young boy, tall and gangly, navy wool overcoat...

TECHNICAL REQUIREMENTS:
- High detail, professional illustration quality
- 1024x1024 resolution

STYLE REQUIREMENTS (CRITICAL - MAINTAIN CONSISTENCY):
Digital painting in semi-realistic style. Cool color palette with blues, grays, and warm red accents. Soft natural lighting, golden hour or overcast atmosphere. Medium-wide framing with characters positioned using rule of thirds. Painterly brushwork with visible strokes, high detail on characters. Mysterious yet hopeful mood with sense of wonder.

Specific style constraints:
- Color palette: Cool blues and grays with warm red accents, muted saturation
- Art technique: digital painting with painterly brushwork
- Lighting: soft, diffused natural light
- Composition: medium-wide shots with rule of thirds positioning
- Match the established visual style from previous illustrations
```

## Character Appearance Tracking

### Character Registry Format

**File**: `character-registry.json`

```json
{
  "version": 1,
  "generatedAt": "2025-11-13T15:00:00.000Z",
  "characters": {
    "Christopher": {
      "type": "character",
      "baseDescription": "Young boy with tall, gangly build, wearing a long navy wool overcoat with brass buttons, brown leather boots, and a worn leather satchel. Messy dark brown hair, bright blue eyes, pale complexion.",
      "appearances": [
        {
          "chapter": 1,
          "scene": 1,
          "imageFile": "chapter_1_the_beginning_scene_1.png",
          "contextualDescription": "Standing nervously at forest edge, hands clutching satchel strap",
          "visualNotes": "Navy overcoat prominent, afternoon lighting"
        },
        {
          "chapter": 3,
          "scene": 1,
          "imageFile": "chapter_3_first_encounter_scene_1.png",
          "contextualDescription": "Running through forest, overcoat billowing behind",
          "visualNotes": "Motion blur on coat, dynamic pose"
        },
        {
          "chapter": 9,
          "scene": 2,
          "imageFile": "chapter_9_the_reveal_scene_2.png",
          "contextualDescription": "Standing in candlelit room, examining old map",
          "visualNotes": "Softer lighting, close-up on face showing determination"
        }
      ],
      "totalAppearances": 3,
      "lastUpdated": "2025-11-13T15:00:00.000Z"
    },
    "Black Doglike Creature": {
      "type": "creature",
      "baseDescription": "Large doglike creature with sleek black fur, glowing amber eyes, and silver-tipped ears. Muscular build, size of a small horse. Moves with predatory grace.",
      "appearances": [
        {
          "chapter": 2,
          "scene": 1,
          "imageFile": "chapter_2_discovery_scene_1.png",
          "contextualDescription": "Emerging from shadows between trees, eyes glowing",
          "visualNotes": "Backlit silhouette, emphasis on glowing eyes"
        },
        {
          "chapter": 5,
          "scene": 2,
          "imageFile": "chapter_5_alliance_scene_2.png",
          "contextualDescription": "Sitting beside Christopher at campfire, relaxed pose",
          "visualNotes": "Warm firelight on black fur, friendly demeanor"
        }
      ],
      "totalAppearances": 2,
      "lastUpdated": "2025-11-13T14:30:00.000Z"
    }
  },
  "stats": {
    "totalCharacters": 2,
    "totalAppearances": 5,
    "mostFrequent": "Christopher",
    "chaptersWithImages": 5
  }
}
```

### Tracking Character Appearances
```typescript
// src/lib/character-registry.ts

async function recordCharacterAppearance(
  characterName: string,
  chapterNumber: number,
  sceneNumber: number,
  imageFile: string,
  contextualDescription: string,
  visualNotes: string,
  outputDir: string
): Promise<void> {
  const registry = await loadCharacterRegistry(outputDir);

  if (!registry.characters[characterName]) {
    // Get base description from Elements.md
    const baseDescription = await getCharacterDescription(characterName, outputDir);

    registry.characters[characterName] = {
      type: 'character',
      baseDescription,
      appearances: [],
      totalAppearances: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Add new appearance
  registry.characters[characterName].appearances.push({
    chapter: chapterNumber,
    scene: sceneNumber,
    imageFile,
    contextualDescription,
    visualNotes,
  });

  registry.characters[characterName].totalAppearances++;
  registry.characters[characterName].lastUpdated = new Date().toISOString();

  // Update stats
  registry.stats.totalAppearances++;
  updateStats(registry);

  await saveCharacterRegistry(registry, outputDir);
}
```

### Character Consistency Prompts
```typescript
async function getCharacterConsistencyPrompt(
  characterName: string,
  outputDir: string
): Promise<string> {
  const registry = await loadCharacterRegistry(outputDir);
  const character = registry.characters[characterName];

  if (!character || character.appearances.length === 0) {
    return character?.baseDescription || '';
  }

  // Include previous appearance references
  const recentAppearances = character.appearances.slice(-3);  // Last 3

  return `
${character.baseDescription}

VISUAL CONSISTENCY NOTES (maintain these exact characteristics):
${recentAppearances.map((app, i) => `
  Reference ${i + 1} (Chapter ${app.chapter}):
  - Context: ${app.contextualDescription}
  - Visual: ${app.visualNotes}
`).join('\n')}

CRITICAL: Character must be visually identical to previous appearances. Same clothing, same facial features, same hair, same build.
  `.trim();
}
```

## Style Guide Workflow

### Complete Workflow
```typescript
// src/lib/illustrate.ts

async function illustrateBook(
  scenes: VisualScene[],
  config: IllustrateConfig,
  outputDir: string
): Promise<void> {
  let styleGuide: StyleGuide | null = null;
  const generatedImages: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Generate image
    const imageUrl = await generateImageWithStyle(scene, characters, styleGuide);
    const imageFile = await downloadImage(imageUrl, outputDir, scene);
    generatedImages.push(imageFile);

    // After bootstrap phase, analyze style
    if (
      config.enableVisualStyleConsistency &&
      i + 1 === config.styleBootstrapImageCount &&
      !styleGuide
    ) {
      console.log(`\n🎨 Analyzing visual style from first ${config.styleBootstrapImageCount} images...`);

      const bootstrapImages = generatedImages.map(file =>
        path.join(outputDir, file)
      );

      styleGuide = await analyzeVisualStyle(bootstrapImages, 'Fantasy');

      await saveStyleGuide(styleGuide, outputDir);

      console.log('✓ Style guide generated and saved');
      console.log(`   Style: ${styleGuide.styleGuide.artStyle.description}`);
      console.log(`   Colors: ${styleGuide.styleGuide.colorPalette.description}`);
    }

    // Track character appearances
    if (config.trackCharacterAppearances) {
      for (const characterName of scene.entities || []) {
        await recordCharacterAppearance(
          characterName,
          scene.chapter,
          scene.sceneNumber,
          imageFile,
          scene.quote,
          `Generated with style guide v${styleGuide?.version || 0}`,
          outputDir
        );
      }
    }
  }
}
```

## User Output

### Style Analysis Output
```
## Illustrate Phase

⏳ Generating images (3/64 scenes, 4.7%)
  ↳ Chapter 3: scene_1.png complete
  ↳ ETA: 45m 20s

🎨 Analyzing visual style from first 3 images...

   Detected style characteristics:
   • Art style: Digital painting with painterly brushwork
   • Color palette: Cool blues and grays with warm red accents
   • Lighting: Soft natural lighting, golden hour atmosphere
   • Composition: Medium-wide framing, rule of thirds
   • Mood: Mysterious yet hopeful with sense of wonder

✓ Style guide generated and saved to style-guide.json

   All future images will maintain this visual style for consistency.

⏳ Generating images (4/64 scenes, 6.3%)
  ↳ Chapter 4: scene_1.png (with style guide)...
```

### Character Registry Output
```
## Character Appearances

Generated character-registry.json with 12 characters across 64 scenes:

Most frequent appearances:
  1. Christopher - 28 scenes
  2. Mal - 18 scenes
  3. Black Doglike Creature - 12 scenes
  4. Isabella - 8 scenes
  5. Simeon - 6 scenes

Visual consistency maintained across all appearances.
```

## Advanced Features

### Style Guide Refinement (Future)
```typescript
// Allow user to refine style guide after generation
async function refineStyleGuide(
  currentGuide: StyleGuide,
  userFeedback: StyleRefinement
): Promise<StyleGuide> {
  // Update specific aspects based on user input
  return {
    ...currentGuide,
    styleGuide: {
      ...currentGuide.styleGuide,
      colorPalette: userFeedback.colorPalette || currentGuide.styleGuide.colorPalette,
      artStyle: userFeedback.artStyle || currentGuide.styleGuide.artStyle,
      // ... other refinements
    },
  };
}
```

### Reference Image Support (Future)
```typescript
// Allow user to provide reference images for style
async function analyzeReferenceImages(
  referenceImages: string[],
  bookGenre: string
): Promise<StyleGuide> {
  // Analyze user-provided reference images instead of generated ones
  // Same GPT-4 Vision analysis, different source images
}
```

### Per-Chapter Style Variations (Future)
```typescript
interface StyleVariation {
  baseStyle: StyleGuide;
  variations: {
    [chapter: number]: Partial<StyleGuide>;
  };
}

// Allow subtle style shifts for mood changes
// Example: Darker colors in tense chapters
```

## Performance Considerations

### Style Analysis Cost
- **Model**: GPT-4 Vision (required for image analysis)
- **Tokens**: ~1,000 tokens per analysis
- **Cost**: ~$0.01 per analysis (one-time per book)
- **Time**: 5-10 seconds

### Trade-offs
**Enabled (default)**:
- ✅ Consistent visual style across all images
- ✅ Professional, cohesive look
- ✅ Better character recognition
- ❌ Slight cost increase (~$0.01)
- ❌ Slight time increase (~10 seconds)

**Disabled**:
- ✅ No additional cost
- ✅ Faster processing
- ❌ Inconsistent visual style
- ❌ Character appearance may vary
- ❌ Less professional appearance

**Recommendation**: Keep enabled for best results

---

**See Also:**
- [AI Integration](./ai-integration.md) - GPT-4 Vision API usage
- [Configuration](./configuration.md) - Style system settings
- [Illustrate Phase](./pipeline-architecture.md#4-illustrate-phase) - Image generation workflow
