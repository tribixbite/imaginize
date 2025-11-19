/**
 * Template Loader - Custom prompt templates with variable replacement
 *
 * Supports:
 * - Simple variables: {{varName}}
 * - Conditional blocks: {{#if varName}}...{{/if}}
 * - Conditional negation: {{#unless varName}}...{{/unless}}
 * - Built-in presets: fantasy, scifi, mystery, romance
 * - Template caching for performance
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Template variables available for replacement
 */
export interface TemplateVariables {
  // Book metadata
  bookTitle?: string;
  author?: string;
  publisher?: string;
  language?: string;
  totalPages?: number;
  genre?: string;

  // Chapter data
  chapterContent?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  pageRange?: string;
  wordCount?: number;
  tokenCount?: number;

  // Elements (for Illustrate phase)
  characters?: string;
  places?: string;
  items?: string;
  creatures?: string;

  // Configuration
  imageCount?: number;
  pagesPerImage?: number;
  imageSize?: string;
  imageQuality?: string;
  style?: string;

  // Custom variables
  [key: string]: string | number | undefined;
}

/**
 * Template loader with caching and preset support
 */
export class TemplateLoader {
  private templateCache: Map<string, string> = new Map();

  /**
   * Load template from file or use default
   */
  async loadTemplate(
    templatePath: string | undefined,
    defaultTemplate: string
  ): Promise<string> {
    // Use default if no custom template specified
    if (!templatePath) {
      return defaultTemplate;
    }

    // Check cache
    if (this.templateCache.has(templatePath)) {
      return this.templateCache.get(templatePath)!;
    }

    // Load from file
    if (existsSync(templatePath)) {
      const content = await readFile(templatePath, 'utf-8');
      this.templateCache.set(templatePath, content);
      return content;
    }

    // Fallback to default
    console.warn(`Template file not found: ${templatePath}, using default`);
    return defaultTemplate;
  }

