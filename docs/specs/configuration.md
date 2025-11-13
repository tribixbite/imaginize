# Configuration System Specification

## Overview

imaginize uses a flexible configuration system based on Cosmiconfig, supporting multiple configuration sources, environment variable overrides, and automatic provider detection.

## Configuration File Locations

### Search Order (Cosmiconfig)
1. `package.json` - `imaginize` property
2. `.imaginize.config` (YAML or JSON)
3. `.imaginize.config.json`
4. `.imaginize.config.yaml`
5. `.imaginize.config.yml`
6. `.imaginize.config.js`
7. `imaginize.config.js`

### Scope
- **Project directory**: Current working directory
- **Home directory**: `~/.imaginize.config` (global defaults)

### Priority
```
CLI args > Project config > Home config > Environment variables > Defaults
```

## Configuration Schema

### Complete Example (.imaginize.config)
```yaml
# API Configuration
apiKey: "sk-or-..."                    # Primary API key
baseUrl: "https://openrouter.ai/api/v1"  # Text generation endpoint

# Model Configuration
model: "google/gemini-2.0-flash-exp:free"  # Text generation model

# Image Endpoint (optional, if different from text)
imageEndpoint:
  apiKey: "sk-..."                     # Separate API key (optional)
  baseUrl: "https://api.openai.com/v1"  # Image generation endpoint
  model: "dall-e-3"                    # Image generation model

# Processing Configuration
pagesPerImage: 10                      # Pages before new visual scene
extractElements: true                  # Extract story elements
generateElementImages: false           # Generate images for each element

# Output Configuration
outputPattern: "imaginize_{name}"      # Output directory pattern
imageSize: "1024x1024"                # Image dimensions
imageQuality: "standard"               # standard | hd
maxConcurrency: 3                      # Max concurrent API calls

# Advanced Configuration
pagesPerAutoChapter: 50                # Auto-split large chapters
tokenSafetyMargin: 0.9                # Safety margin for token limits (90%)
enableVisualStyleConsistency: true     # Style guide system
styleBootstrapImageCount: 3            # Images before style analysis
trackCharacterAppearances: true        # Character registry
```

## Configuration Properties

### API Configuration

#### `apiKey` (string)
- **Default**: From environment variable
- **Required**: Yes (unless in environment)
- **Sources**: `OPENROUTER_API_KEY` or `OPENAI_API_KEY`
- **Example**: `"sk-or-v1-..."`

#### `baseUrl` (string)
- **Default**: Auto-detected from API key
- **Required**: No
- **Auto-detection**:
  - `OPENROUTER_API_KEY` → `https://openrouter.ai/api/v1`
  - `OPENAI_API_KEY` → `https://api.openai.com/v1`
- **Custom**: `"http://localhost:1234/v1"` for local LLMs

### Model Configuration

#### `model` (string | ModelConfig)
- **Default**: Auto-selected based on provider
- **Required**: No
- **String format**: `"gpt-4o-mini"`
- **Object format**:
```yaml
model:
  name: "gpt-4o-mini"
  contextWindow: 128000
  inputCost: 0.15    # per 1M tokens
  outputCost: 0.60   # per 1M tokens
  supportsImages: false
```

**Auto-selection**:
- OpenRouter + free tier → `google/gemini-2.0-flash-exp:free`
- OpenRouter + paid tier → `gpt-4o`
- OpenAI → `gpt-4o-mini`

#### `imageEndpoint` (object, optional)
Separate configuration for image generation if different from text endpoint.

```yaml
imageEndpoint:
  apiKey: "sk-..."                     # Optional, uses main apiKey if omitted
  baseUrl: "https://api.openai.com/v1"  # Required if using different provider
  model: "dall-e-3"                    # Required
```

**Common Configurations**:
```yaml
# OpenRouter for both text and images
apiKey: "sk-or-..."
model: "google/gemini-2.0-flash-exp:free"
imageEndpoint:
  model: "google/gemini-2.5-flash-image"

# OpenRouter for text, OpenAI for images
apiKey: "sk-or-..."
model: "google/gemini-2.0-flash-exp:free"
imageEndpoint:
  apiKey: "sk-..."
  baseUrl: "https://api.openai.com/v1"
  model: "dall-e-3"

# Local LLM for text, OpenAI for images
baseUrl: "http://localhost:1234/v1"
model: "local-model"
imageEndpoint:
  apiKey: "sk-..."
  baseUrl: "https://api.openai.com/v1"
  model: "dall-e-3"
```

### Processing Configuration

#### `pagesPerImage` (number)
- **Default**: `10`
- **Range**: `1-100`
- **Description**: Estimated pages before generating new visual scene
- **Impact**: Lower = more scenes/images, higher cost

#### `extractElements` (boolean)
- **Default**: `true`
- **Description**: Enable story element extraction (characters, creatures, places, items)

#### `generateElementImages` (boolean)
- **Default**: `false`
- **Description**: Generate individual images for each element
- **Cost Impact**: High (additional N images where N = element count)

