# Custom Prompt Templates Specification

## Overview

imaginize supports custom prompt templates for each processing phase, giving users fine-grained control over AI behavior. Users can customize prompts to match their specific needs, add domain expertise, or optimize for particular book genres.

## Architecture

```
Template System:
─────────────────────────────────────────────────────────────
Configuration:
  ├─ .imaginize.config (template paths)
  └─ .imaginize/templates/ (template files)
      ├─ analyze.txt
      ├─ extract.txt
      └─ illustrate.txt

Processing:
  ├─ Load templates (custom or defaults)
  ├─ Replace variables ({{chapterContent}}, {{bookTitle}}, etc.)
  ├─ Execute AI request with templated prompt
  └─ Process response

Variables:
  ├─ Book metadata: {{bookTitle}}, {{author}}, {{genre}}
  ├─ Chapter data: {{chapterContent}}, {{chapterNumber}}, {{chapterTitle}}
  ├─ Elements: {{characters}}, {{places}}, {{items}}
  └─ Config: {{imageCount}}, {{pagesPerImage}}, {{style}}
```

## Configuration

### Template Configuration in `.imaginize.config`

```yaml
# Enable custom templates
customTemplates:
  enabled: true
  templatesDir: "./.imaginize/templates"  # Directory containing template files

  # Per-phase template files
  analyzeTemplate: "analyze.txt"           # Path relative to templatesDir
  extractTemplate: "extract.txt"
  illustrateTemplate: "illustrate.txt"

  # Or specify full paths
  # analyzeTemplate: "/absolute/path/to/analyze.txt"

  # Optional: Template presets
  preset: "fantasy"  # Use built-in preset (fantasy, scifi, mystery, romance)
```

### Template Files

Templates are plain text files with variable placeholders:

**`.imaginize/templates/analyze.txt`**:
```
You are an expert literary analyst specializing in {{genre}} fiction.

Analyze this chapter from "{{bookTitle}}" by {{author}} and identify {{imageCount}}
key visual scenes that would make compelling illustrations.

CHAPTER: {{chapterTitle}} (Chapter {{chapterNumber}})
CONTENT:
{{chapterContent}}

For each scene, provide:
1. **Page Range**: Approximate page numbers
2. **Quote**: 2-3 sentence excerpt that captures the scene
3. **Visual Description**: Detailed description suitable for image generation
4. **Mood**: Emotional atmosphere
5. **Lighting**: Time of day and lighting conditions

Focus on visually rich scenes with strong imagery, action, or emotional impact.
Avoid abstract concepts or internal monologue.

Return as JSON array with this structure:
[
  {
    "pageRange": "10-12",
    "quote": "...",
    "description": "...",
    "mood": "tense",
    "lighting": "dim candlelight"
  }
]
```

## Available Variables

### Book Metadata Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{bookTitle}}` | Book title from metadata | "Harry Potter and the Philosopher's Stone" |
| `{{author}}` | Author name | "J.K. Rowling" |
| `{{publisher}}` | Publisher name | "Bloomsbury" |
| `{{language}}` | Book language | "English" |
| `{{totalPages}}` | Total page count | "223" |
| `{{genre}}` | Book genre (user-provided) | "Fantasy" |

### Chapter Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{chapterContent}}` | Full chapter text | "It was a dark and stormy..." |
| `{{chapterNumber}}` | Chapter number | "1" |
| `{{chapterTitle}}` | Chapter title | "The Boy Who Lived" |
| `{{pageRange}}` | Chapter page range | "1-15" |
| `{{wordCount}}` | Word count | "3500" |
| `{{tokenCount}}` | Estimated token count | "4200" |

### Elements Variables (for Illustrate phase)

| Variable | Description | Example |
|----------|-------------|---------|
| `{{characters}}` | Character descriptions | "Harry: young wizard..." |
| `{{places}}` | Place descriptions | "Hogwarts: magical castle..." |
| `{{items}}` | Item descriptions | "Wand: 11-inch holly..." |
| `{{creatures}}` | Creature descriptions | "Owl: snowy white..." |

### Configuration Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{imageCount}}` | Target images per chapter | "3" |
| `{{pagesPerImage}}` | Pages per image | "10" |
| `{{imageSize}}` | Image dimensions | "1024x1024" |
| `{{imageQuality}}` | Image quality setting | "standard" |
| `{{style}}` | Visual style guide | "watercolor, soft edges..." |

### Conditional Variables

Use conditional blocks for optional content:

```
{{#if characters}}
CHARACTERS:
{{characters}}
{{/if}}

{{#unless style}}
Note: No style guide specified, use default artistic interpretation.
{{/unless}}
```

## Template Presets

