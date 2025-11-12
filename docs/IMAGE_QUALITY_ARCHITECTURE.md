# Image Quality Architecture - Visual Consistency System

## Overview

Implement style consistency, character appearance tracking, and mood/lighting coherence across all generated images for a book.

## Current State (v2.3.0)

**Strengths:**
- Visual character descriptions (physical appearance, clothing)
- Character cross-referencing (entities matched in scenes)
- Enhanced quotes with context

**Problems:**
- Each image generated independently → style varies
- Same character looks different across images
- Lighting/mood inconsistent (bright in Ch1, dark in Ch5)
- No composition guidelines → inconsistent framing
- First 3 images set expectations, but later images diverge

**User Impact:**
- Illustrations feel disjointed
- Character recognition difficult
- Book lacks cohesive visual identity

## Proposed Architecture (v2.4.0)

### Phase 1: Style Extraction (Bootstrap Phase)

**Trigger:** After first 3 images generated

**Process:**
1. Analyze first 3 images for common patterns:
   - Art style (realistic, stylized, watercolor, digital art, etc.)
   - Color palette (dominant colors, saturation levels)
   - Lighting (natural, dramatic, soft, etc.)
   - Mood/atmosphere (whimsical, dark, adventurous, etc.)
   - Composition patterns (close-up, wide shot, rule of thirds)

2. Generate "Visual Style Guide" JSON:
```json
{
  "artStyle": "Digital illustration with soft brush strokes",
  "colorPalette": ["#3A5F7D", "#C9A961", "#8B6F47", "#E8D5B7"],
  "lighting": "Natural daylight with warm undertones",
  "mood": "Whimsical and adventurous",
  "composition": "Medium shots with characters centered, rule of thirds",
  "consistency_score": 0.87
}
```

**Implementation:**
```typescript
// src/lib/visual-style/style-analyzer.ts
export async function analyzeStyleFromImages(
  imagePaths: string[]
): Promise<VisualStyleGuide> {
  // Use AI to analyze first 3 images
  const prompt = `Analyze these 3 book illustrations and extract:
  1. Art style (realistic, stylized, digital, watercolor, etc.)
  2. Dominant color palette (5-6 hex codes)
  3. Lighting characteristics
  4. Overall mood/atmosphere
  5. Common composition patterns

  Return as structured JSON.`;

  // Multi-modal AI call with images
  const analysis = await analyzeWithVision(imagePaths, prompt);

  return parseStyleGuide(analysis);
}
```

### Phase 2: Character Appearance Registry

**Goal:** Track how each character has been depicted

**Data Structure:**
```typescript
interface CharacterAppearance {
  name: string;
  firstAppearance: {
    chapterNumber: number;
    imagePath: string;
    description: string; // From Elements.md
  };
  visualFeatures: {
    hairColor: string;
    eyeColor: string;
    clothing: string[];
    distinguishingFeatures: string[];
  };
  appearances: Array<{
    chapterNumber: number;
    imagePath: string;
    consistency_score: number;
  }>;
}
```

**Process:**
1. When character appears in first image:
   - Extract visual description from Elements.md
   - Store image path as reference
   - Parse key visual features (hair, eyes, clothing)

2. For subsequent appearances:
   - Load character reference
   - Append to image generation prompt:
     ```
     IMPORTANT: [Character Name] should match this description:
     - Hair: [color/style from first appearance]
     - Eyes: [color from first appearance]
     - Clothing: [style from first appearance]
     - Reference image: [path to first appearance]
     ```

**Implementation:**
```typescript
// src/lib/visual-style/character-registry.ts
export class CharacterRegistry {
  private characters: Map<string, CharacterAppearance> = new Map();

  async registerFirstAppearance(
    characterName: string,
    chapterNumber: number,
    imagePath: string,
    description: string
  ): Promise<void> {
    const features = await extractVisualFeatures(imagePath, description);

    this.characters.set(characterName, {
      name: characterName,
      firstAppearance: { chapterNumber, imagePath, description },
      visualFeatures: features,
      appearances: []
    });
  }

  getCharacterReference(characterName: string): string | null {
    const char = this.characters.get(characterName);
    if (!char) return null;

    return `${char.name} appearance reference:
- Hair: ${char.visualFeatures.hairColor}
- Eyes: ${char.visualFeatures.eyeColor}
- Clothing: ${char.visualFeatures.clothing.join(', ')}
- Distinguishing features: ${char.visualFeatures.distinguishingFeatures.join(', ')}