#### `maxConcurrency` (number)
- **Default**: `3`
- **Range**: `1-10`
- **Description**: Maximum concurrent API calls
- **Free tier**: Should be `1` to avoid rate limits
- **Paid tier**: `3-5` for optimal throughput

### Output Configuration

#### `outputPattern` (string)
- **Default**: `"imaginize_{name}"`
- **Variables**:
  - `{name}` - Book title (sanitized)
  - `{date}` - Current date (YYYY-MM-DD)
  - `{timestamp}` - Unix timestamp
- **Examples**:
  - `"imaginize_{name}"` → `imaginize_Impossible_Creatures/`
  - `"output/{date}/{name}"` → `output/2025-11-13/Impossible_Creatures/`
  - `"books/{name}"` → `books/Impossible_Creatures/`

#### `imageSize` (string)
- **Default**: `"1024x1024"`
- **Options**:
  - `"256x256"` - Low quality, fast
  - `"512x512"` - Medium quality
  - `"1024x1024"` - High quality (recommended)
  - `"1792x1024"` - Wide format
  - `"1024x1792"` - Tall format
- **Provider Support**:
  - OpenAI DALL-E 3: All sizes
  - OpenRouter Gemini: `1024x1024` only

#### `imageQuality` (string)
- **Default**: `"standard"`
- **Options**:
  - `"standard"` - Standard quality, faster, cheaper
  - `"hd"` - High definition, slower, 2x cost
- **Provider Support**:
  - OpenAI DALL-E 3: Both
  - OpenRouter Gemini: Ignored (always high quality)

### Advanced Configuration

#### `pagesPerAutoChapter` (number)
- **Default**: `50`
- **Range**: `10-200`
- **Description**: Auto-split chapters longer than N pages
- **Use Case**: Very long chapters (50+ pages)

#### `tokenSafetyMargin` (number)
- **Default**: `0.9` (90%)
- **Range**: `0.7-0.95`
- **Description**: Safety margin for token limit calculations
- **Example**: With 128k context and 0.9 margin, max tokens = 115.2k

#### `enableVisualStyleConsistency` (boolean)
- **Default**: `true`
- **Description**: Enable automatic style guide generation and application
- **How It Works**:
  1. Generate first 3 images
  2. Analyze style with GPT-4 Vision
  3. Extract style guide (colors, composition, technique)
  4. Apply to all subsequent images

#### `styleBootstrapImageCount` (number)
- **Default**: `3`
- **Range**: `1-10`
- **Description**: Number of images to generate before style analysis

#### `trackCharacterAppearances` (boolean)
- **Default**: `true`
- **Description**: Enable character appearance tracking across chapters
- **Output**: `character-registry.json` with appearance details

## Environment Variable Overrides

### API Keys
```bash
OPENROUTER_API_KEY="sk-or-..."         # OpenRouter API key
OPENAI_API_KEY="sk-..."                # OpenAI API key
GEMINI_API_KEY="sk-..."                # Google Gemini API key (if using Imagen)
```

**Priority**: Environment > Config file

### Model Overrides
```bash
IMAGINIZE_TEXT_MODEL="gpt-4o"          # Override text model
IMAGINIZE_IMAGE_MODEL="dall-e-3"       # Override image model
```

### Debug/Logging
```bash
DEBUG="imaginize:*"                    # Enable debug logging
NODE_ENV="development"                 # Verbose output
```

## Provider Detection

### Automatic Detection
Based on `baseUrl` or API key environment variable:

```typescript
// OpenRouter
if (apiKey.startsWith('sk-or-') || baseUrl.includes('openrouter')) {
  provider = 'openrouter';
  defaultModel = 'google/gemini-2.0-flash-exp:free';
}

// OpenAI
else if (apiKey.startsWith('sk-') || baseUrl.includes('openai.com')) {
  provider = 'openai';
  defaultModel = 'gpt-4o-mini';
}

// Custom/Local
else {
  provider = 'custom';
  defaultModel = 'local-model'; // Must be specified in config
}
```

### Recommended Free Tier Models

#### OpenRouter (100% Free)
```yaml
apiKey: "sk-or-..."
model: "google/gemini-2.0-flash-exp:free"
imageEndpoint:
  model: "google/gemini-2.5-flash-image"

# Features:
# - Text: Free with rate limits (1 req/min)
# - Images: Free 1024x1024 PNG
# - Auto rate limit handling (65s wait)
```

#### OpenAI (Paid)
```yaml
apiKey: "sk-..."
model: "gpt-4o-mini"          # $0.15/$0.60 per 1M tokens
imageEndpoint:
  model: "dall-e-3"            # $0.040 per image (standard)

# Features:
# - Best quality text analysis
# - DALL-E 3 highest quality images
# - Fast (no rate limits)
# - Cost: ~$5-10 per book
```

## Configuration Templates

### Minimal (Auto-detect everything)
```yaml
# .imaginize.config
apiKey: "sk-or-..."
```

### OpenRouter Free Tier (Recommended)
```yaml
# .imaginize.config
apiKey: "sk-or-..."
model: "google/gemini-2.0-flash-exp:free"
imageEndpoint:
  model: "google/gemini-2.5-flash-image"
pagesPerImage: 10
maxConcurrency: 1  # Free tier rate limit
```