  /**
   * Replace variables in template
   */
  renderTemplate(template: string, variables: TemplateVariables): string {
    let rendered = template;

    // Handle conditionals first (before variable replacement)
    rendered = this.processConditionals(rendered, variables);

    // Replace simple variables {{varName}}
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(regex, String(value));
      }
    }

    // Clean up any remaining unprocessed variables
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');

    return rendered;
  }

  /**
   * Process conditional blocks
   */
  private processConditionals(template: string, variables: TemplateVariables): string {
    let result = template;

    // {{#if varName}}content{{/if}}
    const ifRegex = /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(ifRegex, (match, varName, content) => {
      const value = variables[varName.trim()];
      return value ? content : '';
    });

    // {{#unless varName}}content{{/unless}}
    const unlessRegex = /\{\{#unless ([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;
    result = result.replace(unlessRegex, (match, varName, content) => {
      const value = variables[varName.trim()];
      return !value ? content : '';
    });

    return result;
  }

  /**
   * Load preset templates
   */
  loadPreset(preset: string): {
    analyze: string;
    extract: string;
    illustrate: string;
  } {
    const presets: Record<
      string,
      { analyze: string; extract: string; illustrate: string }
    > = {
      fantasy: {
        analyze: FANTASY_ANALYZE_TEMPLATE,
        extract: FANTASY_EXTRACT_TEMPLATE,
        illustrate: FANTASY_ILLUSTRATE_TEMPLATE,
      },
      scifi: {
        analyze: SCIFI_ANALYZE_TEMPLATE,
        extract: SCIFI_EXTRACT_TEMPLATE,
        illustrate: SCIFI_ILLUSTRATE_TEMPLATE,
      },
      mystery: {
        analyze: MYSTERY_ANALYZE_TEMPLATE,
        extract: MYSTERY_EXTRACT_TEMPLATE,
        illustrate: MYSTERY_ILLUSTRATE_TEMPLATE,
      },
      romance: {
        analyze: ROMANCE_ANALYZE_TEMPLATE,
        extract: ROMANCE_EXTRACT_TEMPLATE,
        illustrate: ROMANCE_ILLUSTRATE_TEMPLATE,
      },
    };

    if (!presets[preset]) {
      throw new Error(
        `Unknown preset: ${preset}. Available: ${Object.keys(presets).join(', ')}`
      );
    }

    return presets[preset];
  }

  /**
   * Clear template cache (useful for hot-reloading during development)
   */
  clearCache(): void {
    this.templateCache.clear();
  }
}

/**
 * Default Analyze Template (current implementation)
 */
export const DEFAULT_ANALYZE_TEMPLATE = `You are analyzing a book chapter to identify visually rich scenes for illustration.

**Task:** Identify the {{imageCount}} most visually compelling and narratively important scenes in this chapter.

For each scene, provide:
1. A vivid visual description (2-3 sentences) suitable for image generation
2. A substantial quote from the text (MINIMUM 3-8 sentences, 50-150 words) that captures the scene's atmosphere and key details
3. Your reasoning for why this scene is visually and narratively significant

**IMPORTANT:** The quote must be substantial enough to serve as a standalone reference for illustration. Include enough context to understand character actions, setting details, and mood.

**Chapter:** {{chapterTitle}}

**Chapter Content:**
{{chapterContent}}

{{#if characters}}
**Entity Reference (for visual consistency):**
{{characters}}
{{/if}}

Return your response as a JSON array with this structure:
[
  {
    "description": "Detailed visual description of the scene",
    "quote": "Substantial quote from the text (3-8 sentences minimum)",
    "reasoning": "Why this scene is visually and narratively important"
  }
]`;

/**
 * Default Extract Template (current implementation)
 */
export const DEFAULT_EXTRACT_TEMPLATE = `Analyze this book text and extract ALL significant story elements comprehensively.

EXTRACTION TARGETS:
- Main characters: 5-10 expected
- Secondary characters (named, with dialogue/actions): 3-8 expected
- Creature types (monsters, magical beings, animals): 5-15 expected
- Key locations (cities, buildings, geographical features): 5-10 expected
- Important items/objects (vehicles, weapons, artifacts): 5-10 expected

REQUIREMENTS:
1. Be comprehensive - extract ALL named entities that appear multiple times
2. Include secondary characters if they have dialogue or significant actions
3. List each distinct creature type (not individual creatures)
4. Include all named locations, even if mentioned briefly
5. Catalog significant items/vehicles separately from ordinary objects

For each element provide:
1. Type: character/creature/place/item/object
2. Name: The actual name from the text
3. Quotes: 2-3 direct quotes describing this element (verbatim from text)
4. Description: VISUAL description (2-3 sentences) including colors, shapes, materials, textures, and distinctive visual characteristics. This will be used for image generation, so physical appearance details are critical.

VISUAL DESCRIPTION EXAMPLES:
- Character: "Tall woman with silver-streaked black hair, wearing a dark blue coat with brass buttons. Her eyes are sharp gray and she carries a worn leather satchel."
- Vehicle: "Black electric car with orange running lights across the front grille. Large sticky tires and a sleek, low-slung body shaped like a lozenge."
- Place: "Gothic cathedral with flying buttresses and rose windows. Gargoyles perch at the corners and vines climb the weathered gray stone walls."

Text excerpt:
{{chapterContent}}

Return as JSON with an "elements" array.
{
  "elements": [
    {
      "type": "character",
      "name": "Character Name",
      "quotes": [
        {"text": "direct quote describing them", "page": "estimated page"}
      ],
      "description": "VISUAL description with colors, shapes, materials, textures"
    }
  ]
}`;

/**
 * Default Illustrate Template (style enrichment)
 */
export const DEFAULT_ILLUSTRATE_TEMPLATE = `{{description}}

{{#if style}}
Style: {{style}}
{{/if}}

{{#if characters}}
Characters: {{characters}}
{{/if}}`;

// ============================================================================
// FANTASY PRESET TEMPLATES
// ============================================================================

const FANTASY_ANALYZE_TEMPLATE = `You are an expert literary analyst specializing in fantasy fiction, with deep knowledge of epic world-building, magic systems, and heroic narratives.

**Task:** Identify the {{imageCount}} most visually compelling and narratively important scenes in this fantasy chapter.

**FANTASY FOCUS:**
- Magical elements and spell-casting
- Epic landscapes and otherworldly locations
- Character appearances (robes, armor, weapons, magical artifacts)
- Creatures and monsters
- World-building details (architecture, cultures, technology level)

**Book:** "{{bookTitle}}"{{#if author}} by {{author}}{{/if}}
**Genre:** {{genre}}
**Chapter:** {{chapterTitle}} (Chapter {{chapterNumber}})

**Chapter Content:**
{{chapterContent}}

{{#if characters}}
**Character Reference (for visual consistency):**
{{characters}}
{{/if}}

{{#if style}}
**Visual Style Guide:**
{{style}}
{{/if}}

For each scene, provide:
1. **Visual Description**: Emphasize magical elements, fantasy setting details, character equipment and appearances (2-3 sentences)
2. **Quote**: Substantial excerpt that captures the wonder, danger, or magic of the scene (3-8 sentences, 50-150 words)
3. **Reasoning**: Why this scene showcases the fantasy world and advances the narrative

Return as JSON array:
[
  {
    "description": "Detailed visual description emphasizing fantasy elements",
    "quote": "Substantial quote from the text",
    "reasoning": "Why this scene is visually and narratively important"
  }
]`;

const FANTASY_EXTRACT_TEMPLATE = `Analyze this fantasy book text and extract ALL significant magical and world-building elements.

**FANTASY EXTRACTION TARGETS:**
- Main characters with their magical abilities, equipment, and physical descriptions
- Secondary characters (allies, mentors, antagonists)
- Magical creatures and monsters (dragons, elves, demons, etc.)
- Locations (castles, magical realms, dungeons, cities, landscapes)
- Magical items (swords, amulets, potions, artifacts, spell books)
- Magic system components (spells, abilities, power sources)

**FANTASY-SPECIFIC REQUIREMENTS:**
1. Include detailed physical descriptions (clothing, armor, weapons)
2. Note magical properties and abilities
3. Describe architectural and cultural details of locations
4. Catalog unique creatures and their characteristics
5. List significant magical items separately from mundane objects

Text excerpt:
{{chapterContent}}

Return as JSON with comprehensive element descriptions:
{
  "elements": [
    {
      "type": "character|creature|place|item",
      "name": "Element Name",
      "quotes": [{"text": "quote", "page": "page"}],
      "description": "Physical appearance, magical abilities, equipment, role in story"
    }
  ]
}`;

const FANTASY_ILLUSTRATE_TEMPLATE = `{{description}}

**Fantasy Art Style:**
- Epic, heroic composition
- Rich details in costumes, armor, and magical effects
- Dramatic lighting and atmospheric effects
- Intricate world-building elements

{{#if style}}
{{style}}
{{/if}}

{{#if characters}}
{{characters}}
{{/if}}`;

// ============================================================================
// SCI-FI PRESET TEMPLATES
// ============================================================================

const SCIFI_ANALYZE_TEMPLATE = `You are an expert literary analyst specializing in science fiction, with expertise in futuristic technology, space opera, and speculative concepts.

**Task:** Identify the {{imageCount}} most visually compelling and narratively important scenes in this sci-fi chapter.

**SCI-FI FOCUS:**
- Futuristic technology and spacecraft
- Alien worlds and space environments
- Advanced architecture and cities
- Scientific concepts made visual
- Technology interfaces and displays
- Alien species and robots

**Book:** "{{bookTitle}}"{{#if author}} by {{author}}{{/if}}
**Genre:** {{genre}}
**Chapter:** {{chapterTitle}} (Chapter {{chapterNumber}})

**Chapter Content:**
{{chapterContent}}

{{#if characters}}
**Character Reference (for visual consistency):**
{{characters}}
{{/if}}

{{#if style}}
**Visual Style Guide:**
{{style}}
{{/if}}

For each scene, provide:
1. **Visual Description**: Emphasize technological elements, futuristic settings, and scientific accuracy (2-3 sentences)
2. **Quote**: Substantial excerpt capturing the innovation, wonder, or tension of the sci-fi world (3-8 sentences, 50-150 words)
3. **Reasoning**: Why this scene showcases the sci-fi concepts and advances the narrative

Return as JSON array:
[
  {
    "description": "Detailed visual description emphasizing sci-fi elements",
    "quote": "Substantial quote from the text",
    "reasoning": "Why this scene is visually and narratively important"
  }
]`;

const SCIFI_EXTRACT_TEMPLATE = `Analyze this science fiction book text and extract ALL significant technological and speculative elements.

**SCI-FI EXTRACTION TARGETS:**
- Characters (species, augmentations, technological gear)
- Alien species and robots (physical characteristics, capabilities)
- Technology (ships, weapons, devices, AI systems)
- Locations (space stations, alien planets, futuristic cities)
- Scientific concepts (made concrete and visual)

**SCI-FI-SPECIFIC REQUIREMENTS:**
1. Include technical specifications where mentioned
2. Note alien or robotic characteristics
3. Describe futuristic architecture and technology
4. Catalog spacecraft and vehicles separately
5. Include AI and computer systems as characters/items

Text excerpt:
{{chapterContent}}

Return as JSON with technical descriptions:
{
  "elements": [
    {
      "type": "character|creature|place|item",
      "name": "Element Name",
      "quotes": [{"text": "quote", "page": "page"}],
      "description": "Physical/technical specs, capabilities, function in story"
    }
  ]
}`;

const SCIFI_ILLUSTRATE_TEMPLATE = `{{description}}

**Sci-Fi Art Style:**
- Clean, technical aesthetic with futuristic design
- Accurate depiction of technology and spacecraft
- Atmospheric space environments and alien worlds
- Advanced lighting effects and holographic displays

{{#if style}}
{{style}}
{{/if}}

{{#if characters}}
{{characters}}
{{/if}}`;

// ============================================================================
// MYSTERY PRESET TEMPLATES
// ============================================================================

const MYSTERY_ANALYZE_TEMPLATE = `You are an expert literary analyst specializing in mystery fiction, with expertise in atmospheric tension, clues, and character psychology.

**Task:** Identify the {{imageCount}} most visually compelling and narratively important scenes in this mystery chapter.

**MYSTERY FOCUS:**
- Atmospheric and moody settings
- Character expressions and body language
- Environmental clues and details
- Tense confrontations and revelations
- Shadowy, suspenseful lighting
- Investigative moments

**Book:** "{{bookTitle}}"{{#if author}} by {{author}}{{/if}}
**Genre:** {{genre}}
**Chapter:** {{chapterTitle}} (Chapter {{chapterNumber}})

**Chapter Content:**
{{chapterContent}}

{{#if characters}}
**Character Reference (for visual consistency):**
{{characters}}
{{/if}}

{{#if style}}
**Visual Style Guide:**
{{style}}
{{/if}}

For each scene, provide:
1. **Visual Description**: Emphasize atmosphere, character psychology, and visual clues (2-3 sentences)
2. **Quote**: Substantial excerpt capturing the suspense, intrigue, or revelation (3-8 sentences, 50-150 words)
3. **Reasoning**: Why this scene builds tension or reveals important information

Return as JSON array:
[
  {
    "description": "Detailed visual description emphasizing mystery atmosphere",
    "quote": "Substantial quote from the text",
    "reasoning": "Why this scene is visually and narratively important"
  }
]`;

const MYSTERY_EXTRACT_TEMPLATE = `Analyze this mystery book text and extract ALL significant characters, locations, and clue elements.

**MYSTERY EXTRACTION TARGETS:**
- Main characters (detective, suspects, victims) with physical descriptions
- Secondary characters (witnesses, red herrings)
- Locations (crime scenes, investigation sites, atmospheric settings)
- Important objects (evidence, clues, weapons, personal items)

**MYSTERY-SPECIFIC REQUIREMENTS:**
1. Include detailed character observations (mannerisms, appearance, suspicious behavior)
2. Note atmospheric qualities of locations
3. Catalog physical evidence and clues
4. Include character relationships and motivations where hinted

Text excerpt:
{{chapterContent}}

Return as JSON with investigative detail:
{
  "elements": [
    {
      "type": "character|place|item",
      "name": "Element Name",
      "quotes": [{"text": "quote", "page": "page"}],
      "description": "Physical description, suspicious details, role in mystery"
    }
  ]
}`;

const MYSTERY_ILLUSTRATE_TEMPLATE = `{{description}}

**Mystery Art Style:**
- Atmospheric lighting with shadows and contrast
- Focus on character expressions and body language
- Environmental details that serve as clues
- Moody, suspenseful composition

{{#if style}}
{{style}}
{{/if}}

{{#if characters}}
{{characters}}
{{/if}}`;

// ============================================================================
// ROMANCE PRESET TEMPLATES
// ============================================================================

const ROMANCE_ANALYZE_TEMPLATE = `You are an expert literary analyst specializing in romance fiction, with expertise in emotional moments, character chemistry, and intimate settings.

**Task:** Identify the {{imageCount}} most visually compelling and emotionally important scenes in this romance chapter.

**ROMANCE FOCUS:**
- Emotional moments and character interactions
- Romantic settings (candlelight, sunsets, intimate spaces)
- Facial expressions and body language
- Gestures of affection and connection
- Atmospheric lighting and mood
- Character appearance and attraction

**Book:** "{{bookTitle}}"{{#if author}} by {{author}}{{/if}}
**Genre:** {{genre}}
**Chapter:** {{chapterTitle}} (Chapter {{chapterNumber}})

**Chapter Content:**
{{chapterContent}}

{{#if characters}}
**Character Reference (for visual consistency):**
{{characters}}
{{/if}}

{{#if style}}
**Visual Style Guide:**
{{style}}
{{/if}}

For each scene, provide:
1. **Visual Description**: Emphasize emotional connection, romantic setting, and character chemistry (2-3 sentences)
2. **Quote**: Substantial excerpt capturing the emotion, intimacy, or romantic tension (3-8 sentences, 50-150 words)
3. **Reasoning**: Why this scene is emotionally powerful and advances the relationship

Return as JSON array:
[
  {
    "description": "Detailed visual description emphasizing romance and emotion",
    "quote": "Substantial quote from the text",
    "reasoning": "Why this scene is visually and emotionally important"
  }
]`;

const ROMANCE_EXTRACT_TEMPLATE = `Analyze this romance book text and extract ALL significant characters, settings, and romantic elements.

**ROMANCE EXTRACTION TARGETS:**
- Main characters (romantic leads) with detailed physical descriptions and personalities
- Secondary characters (friends, rivals, family members)
- Romantic settings (restaurants, beaches, homes, gardens)
- Significant objects (gifts, mementos, symbolic items)

**ROMANCE-SPECIFIC REQUIREMENTS:**
1. Include detailed physical descriptions emphasizing attractiveness
2. Note personality traits and emotional characteristics
3. Describe romantic atmospheres of locations
4. Catalog meaningful objects and gifts
5. Include relationship dynamics where evident

Text excerpt:
{{chapterContent}}

Return as JSON with emotional detail:
{
  "elements": [
    {
      "type": "character|place|item",
      "name": "Element Name",
      "quotes": [{"text": "quote", "page": "page"}],
      "description": "Physical description, personality, emotional qualities, role in romance"
    }
  ]
}`;

const ROMANCE_ILLUSTRATE_TEMPLATE = `{{description}}

**Romance Art Style:**
- Soft, warm lighting with romantic atmosphere
- Focus on emotional connection and facial expressions
- Beautiful settings that enhance intimacy
- Intimate composition emphasizing character chemistry

{{#if style}}
{{style}}
{{/if}}

{{#if characters}}
{{characters}}
{{/if}}`;