Built-in template presets optimized for specific genres:

### Fantasy Preset

```yaml
customTemplates:
  preset: "fantasy"
```

**Characteristics**:
- Emphasis on magical elements and world-building
- Detailed character appearances (clothing, weapons)
- Epic landscape descriptions
- Mood: Wonder, adventure, danger

### Sci-Fi Preset

```yaml
customTemplates:
  preset: "scifi"
```

**Characteristics**:
- Technical accuracy for futuristic technology
- Spaceship and vehicle details
- Alien world descriptions
- Mood: Innovation, mystery, tension

### Mystery Preset

```yaml
customTemplates:
  preset: "mystery"
```

**Characteristics**:
- Focus on atmospheric scenes
- Character expressions and body language
- Environmental clues and details
- Mood: Suspense, intrigue, foreboding

### Romance Preset

```yaml
customTemplates:
  preset: "romance"
```

**Characteristics**:
- Emotional moments and character interactions
- Setting atmosphere (candlelight, sunsets)
- Facial expressions and gestures
- Mood: Intimacy, passion, tenderness

## Implementation

### 1. Template Loader Module

**`src/lib/templates/template-loader.ts`**:

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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

  // Elements
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

  // Custom
  [key: string]: string | number | undefined;
}

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
  renderTemplate(
    template: string,
    variables: TemplateVariables
  ): string {
    let rendered = template;

    // Replace simple variables {{varName}}
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(regex, String(value));
      }
    }

    // Handle conditionals {{#if varName}}...{{/if}}
    rendered = this.processConditionals(rendered, variables);

    // Clean up any remaining unprocessed variables
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');

    return rendered;
  }

  /**
   * Process conditional blocks
   */
  private processConditionals(
    template: string,
    variables: TemplateVariables
  ): string {
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
    // Built-in presets defined here
    const presets: Record<string, any> = {
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
      // ... more presets
    };

    if (!presets[preset]) {
      throw new Error(`Unknown preset: ${preset}`);
    }

    return presets[preset];
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }
}

// Default templates (current prompts)
const DEFAULT_ANALYZE_TEMPLATE = `...`;
const DEFAULT_EXTRACT_TEMPLATE = `...`;
const DEFAULT_ILLUSTRATE_TEMPLATE = `...`;

// Preset templates
const FANTASY_ANALYZE_TEMPLATE = `...`;
// ... more preset templates
```

### 2. Integration with Phases

Modify each phase to use template loader:

**`src/lib/phases/analyze-phase-v2.ts`**:

```typescript
import { TemplateLoader } from '../templates/template-loader.js';

export class AnalyzePhaseV2 extends BasePhase {
  private templateLoader: TemplateLoader;

  constructor(context: PhaseContext) {
    super(context, 'analyze');
    this.templateLoader = new TemplateLoader();
  }

  async analyzeChapter(chapter: ChapterContent): Promise<ImageConcept[]> {
    // Load custom template or use default
    const templatePath = this.context.config.customTemplates?.analyzeTemplate;
    const template = await this.templateLoader.loadTemplate(
      templatePath,
      DEFAULT_ANALYZE_TEMPLATE
    );

    // Prepare variables
    const variables = {
      bookTitle: this.context.metadata.title,
      author: this.context.metadata.author,
      genre: this.context.config.genre || 'fiction',
      chapterContent: chapter.content,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
      pageRange: chapter.pageRange,
      tokenCount: chapter.tokenCount,
      imageCount: Math.ceil(chapter.tokenCount / 1000), // Example calculation
      pagesPerImage: this.context.config.pagesPerImage || 10,
    };

    // Render template with variables
    const prompt = this.templateLoader.renderTemplate(template, variables);

    // Execute AI request with custom prompt
    const response = await this.aiProvider.complete(prompt);

    // Parse response
    return this.parseAnalysisResponse(response);
  }
}
```

### 3. Configuration Types

**`src/types/config.ts`**:

```typescript
export interface CustomTemplates {
  enabled: boolean;
  templatesDir?: string;
  analyzeTemplate?: string;
  extractTemplate?: string;
  illustrateTemplate?: string;
  preset?: 'fantasy' | 'scifi' | 'mystery' | 'romance';
}

export interface IllustrateConfig {
  // ... existing fields

  customTemplates?: CustomTemplates;
  genre?: string; // For template variable {{genre}}
}
```

## CLI Commands

### Initialize Templates

```bash
imaginize templates init [--preset fantasy]

# Creates .imaginize/templates/ directory with template files
# If preset specified, uses preset templates as starting point
```

### List Available Templates

```bash
imaginize templates list

