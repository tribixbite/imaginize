# imaginize

> AI-powered book illustration guide generator - automatically identifies key visual concepts from EPUB and PDF books

[![npm version](https://badge.fury.io/js/imaginize.svg)](https://www.npmjs.com/package/imaginize)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`imaginize` analyzes your books using AI to create comprehensive illustration guides. It identifies the most visually interesting moments and catalogs all important story elements (characters, places, items) with direct quotes for accurate reference.

## Features

- 📚 **Multiple Format Support** - Works with EPUB and PDF files
- 🤖 **Multi-Provider AI** - OpenAI, OpenRouter (with free tier), or custom endpoints
- 📖 **Smart Chapter Selection** - Automatic story chapter mapping (skips front matter)
- 📝 **Enhanced Quote Extraction** - Substantial quotes (3-8 sentences) with full context for standalone reference
- 🎭 **Visual Character Descriptions** - Physical appearance, clothing, and distinguishing features for illustration
- 🔗 **Character Cross-Referencing** - Automatic entity matching with full visual details in every scene
- 🎨 **Image Generation** - Generate illustrations with DALL-E or Gemini
- ✨ **Visual Consistency** - Automatic style extraction and character tracking across all images (v2.4.0+)
- ⚡ **Parallel Processing** - Up to 50% faster with concurrent chapter analysis (paid tier)
- ⚙️ **Highly Configurable** - Customize pages per image, models, and more
- 📊 **Progress Tracking** - Real-time progress.md file with detailed logs
- 📈 **Real-Time Dashboard** - Optional web dashboard for live progress monitoring (v2.6.0+)
- 🔄 **Automatic Rate Limiting** - Handles OpenRouter free tier (1 req/min) automatically

## Quick Start

```bash
# Process a book file in current directory
npx imaginize

# Process a specific file
npx imaginize --file mybook.epub

# Generate a configuration file
npx imaginize --init-config
```

## Installation

### As a Global Tool

```bash
npm install -g imaginize
imaginize
```

### Using npx (Recommended)

```bash
npx imaginize
```

## Requirements

- Node.js 18.0.0 or higher
- API key: OpenAI **or** OpenRouter (OpenRouter offers free tier)

## Configuration

`imaginize` looks for configuration in these locations (in order of priority):

1. `.imaginize.config` in current directory
2. `.imaginize.config` in home directory
3. Environment variables

### Generate Config File

```bash
npx imaginize --init-config
```

This creates a `.imaginize.config` file:

```yaml
# Number of pages per image recommendation
pagesPerImage: 10

# Whether to extract character/item descriptions
extractElements: true

# Whether to generate actual images for characters/items
generateElementImages: false

# OpenAI API configuration
apiKey: "your-api-key-here"
baseUrl: "https://api.openai.com/v1"
model: "gpt-4o"

# Image generation settings
imageModel: "dall-e-3"
imageSize: "1024x1024"
imageQuality: "standard"

# Output settings
outputPattern: "imaginize_{name}"
maxConcurrency: 3
```

### Environment Variables

```bash
export OPENAI_API_KEY="your-key-here"
export OPENAI_BASE_URL="https://api.openai.com/v1"  # Optional
export OPENAI_MODEL="gpt-4o"  # Optional
```

## Output

`imaginize` creates a folder named `imaginize_BOOKNAME` containing:

### 1. Contents.md

Chapter-by-chapter breakdown with:
- Visual concepts (1 per 10 pages by default)
- Direct quotes from the text
- Descriptions of what to illustrate
- Reasoning for why each moment is significant
- Page number references

Example:
```markdown
### Chapter 1: The Beginning

#### Visual Concept 1

**Pages:** 1-5

**Quote:**
> The dragon's scales shimmered like molten gold in the dying sunlight,
> each one the size of a dinner plate.

**Description:** A massive golden dragon at sunset, scales reflecting light

**Why This Matters:** First introduction of the primary antagonist, establishes
the visual scale and grandeur of the fantasy world.
```

### 2. Elements.md

Comprehensive catalog with **visual descriptions** suitable for illustration:
- **Characters** - Physical appearance, clothing, expressions, age
- **Creatures** - Size, color, features (teeth, claws, fur), distinguishing traits
- **Places** - Visual atmosphere and notable features
- **Items** - Important objects, artifacts
- **Objects** - Notable things

Each entry includes:
- **Visual description** extracted from the text (not functional roles)
- Multiple direct quotes with page numbers
- Optional AI-generated image (if enabled)

Example:
```markdown
#### Aria Nightshade

**Type:** character

**Description:** A young elven ranger with silver hair and emerald eyes. She moves with
practiced grace and wears dark leather armor. Skilled with bow and blade, her posture
conveys alertness and confidence. Her silver hair catches moonlight, and her emerald
eyes remain focused and intense.

**Reference Quotes:**

1. (Page 12)
   > Aria's silver hair caught the moonlight as she nocked another arrow,
   > her emerald eyes focused on the distant target.

2. (Page 45)
   > The ranger moved through the forest with practiced grace, her leather
   > armor barely making a sound.
```

**Note:** v2.3.0+ captures visual appearance automatically, ensuring descriptions are
illustration-ready rather than functional ("the protagonist" → "a young boy with
determined expression, dressed casually").

### 3. progress.md

Real-time processing log with:
- Timestamps for all operations
- Chapter-by-chapter progress
- Error tracking
- Processing statistics
- Duration and completion summary

## Visual Consistency (v2.4.0+)

When generating images with `--images`, imaginize automatically maintains visual consistency across your entire book through:

### Automatic Style Extraction

After generating the first 3 images (configurable), GPT-4 Vision analyzes them to extract:
- **Art style** - Digital painting, watercolor, etc.
- **Color palette** - Dominant colors as hex codes
- **Lighting** - Natural daylight, dramatic shadows, etc.
- **Mood** - Whimsical, dark, mysterious, etc.
- **Composition** - Shot types, framing patterns

This style guide is saved to `data/style-guide.json` and applied to all subsequent images.

### Character Appearance Tracking

Characters are automatically tracked across all images:
- **First Appearance** - Visual features extracted from Elements.md (hair, eyes, clothing, build)
- **Consistency** - Character descriptions included in every prompt they appear in
- **Registry** - All appearances saved to `data/character-registry.json` with consistency scores

### Enhanced Prompts

Every image prompt after bootstrap automatically includes:
```
[Original scene description]

VISUAL STYLE GUIDE (maintain consistency):
- Art Style: Digital illustration with soft brush strokes
- Color Palette: #3A5F7D, #C9A961, #8B6F47, #E8D5B7, #5A7D8F
- Lighting: Natural lighting with balanced exposure
- Mood: Whimsical and adventurous
- Composition: Medium shots with characters centered

CHARACTER APPEARANCES (maintain visual consistency):
Christopher - Appearance Reference:
  • Hair: Dark, messy
  • Eyes: Brown, curious
  • Clothing: Navy wool overcoat, casual underneath
  • IMPORTANT: Maintain visual consistency with previous 5 appearance(s)

IMPORTANT - Maintain Consistency:
- Maintain the established visual style (art: Digital illustration...)
- Use the defined color palette
- Match the lighting and mood characteristics
- Ensure character appearances match their previous depictions
```

### Configuration

```yaml
# Enable/disable visual consistency system
enableStyleConsistency: true

# Number of images to analyze for style guide (default: 3)
styleBootstrapCount: 3

# Track character appearances across images
trackCharacterAppearances: true

# Minimum consistency score for warnings (0-1, default: 0.7)
consistencyThreshold: 0.7
```

### Output Files

- `data/style-guide.json` - Extracted visual style from bootstrap images
- `data/character-registry.json` - Character appearance tracking with visual features

**Note:** Visual consistency requires GPT-4 Vision for style analysis (uses your OpenAI API key). If analysis fails, falls back to text-based style guide.

## Real-Time Dashboard (v2.6.0+)

Monitor your book processing in real-time with the optional web dashboard. Perfect for long-running operations to track progress, view ETA, and ensure everything is running smoothly.

**Latest Enhancements (v2.6.1):**
- ✨ **Error Boundaries** - Component-level fault isolation prevents entire dashboard from crashing
- ♿ **WCAG 2.1 AA Accessibility** - Full screen reader support, keyboard navigation, and semantic HTML
- ⚡ **Performance Optimized** - React memoization reduces unnecessary re-renders
- 🔔 **Toast Notifications** - Visual feedback for connection status changes
- **Bundle Size:** Only 65.52 kB gzipped (+2.1% from v2.6.0)

### Starting the Dashboard

```bash
# Enable dashboard (starts on http://localhost:3000)
npx imaginize --dashboard --concurrent --text --images --file mybook.epub

# Custom port
npx imaginize --dashboard --dashboard-port 8080 --text --file mybook.epub

# Custom host (e.g., for remote access)
npx imaginize --dashboard --dashboard-host 0.0.0.0 --dashboard-port 3000 --text --file mybook.epub
```

### Features

**Core Features (v2.6.0):**
- **React-Based UI** - Modern, responsive dark-themed interface with real-time updates
- **Live Progress Updates** - WebSocket-driven updates showing current chapter, phase, and progress percentage
- **Visual Pipeline** - See processing phases (Initialize → Analyze → Extract → Illustrate → Complete)
- **Chapter Grid** - Visual grid showing status of all chapters (pending, in-progress, completed, error)
- **Log Stream** - Real-time color-coded log viewer with auto-scroll
- **ETA Calculation** - Intelligent time estimation based on completed chapters
- **REST API** - `/api/state` and `/api/health` endpoints for integration
- **Auto-Reconnection** - Automatic WebSocket reconnection with exponential backoff
- **Statistics** - Total chapters, completed chapters, concepts found, images generated, elapsed time

**Enhanced Features (v2.6.1):**
- **Error Boundaries** - Graceful error handling with recovery options (Try Again / Reload)
- **Accessibility** - WCAG 2.1 Level AA compliant with ARIA labels, roles, and keyboard navigation
- **Performance** - React.memo() and useMemo() for optimized rendering
- **Toast Notifications** - Connection status feedback with auto-dismiss

### Dashboard UI Components

The dashboard displays real-time information through five main components:

1. **Overall Progress Bar**
   - Animated gradient progress bar (0-100%)
   - Book title with current phase badge
   - Stats grid: chapters completed, concepts found, elapsed time, ETA
   - Images generated counter

2. **Pipeline Visualization**
   - Visual flow of 5 phases with circular indicators
   - Animated pulse on active phase
   - Color-coded status (green=completed, blue=active, gray=pending)
   - Phase icons and labels

3. **Chapter Grid**
   - Responsive grid (4-10 columns based on screen size)
   - Color-coded chapter cards (gray=pending, blue=in-progress, green=completed, red=error)
   - Hover tooltips with chapter titles
   - Status legend

4. **Log Stream**
   - Real-time scrolling log viewer with monospace font
   - Color-coded by level (green=success, yellow=warning, red=error, gray=info)
   - Auto-scroll (stops when user scrolls up)
   - Shows last 100 log entries
   - Timestamps in local time

5. **Connection Status Indicator**
   - Green pulsing dot when connected
   - Red dot when disconnected
   - Automatic reconnection (max 10 attempts)

### Technical Details

**Backend:**
- Express server with WebSocket (ws) support
- Port: Default 3000 (configurable with `--dashboard-port`)
- Host: Default localhost (configurable with `--dashboard-host`)
- Events: Subscribes to ProgressTracker events and broadcasts to connected clients
- API Endpoints:
  - `GET /api/state` - Current progress state (JSON)
  - `GET /api/health` - Server health and connection count (JSON)

**Frontend:**
- React 18 with TypeScript
- Vite build system (212 kB JS, 19 kB CSS; 65.5 kB gzipped)
- Tailwind CSS v4 with dark theme (#111827 background)
- WebSocket client with automatic reconnection
- Responsive design (mobile-first, 4-10 column grid)
- Built to dist/dashboard/ and served by Express
- Enhanced with error boundaries, accessibility, and performance optimizations (v2.6.1)

### Testing

**Backend Test** (Phase 1 validation):
```bash
node test-dashboard-backend.js
```
Tests ProgressTracker EventEmitter → WebSocket flow, all 7 event types, and REST API endpoints.

**Integration Test** (End-to-end validation):
```bash
node test-dashboard-integration.js
```
Tests complete dashboard system with live book processing:
- Dashboard server startup
- WebSocket client connection and message handling
- REST API endpoints (`/api/state`, `/api/health`)
- All 7 event types received correctly
- Initial state population (bookTitle, totalChapters, stats)
- Real-time updates during processing

**Status:** Dashboard fully functional (Phases 1-3 complete). Backend infrastructure, React frontend UI, and integration testing all complete.

**Demo E2E Tests** (GitHub Pages demo validation):
```bash
cd demo
npm run test:e2e          # Run all 68 E2E tests
npm run test:e2e:ui       # Open Playwright UI
npm run test:e2e:report   # View test report
```
Comprehensive Playwright E2E tests for the GitHub Pages demo:
- **68 E2E tests** across 8 suites (340 browser test runs)
- **Cross-browser**: Chrome, Firefox, Safari/WebKit, Mobile
- **Accessibility**: WCAG 2.1 AA compliance validation
- **CI/CD**: Integrated into GitHub Actions (runs on PRs and gates deployments)
- **Coverage**: File upload, API key management, processing, results, errors, mobile UX, accessibility

See `demo/e2e/README.md` for complete documentation.

## Usage Examples

### Basic Usage

```bash
# Process all EPUB/PDF files in current directory
npx imaginize

# Process specific file
npx imaginize --file "The Great Gatsby.epub"
```

### Advanced Configuration

```bash
# Set API key via environment
export OPENAI_API_KEY="sk-..."
npx imaginize

# Use custom OpenAI-compatible endpoint
export OPENAI_BASE_URL="https://custom-endpoint.com/v1"
npx imaginize
```

### With Image Generation

Edit `.imaginize.config`:

```yaml
generateElementImages: true
imageModel: "dall-e-3"
imageSize: "1024x1792"
imageQuality: "hd"
```

**Note:** Image generation requires additional API credits and significantly increases processing time.

## CLI Options

### Phase Selection

- `--text` - Generate Chapters.md with visual scenes (analyze phase)
- `--elements` - Generate Elements.md with story elements (extract phase)
- `--images` - Generate images and update Chapters.md (illustrate phase)

**Default:** If no phase is specified, `--text` is assumed.

**Example:**
```bash
# Analyze text only
npx imaginize --text

# Analyze and generate images in one go
npx imaginize --text --images

# Just generate images from existing Chapters.md
npx imaginize --images
```

### Chapter Selection

- `--chapters <range>` - Process specific story chapters (e.g., "1-5,10")

**Story Chapter Mapping:** Chapter numbers refer to **story chapters**, automatically skipping front matter (copyright, dedication, epigraph, etc.).

**Examples:**
```bash
# Process first 5 story chapters
npx imaginize --chapters 1-5

# Process chapters 1-3 and chapter 10
npx imaginize --chapters 1-3,10

# Generate images for chapters 5-10 only
npx imaginize --images --chapters 5-10
```

**Output:**
```
📋 Processing 5 story chapters:
   Story Ch 1 → EPUB Ch 9: The Beginning
   Story Ch 2 → EPUB Ch 10: Arrival
   ...
```

### Element Filtering

- `--elements-filter <filter>` - Filter elements (e.g., "character:*,place:castle")

**Examples:**
```bash
# Extract all characters only
npx imaginize --elements --elements-filter "character:*"

# Extract specific place
npx imaginize --elements --elements-filter "place:castle"
```

### Control Options

- `--continue` - Continue from saved progress
- `--force` - Force regeneration even if output exists
- `--migrate` - Migrate old state file to new schema
- `--limit <n>` - Limit number of items processed (for testing)

### Configuration Override

- `--model <name>` - Override text model (e.g., "gpt-4o", "google/gemini-2.0-flash-exp:free")
- `--api-key <key>` - Override API key
- `--image-key <key>` - Separate API key for image generation

### Output Options

- `--output-dir <dir>` - Override output directory
- `--verbose` - Verbose logging
- `--quiet` - Minimal output

### Dashboard Options

- `--dashboard` - Start web dashboard for real-time progress monitoring
- `--dashboard-port <port>` - Dashboard server port (default: 3000)
- `--dashboard-host <host>` - Dashboard server host (default: localhost)

### Utilities

- `--init-config` - Generate sample .imaginize.config file
- `--estimate` - Estimate costs without executing
- `-f, --file <path>` - Specific book file to process

### Concurrent Processing

- `--concurrent` - Enable concurrent processing architecture

**Performance:**
- Free tier: ~40% faster (5h → 3h for large books)
- Paid tier: ~50% additional speedup with parallel batch processing (3h → 1.5-2h)

The concurrent mode uses a two-pass analysis approach:
1. **Pass 1:** Fast entity extraction → Generate Elements.md with visual character descriptions
2. **Pass 2:** Parallel chapter analysis (batch size: 1 for free tier, 3 for paid tier) with entity enrichment
3. **Concurrent illustration:** Images generate as chapters complete

**Features:**
- **Parallel Chapter Analysis:** Process multiple chapters simultaneously (paid tier)
- **Visual Character Descriptions:** Physical appearance automatically extracted for illustration-ready prompts
- **Character Cross-Referencing:** Full visual details included in every scene
- **Manifest-driven coordination:** Automatic crash recovery
- **Atomic file operations:** Corruption-proof state management
- **Smart rate limiting:** Auto-detection and handling (2s delays between batches)
- **Automatic recovery:** Stuck chapters timeout after 30 minutes

**Example:**
```bash
# Enable concurrent processing with all v2.3.0 features
npx imaginize --text --images --concurrent

# Default sequential processing (stable)
npx imaginize --text --images
```

**What's New in v2.3.0:**
- Visual character descriptions in Elements.md (physical appearance, not roles)
- Enhanced quotes (3-8 sentences with full context)
- Chapter titles in image filenames
- Parallel batch processing for paid tier APIs
- Multi-word entity name matching (e.g., "Mal" → "Mal Arvorian")

## OpenRouter Support

`imaginize` supports OpenRouter for **free** text analysis and image generation:

```bash
# Set OpenRouter API key
export OPENROUTER_API_KEY="sk-or-v1-..."

# Run with free models (auto-selected)
npx imaginize --text --images

# Or specify models explicitly
npx imaginize --model "google/gemini-2.0-flash-exp:free"
```

**Free Models:**
- Text: `google/gemini-2.0-flash-exp:free` (128K context, $0.00)
- Images: `google/gemini-2.5-flash-image` ($0.00, 1 request/min)

**Rate Limiting:** Automatic 65-second wait handling for OpenRouter free tier (1 request/minute). The tool will automatically retry and continue processing.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pagesPerImage` | number | `10` | How many pages between image recommendations |
| `extractElements` | boolean | `true` | Extract characters, places, items |
| `generateElementImages` | boolean | `false` | Generate AI images for elements |
| `apiKey` | string | - | OpenAI API key (required) |
| `baseUrl` | string | `https://api.openai.com/v1` | API endpoint URL |
| `model` | string | `gpt-4o` | Model for text analysis |
| `imageModel` | string | `dall-e-3` | Model for image generation |
| `imageSize` | string | `1024x1024` | Image dimensions |
| `imageQuality` | string | `standard` | `standard` or `hd` |
| `outputPattern` | string | `imaginize_{name}` | Output directory pattern |
| `maxConcurrency` | number | `3` | Max concurrent API requests |

## API Costs

`imaginize` makes API calls to OpenAI. Approximate costs:

- **Text Analysis (GPT-4o):** ~$0.50-2.00 per book (depending on length)
- **Image Generation (DALL-E 3):** $0.040-0.080 per image
  - Standard quality: $0.040/image
  - HD quality: $0.080/image

A typical 300-page novel with default settings:
- Text analysis: ~$1.50
- Image generation (if enabled, ~30 images): ~$1.20-2.40
- **Total:** ~$2.70-3.90

## Troubleshooting

### "No book files found"

Make sure you have `.epub` or `.pdf` files in your current directory, or specify a file with `--file`.

### "API key is required"

Set your OpenAI API key:
```bash
export OPENAI_API_KEY="sk-..."
# or
npx imaginize --init-config  # then edit the config file
```

### "Failed to parse book"

- Ensure the file is a valid EPUB or PDF
- Try with a different book file to isolate the issue
- Check the progress.md file for detailed error logs

### Rate Limiting

If you hit rate limits, adjust `maxConcurrency` in your config:

```yaml
maxConcurrency: 1  # Slower but safer
```

## Development

```bash
# Clone and install
git clone https://github.com/tribixbite/imaginize.git
cd imaginize
npm install

# Build
npm run build

# Test locally
npm link
imaginize --help

# Lint and format
npm run lint
npm run format
```

## Contributing

Contributions are welcome! We love community contributions.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for comprehensive guidelines including:
- Development setup and prerequisites
- Code style and conventions
- Testing requirements (86% coverage)
- Pull request process
- Issue reporting templates

**Quick Start for Contributors:**
1. Fork the repository
2. Clone and install: `npm install && npm run build`
3. Make your changes with tests
4. Submit a pull request with conventional commits

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions.

## License

MIT

## Acknowledgments

- Uses [epub.js](https://github.com/futurepress/epub.js) for EPUB parsing
- Uses [pdf-parse](https://www.npmjs.com/package/pdf-parse) for PDF extraction
- Powered by [OpenAI](https://openai.com) GPT-4o and DALL-E 3

## Roadmap

- [ ] Support for more book formats (MOBI, AZW)
- [ ] Local LLM support (Ollama, LM Studio)
- [ ] Interactive chapter selection
- [ ] Batch processing multiple books
- [ ] Export to different formats (JSON, HTML)
- [ ] Custom prompt templates
- [ ] Character relationship mapping
- [ ] Scene timeline visualization

## Support

- **Issues:** [GitHub Issues](https://github.com/tribixbite/imaginize/issues)
- **Discussions:** [GitHub Discussions](https://github.com/tribixbite/imaginize/discussions)