MAINTAIN CONSISTENCY with previous appearances.`;
  }
}
```

### Phase 3: Enhanced Image Prompts

**Strategy:** Enrich every image prompt with:
1. Visual style guide tokens
2. Character appearance references
3. Mood/lighting consistency markers

**Before (v2.3.0):**
```
Create an illustration for this scene:
"Mal Arvorian stood at the edge of the Sunken City, her arms outstretched..."

CHARACTER DETAILS:
- Mal Arvorian (character): A young girl with outstretched arms, flying joyfully...
```

**After (v2.4.0):**
```
Create an illustration for this scene:
"Mal Arvorian stood at the edge of the Sunken City, her arms outstretched..."

VISUAL STYLE GUIDE (maintain consistency):
- Art style: Digital illustration with soft brush strokes
- Color palette: Use #3A5F7D, #C9A961, #8B6F47, #E8D5B7
- Lighting: Natural daylight with warm undertones
- Mood: Whimsical and adventurous
- Composition: Medium shot, rule of thirds

CHARACTER APPEARANCE (from Chapter 3):
- Mal Arvorian:
  * Hair: Tousled, windblown, brown
  * Eyes: Bright, determined expression
  * Clothing: Thick oversized coat with rolled-up sleeves
  * REFERENCE: See Chapter 3, Scene 1 for consistency

MAINTAIN CONSISTENCY with the established visual style and character appearances.
```

**Implementation:**
```typescript
// src/lib/phases/illustrate-phase-v2.ts
async function generateEnhancedPrompt(
  concept: ImageConcept,
  styleGuide: VisualStyleGuide,
  characterRegistry: CharacterRegistry
): Promise<string> {
  let prompt = `Create an illustration for this scene:\n${concept.quote}\n\n`;

  // Add visual style guide
  prompt += `VISUAL STYLE GUIDE (maintain consistency):\n`;
  prompt += `- Art style: ${styleGuide.artStyle}\n`;
  prompt += `- Color palette: ${styleGuide.colorPalette.join(', ')}\n`;
  prompt += `- Lighting: ${styleGuide.lighting}\n`;
  prompt += `- Mood: ${styleGuide.mood}\n`;
  prompt += `- Composition: ${styleGuide.composition}\n\n`;

  // Add character references
  const charactersInScene = extractCharacterNames(concept.description);
  if (charactersInScene.length > 0) {
    prompt += `CHARACTER APPEARANCES (maintain consistency):\n`;
    for (const charName of charactersInScene) {
      const reference = characterRegistry.getCharacterReference(charName);
      if (reference) {
        prompt += `${reference}\n\n`;
      }
    }
  }

  prompt += `SCENE DESCRIPTION:\n${concept.description}\n\n`;
  prompt += `IMPORTANT: Maintain visual consistency with the established style and character appearances.`;

  return prompt;
}
```

### Phase 4: Consistency Validation

**After each image generation:**
1. Validate against style guide (if available)
2. Check character appearance consistency (if character registry has entries)
3. Log consistency scores
4. Alert user if significant drift detected

**Validation Metrics:**
```typescript
interface ConsistencyReport {
  chapterNumber: number;
  sceneNumber: number;
  imagePath: string;
  styleConsistency: number; // 0-1, compared to style guide
  characterConsistency: {
    [characterName: string]: number; // 0-1, compared to first appearance
  };
  suggestions: string[]; // If consistency < 0.7
}
```

**Implementation:**
```typescript
// src/lib/visual-style/consistency-validator.ts
export async function validateImageConsistency(
  imagePath: string,
  styleGuide: VisualStyleGuide,
  charactersInScene: string[],
  characterRegistry: CharacterRegistry
): Promise<ConsistencyReport> {
  // Use AI vision to analyze generated image
  const analysis = await analyzeImageStyle(imagePath);

  // Compare to style guide
  const styleScore = calculateStyleSimilarity(analysis, styleGuide);

  // Compare character appearances
  const charScores: { [name: string]: number } = {};
  for (const charName of charactersInScene) {
    const reference = characterRegistry.getFirstAppearance(charName);
    if (reference) {
      const score = await compareCharacterAppearance(
        imagePath,
        reference.imagePath,
        charName
      );
      charScores[charName] = score;
    }
  }

  // Generate suggestions if consistency low
  const suggestions: string[] = [];
  if (styleScore < 0.7) {
    suggestions.push(`Style drift detected (${(styleScore * 100).toFixed(0)}% match). Consider regenerating with stronger style emphasis.`);
  }

  for (const [charName, score] of Object.entries(charScores)) {
    if (score < 0.7) {
      suggestions.push(`${charName} appearance inconsistent (${(score * 100).toFixed(0)}% match). Review character reference.`);
    }
  }

  return {
    chapterNumber,
    sceneNumber,
    imagePath,
    styleConsistency: styleScore,
    characterConsistency: charScores,
    suggestions
  };
}
```