# Output:
# Custom Templates:
# ✓ Analyze: .imaginize/templates/analyze.txt
# ✓ Extract: .imaginize/templates/extract.txt
# ✗ Illustrate: (using default)
#
# Available Presets:
# - fantasy
# - scifi
# - mystery
# - romance
```

### Validate Templates

```bash
imaginize templates validate

# Checks:
# - Template files exist
# - Variables are valid
# - Syntax is correct
# - Required sections present
```

### Export Current Prompts

```bash
imaginize templates export --output ./my-templates/

# Exports current default prompts to files
# Useful as starting point for customization
```

## Usage Examples

### Basic Custom Template

```bash
# 1. Create templates directory
mkdir -p .imaginize/templates

# 2. Create custom analyze template
cat > .imaginize/templates/analyze.txt << 'EOF'
Analyze "{{bookTitle}}" and find {{imageCount}} visual scenes.

Chapter {{chapterNumber}}: {{chapterTitle}}

{{chapterContent}}

Return JSON array of scenes.
EOF

# 3. Configure .imaginize.config
cat > .imaginize.config << 'EOF'
customTemplates:
  enabled: true
  analyzeTemplate: "analyze.txt"
EOF

# 4. Run with custom template
imaginize process book.epub --text
```

### Using Preset

```bash
# Configure for fantasy genre
cat > .imaginize.config << 'EOF'
customTemplates:
  enabled: true
  preset: "fantasy"
genre: "fantasy"
EOF

# Process with fantasy-optimized prompts
imaginize process fantasy-book.epub
```

### Hybrid Approach

```bash
# Use preset as base, override one phase
cat > .imaginize.config << 'EOF'
customTemplates:
  enabled: true
  preset: "scifi"
  analyzeTemplate: "custom-analyze.txt"  # Custom analyze, default extract/illustrate from preset
EOF
```

## Best Practices

### 1. Start with Defaults

Export default templates and modify incrementally:

```bash
imaginize templates export --output ./templates/
# Edit templates/analyze.txt to customize
```

### 2. Test with Small Sample

Test custom templates on a single chapter first:

```bash
imaginize process book.epub --text --chapters 1 --verbose
```

### 3. Use Variables Liberally

Templates with proper variables are reusable across books:

```
GOOD: "Analyze '{{bookTitle}}' by {{author}}"
BAD:  "Analyze 'Harry Potter' by J.K. Rowling"
```

### 4. Preserve JSON Structure

If modifying response format, ensure parser compatibility:

```
Your template should still return:
[
  {
    "pageRange": "...",
    "quote": "...",
    "description": "..."
  }
]
```

### 5. Document Custom Templates

Add comments to templates explaining customizations:

```
# CUSTOM TEMPLATE: Fantasy-optimized scene analysis
# Modified from default to emphasize magical elements
# Last updated: 2025-11-13
```

## Backward Compatibility

- If `customTemplates.enabled` is false or not specified, use default prompts
- If template file not found, fallback to defaults with warning
- Unknown variables in templates are silently replaced with empty string
- Invalid conditionals are left as-is (visible in prompt for debugging)

## Performance Considerations

- Templates cached after first load (re-read only on cache clear)
- Variable replacement is O(n) where n = template length
- Minimal overhead (~1-2ms per template render)
- No performance impact when custom templates disabled

## Security Considerations

- Template files read with restricted permissions
- No template execution (pure text replacement)
- Variables HTML-escaped to prevent injection
- Template paths validated (no directory traversal)

## Testing Strategy

### Unit Tests
- Variable replacement accuracy
- Conditional processing
- Preset loading
- Cache behavior

### Integration Tests
- End-to-end with custom templates
- Fallback to defaults
- All presets functional
- Variable population from real data

### Manual Tests
- Create custom template for real book
- Test each preset on appropriate genre
- Verify backward compatibility

## Future Enhancements

### Template Marketplace
- Community-contributed templates
- Downloadable preset library
- Rating and reviews

### Advanced Variables
- Loops: `{{#each characters}}{{name}}: {{description}}{{/each}}`
- Filters: `{{bookTitle | uppercase}}`
- Math: `{{add chapterNumber 1}}`

### Visual Template Editor
- Web UI for template editing
- Live preview with sample data
- Syntax highlighting and validation

### AI-Assisted Templates
- Generate custom templates from natural language description
- Optimize templates based on output quality
- Suggest improvements

## Summary

Custom prompt templates provide:
- ✅ Fine-grained control over AI behavior
- ✅ Genre-specific optimizations
- ✅ Reusable across books
- ✅ Easy customization with variables
- ✅ Built-in presets for common genres
- ✅ Backward compatible with existing configs
- ✅ No performance impact when disabled

**Status**: Specification complete, implementation next.