### OpenAI Best Quality
```yaml
# .imaginize.config
apiKey: "sk-..."
model: "gpt-4o"
imageEndpoint:
  model: "dall-e-3"
imageQuality: "hd"
imageSize: "1024x1024"
pagesPerImage: 10
maxConcurrency: 3
```

### Local LLM + OpenAI Images
```yaml
# .imaginize.config
baseUrl: "http://localhost:1234/v1"
model: "local-llama-3-8b"
imageEndpoint:
  apiKey: "sk-..."
  baseUrl: "https://api.openai.com/v1"
  model: "dall-e-3"
maxConcurrency: 5  # Local LLM can handle more
```

### Multi-Provider (OpenRouter text + OpenAI images)
```yaml
# .imaginize.config
apiKey: "sk-or-..."
baseUrl: "https://openrouter.ai/api/v1"
model: "google/gemini-2.0-flash-exp:free"
imageEndpoint:
  apiKey: "sk-..."
  baseUrl: "https://api.openai.com/v1"
  model: "dall-e-3"
maxConcurrency: 1  # Limited by free tier text
```

## Validation

### Required Fields
At runtime, validates:
- ✅ `apiKey` exists (config or environment)
- ✅ `model` is specified or auto-detected
- ✅ `baseUrl` is valid URL format (if custom)
- ✅ `imageEndpoint.model` exists if `--images` flag

### Optional Warnings
- ⚠️ `maxConcurrency > 1` with free tier model
- ⚠️ `pagesPerImage < 5` (may generate too many images)
- ⚠️ `tokenSafetyMargin < 0.8` (may hit token limits)

## Loading Process

### 1. Load Defaults
```typescript
const DEFAULT_CONFIG = {
  pagesPerImage: 10,
  extractElements: true,
  generateElementImages: false,
  model: 'gpt-4o-mini',
  imageSize: '1024x1024',
  imageQuality: 'standard',
  maxConcurrency: 3,
  // ... more defaults
};
```

### 2. Search for Config Files
Cosmiconfig searches current directory upward, then home directory.

### 3. Detect Provider
Based on `OPENROUTER_API_KEY` or `OPENAI_API_KEY` environment variables.

### 4. Auto-Configure Endpoints
```typescript
if (process.env.OPENROUTER_API_KEY && !config.baseUrl) {
  config.baseUrl = 'https://openrouter.ai/api/v1';
  config.apiKey = process.env.OPENROUTER_API_KEY;
  config.model = 'google/gemini-2.0-flash-exp:free';

  if (!config.imageEndpoint) {
    config.imageEndpoint = {
      model: 'google/gemini-2.5-flash-image'
    };
  }
}
```

### 5. Merge CLI Arguments
CLI arguments override all config sources.

### 6. Validate
Ensure all required fields present and valid.

## TypeScript Types

```typescript
interface IllustrateConfig {
  // API
  apiKey?: string;
  baseUrl?: string;

  // Models
  model?: string | ModelConfig;
  imageEndpoint?: {
    apiKey?: string;
    baseUrl?: string;
    model: string | ModelConfig;
  };

  // Processing
  pagesPerImage?: number;
  extractElements?: boolean;
  generateElementImages?: boolean;
  maxConcurrency?: number;

  // Output
  outputPattern?: string;
  imageSize?: string;
  imageQuality?: 'standard' | 'hd';

  // Advanced
  pagesPerAutoChapter?: number;
  tokenSafetyMargin?: number;
  enableVisualStyleConsistency?: boolean;
  styleBootstrapImageCount?: number;
  trackCharacterAppearances?: boolean;
}

interface ModelConfig {
  name: string;
  contextWindow: number;
  inputCost: number;   // per 1M tokens
  outputCost: number;  // per 1M tokens
  supportsImages: boolean;
}
```

## Configuration File Generation

### `--init-config` Command
```bash
imaginize --init-config
```

Generates `.imaginize.config` with commented template:
```yaml
# imaginize Configuration
# See: https://github.com/tribixbite/imaginize#configuration

# API Configuration (required)
apiKey: "your-api-key-here"  # OPENROUTER_API_KEY or OPENAI_API_KEY
# baseUrl: "https://openrouter.ai/api/v1"  # Auto-detected

# Model Configuration
# model: "google/gemini-2.0-flash-exp:free"  # Auto-selected
# imageEndpoint:
#   model: "google/gemini-2.5-flash-image"

# Processing Configuration
pagesPerImage: 10
extractElements: true
generateElementImages: false
maxConcurrency: 3

# Output Configuration
# outputPattern: "imaginize_{name}"
# imageSize: "1024x1024"
# imageQuality: "standard"

# Advanced Configuration
# pagesPerAutoChapter: 50
# tokenSafetyMargin: 0.9
# enableVisualStyleConsistency: true
# styleBootstrapImageCount: 3
# trackCharacterAppearances: true
```

---

**See Also:**
- [CLI Interface](./cli-interface.md)
- [AI Integration](./ai-integration.md)
- [Pipeline Architecture](./pipeline-architecture.md)
- [Token Management](./token-management.md)