## Configuration

```typescript
// src/types/config.ts
export interface ImaginizeConfig {
  // ... existing fields

  /**
   * Enable visual consistency system
   * @default true (v2.4.0+)
   */
  enableStyleConsistency?: boolean;

  /**
   * Number of initial images to analyze for style guide
   * @default 3
   */
  styleBootstrapCount?: number;

  /**
   * Minimum consistency score before warning (0-1)
   * @default 0.7
   */
  consistencyThreshold?: number;

  /**
   * Enable character appearance tracking
   * @default true
   */
  trackCharacterAppearances?: boolean;
}
```

## File Structure

```
src/lib/visual-style/
├── style-analyzer.ts        # Extract style from first N images
├── style-guide.ts           # VisualStyleGuide type and utilities
├── character-registry.ts    # Track character appearances
├── consistency-validator.ts # Validate generated images
└── prompt-enhancer.ts       # Enrich prompts with style/character info

dist/data/
├── style-guide.json         # Generated for this book
└── character-registry.json  # Character appearance tracking
```

## Implementation Plan

### Day 1: Core Infrastructure

**Morning:**
1. Create visual-style module structure
2. Implement VisualStyleGuide type
3. Implement CharacterRegistry class
4. Add configuration options

**Afternoon:**
4. Implement style-analyzer.ts (basic version)
5. Create prompt-enhancer.ts
6. Update illustrate-phase-v2.ts to use new system

### Day 2: Enhancement and Validation

**Morning:**
1. Implement consistency-validator.ts
2. Add consistency reporting to progress.md
3. Test with ImpossibleCreatures.epub (first 5 chapters)

**Afternoon:**
4. Refine style extraction prompts
5. Add error handling and fallbacks
6. Document in README and WORKING.md

## Testing Strategy

### Test 1: Style Extraction

```bash
# Generate first 3 images normally
npx imaginize --images --chapters 1-3

# Verify style-guide.json created
cat imaginize_BOOKNAME/data/style-guide.json

Expected:
{
  "artStyle": "...",
  "colorPalette": [...],
  "lighting": "...",
  "mood": "...",
  "composition": "..."
}
```

### Test 2: Character Consistency

```bash
# Generate images for chapters with recurring characters
npx imaginize --images --chapters 1,5,10

# Check character-registry.json
cat imaginize_BOOKNAME/data/character-registry.json

# Verify same character looks similar across images
```

### Test 3: Full Book Consistency

Run on entire book, measure:
- Style consistency score (target: >0.75 average)
- Character consistency score (target: >0.80 average)
- User-perceived quality improvement

## Success Criteria

- ✅ Style guide extracted from first 3 images
- ✅ Character appearances tracked and referenced
- ✅ Enhanced prompts include style and character info
- ✅ Consistency scores logged for each image
- ✅ Visually cohesive set of illustrations
- ✅ User can review and adjust style guide
- ✅ Processing time increase ≤10%

## Rollout Plan

### Version 2.4.0

- Add visual consistency system with `enableStyleConsistency: true` default
- Include in concurrent mode only (requires sequential image generation for bootstrap)
- Document in README with before/after examples

### Version 2.5.0

- Add user interface to review and adjust style guide
- Allow manual character appearance corrections
- Export style guide for reuse across multiple books

## Benefits

**For Users:**
- Professional, cohesive illustration set
- Characters recognizable across the book
- Consistent visual identity
- Better suited for actual book publication

**For Quality:**
- Measurable consistency scores
- Early detection of style drift
- Actionable suggestions for improvement

**For Development:**
- Builds on v2.3.0 visual character descriptions
- Leverages existing Elements.md and character cross-referencing
- No new dependencies or platform constraints

## Timeline

- **Day 1:** Core implementation (style guide, character registry, enhanced prompts)
- **Day 2:** Validation, testing, documentation

**Total:** 1-2 days as estimated
