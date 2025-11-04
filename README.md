# imaginize

> AI-powered book illustration guide generator - automatically identifies key visual concepts from EPUB and PDF books

[![npm version](https://badge.fury.io/js/imaginize.svg)](https://www.npmjs.com/package/imaginize)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`imaginize` analyzes your books using AI to create comprehensive illustration guides. It identifies the most visually interesting moments and catalogs all important story elements (characters, places, items) with direct quotes for accurate reference.

## Features

- 📚 **Multiple Format Support** - Works with EPUB and PDF files
- 🤖 **AI-Powered Analysis** - Uses GPT-4o to identify key visual concepts
- 📝 **Smart Quote Extraction** - Direct quotes with page numbers for every concept
- 🎭 **Element Cataloging** - Comprehensive lists of characters, creatures, places, items
- 🎨 **Optional Image Generation** - Generate AI images for story elements
- ⚙️ **Highly Configurable** - Customize pages per image, models, and more
- 📊 **Progress Tracking** - Real-time progress.md file with detailed logs

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
- OpenAI API key (for GPT analysis)

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

Comprehensive catalog of:
- **Characters** - Main and supporting characters
- **Creatures** - Fantasy beings, animals
- **Places** - Locations, landmarks
- **Items** - Important objects, artifacts
- **Objects** - Notable things

Each entry includes:
- Multiple direct quotes with page numbers
- Consolidated description
- Optional AI-generated image (if enabled)

Example:
```markdown
#### Aria Nightshade

**Description:** A young elven ranger with silver hair and emerald eyes,
skilled with bow and blade.

**Reference Quotes:**

1. (Page 12)
   > Aria's silver hair caught the moonlight as she nocked another arrow,
   > her emerald eyes focused on the distant target.

2. (Page 45)
   > The ranger moved through the forest with practiced grace, her leather
   > armor barely making a sound.
```

### 3. progress.md

Real-time processing log with:
- Timestamps for all operations
- Chapter-by-chapter progress
- Error tracking
- Processing statistics
- Duration and completion summary

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

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

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
