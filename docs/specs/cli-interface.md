# CLI Interface Specification

## Overview

imaginize provides a comprehensive command-line interface for processing books into illustrated guides. The CLI is built with Commander.js and supports phase-based execution, resume functionality, and extensive configuration options.

## Command Structure

```bash
imaginize [options] [file]
```

## Global Options

### File Selection
```bash
--file <path>              # Specify book file explicitly
                          # If omitted, interactive file picker

# Examples:
imaginize --file book.epub
imaginize --file ~/Books/novel.pdf
imaginize  # Interactive picker
```

### Phase Control
```bash
--text                    # Run analyze phase (generate scene descriptions)
--images                  # Run illustrate phase (generate AI images)
--elements                # Run extract phase (generate Elements.md)

# Combinations:
--text --images           # Analyze + Illustrate
--text --elements         # Analyze + Extract
--text --elements --images  # Full pipeline
```

### Chapter Selection
```bash
--chapters <selection>    # Process specific chapters

# Formats:
--chapters 1              # Single chapter
--chapters 1-5            # Range (chapters 1 through 5)
--chapters 1,3,5          # List (chapters 1, 3, and 5)
--chapters 1-10,15-20     # Multiple ranges
--chapters 1-5,8,10-15    # Mixed ranges and singles

# Special:
--chapters all            # All chapters (default)
```

**Note**: Chapter numbers refer to **story chapters**, not EPUB chapter indices. Front matter (copyright, dedication, epigraph) is automatically filtered.

### Element Type Filtering
```bash
--element-types <types>   # Filter element extraction

# Types:
--element-types characters
--element-types characters,creatures
--element-types places,items
--element-types all       # Default

# Example:
imaginize --elements --element-types characters,creatures --file book.epub
```

### Resume & Force Options
```bash
--continue                # Resume from last state
--force                   # Regenerate everything, ignore state

# Examples:
imaginize --continue      # Continue interrupted processing
imaginize --force --text  # Force regenerate scene descriptions
```

### Concurrent Processing
```bash
--concurrent              # Enable concurrent/parallel processing

# Features:
# - Two-pass analysis (fast entity extraction + enriched analysis)
# - Manifest-based coordination
# - 40% faster than sequential mode
# - Best for paid tier or large books

# Example:
imaginize --text --images --concurrent --file large-book.epub
```

### Dashboard Options
```bash
--dashboard               # Enable real-time web dashboard
--dashboard-port <port>   # Dashboard port (default: 3000)
--dashboard-host <host>   # Dashboard host (default: localhost)

# Examples:
imaginize --text --dashboard
imaginize --text --dashboard --dashboard-port 8080
imaginize --text --dashboard --dashboard-host 0.0.0.0  # Network accessible
```

### Configuration
```bash
--init-config             # Generate .imaginize.config template
--config <path>           # Use specific config file

# Examples:
imaginize --init-config   # Create config template
imaginize --config custom.config --file book.epub
```

### Output
```bash
--output <pattern>        # Output directory pattern

# Pattern variables:
# {name} - Book title (sanitized)
# {date} - Current date (YYYY-MM-DD)
# {timestamp} - Unix timestamp

# Examples:
--output "imaginize_{name}"           # Default
--output "output_{date}_{name}"
--output "books/{name}/illustrated"
```

### Help & Version
```bash
--help, -h                # Show help message
--version, -v             # Show version number

# Examples:
imaginize --help
imaginize --version
```

## Usage Examples

### Basic Processing
```bash
# Full pipeline with interactive file selection
imaginize --text --elements --images

# Specific book
imaginize --text --images --file ~/Books/novel.epub

# First 5 chapters only
imaginize --text --images --chapters 1-5 --file book.epub
```

### Resume Workflows
```bash
# Start processing
imaginize --text --images --file book.epub
# ... interrupted ...

# Resume from where it left off
imaginize --continue

# Force regenerate specific phase
imaginize --force --images --file book.epub
```

### Concurrent Processing
```bash
# Fast concurrent mode (40% faster)
imaginize --text --images --concurrent --file large-book.epub

# With dashboard monitoring
imaginize --text --images --concurrent --dashboard --file book.epub
```

### Element Extraction
```bash
# Extract all elements
imaginize --elements --file book.epub

# Characters only
imaginize --elements --element-types characters --file book.epub

# Characters and creatures
imaginize --elements --element-types characters,creatures --file book.epub
```

### Dashboard Monitoring
```bash
# Enable dashboard
imaginize --text --dashboard --file book.epub
# Then open: http://localhost:3000

# Custom port
imaginize --text --dashboard --dashboard-port 8080 --file book.epub
# Then open: http://localhost:8080

# Network accessible (caution: no auth)
imaginize --text --dashboard --dashboard-host 0.0.0.0 --file book.epub
# Then open: http://<your-ip>:3000
```

### Configuration
```bash
# Generate config template
imaginize --init-config
# Edit .imaginize.config
# Run with config
imaginize --text --images --file book.epub
```

## Exit Codes

```
0   - Success (all phases completed)
1   - Error (invalid arguments, file not found, API error)
2   - User cancelled (Ctrl+C, file picker cancelled)
130 - SIGINT (Ctrl+C during processing)
```

## Output Files

### Generated Files
```
imaginize_BookTitle/
├── .imaginize.state.json       # Resume state
├── .imaginize.manifest.json    # Concurrent coordination (if --concurrent)
├── progress.md                 # Processing log
├── Contents.md                 # Visual concepts per chapter (if --text)
├── Chapters.md                 # Full scene descriptions (if --text)
├── Elements.md                 # Story element catalog (if --elements)
├── style-guide.json            # Visual style consistency (if --images)
├── character-registry.json     # Character appearances (if --images)
└── chapter_N_title_scene_M.png # Generated images (if --images)
```

### File Naming
```
Chapter images:
  chapter_{N}_{title}_scene_{M}.png

Examples:
  chapter_1_the_beginning_scene_1.png
  chapter_9_the_reveal_scene_2.png
  chapter_15_final_battle_scene_1.png
```

## Interactive Features

### File Picker
When no `--file` is specified, interactive picker shows:
```
📚 Select a book to process:

  ○ Book1.epub (unprocessed)
  ○ Book2.pdf (unprocessed)
  ● Book3.epub (partially processed - resume available)
  ○ Book4.epub (completed - force to regenerate)

↑↓: Navigate  Enter: Select  Ctrl+C: Cancel
```

**Sorting**:
1. Unprocessed books first
2. Then by modification date (newest first)

### Progress Display
```
📖 **Book:** Impossible Creatures
📄 **Total Pages:** 297

## Analyze Phase

✓ Pass 1: Entity extraction (83/83 chapters)
⏳ Pass 2: Full analysis (45/83 chapters, 54.2%)
  ↳ Chapter 46: Analyzing...
  ↳ ETA: 8m 32s

## Illustrate Phase

⏳ Generating images (12/64 scenes, 18.8%)
  ↳ Chapter 15: scene_2.png...
  ↳ ETA: 25m 15s
```

### Dashboard UI
When `--dashboard` is enabled:
```
🌐 Dashboard started: http://localhost:3000

Press Ctrl+C to stop processing...
```

Dashboard shows:
- Overall progress (percentage, ETA)
- Pipeline visualization (current phase)
- Chapter grid (status of each chapter)
- Real-time log stream
- Connection status

## Error Handling

### Common Errors

#### No API Key
```
❌ Error: No API key found. Set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.

Fix:
  export OPENROUTER_API_KEY="sk-or-..."
  # or
  echo "apiKey: sk-or-..." > .imaginize.config
```

#### File Not Found
```
❌ Error: Book file not found: /path/to/book.epub

Fix:
  - Check file path
  - Use absolute path or relative to current directory
  - Ensure file has .epub or .pdf extension
```

#### Invalid Arguments
```
❌ Error: Must specify at least one phase: --text, --images, or --elements

Fix:
  imaginize --text --file book.epub
  # or
  imaginize --text --images --file book.epub
```

#### Rate Limit Hit
```
⏳ Rate limit hit for analyze chapter 11. Waiting 65s before retry 1/10...
⏳ Retry 1/10 in 60s...
✓ Chapter 11 completed after retry
```
**Automatic**: No action needed, waits and retries automatically

## Environment Variables

### API Keys
```bash
OPENROUTER_API_KEY         # OpenRouter API key (recommended for free tier)
OPENAI_API_KEY             # OpenAI API key
GEMINI_API_KEY             # Google Gemini API key (if using Imagen)
```

### Model Override
```bash
IMAGINIZE_TEXT_MODEL       # Override default text model
IMAGINIZE_IMAGE_MODEL      # Override default image model

# Examples:
export IMAGINIZE_TEXT_MODEL="gpt-4o"
export IMAGINIZE_IMAGE_MODEL="dall-e-3"
```

### Debugging
```bash
DEBUG=imaginize:*          # Enable debug logging
NODE_ENV=development       # Enable verbose output
```

## Configuration Priority

Configuration is loaded in this order (later overrides earlier):

1. **Defaults** (hardcoded in src/lib/config.ts)
2. **Home directory** (~/.imaginize.config)
3. **Project directory** (./.imaginize.config)
4. **Environment variables** (OPENROUTER_API_KEY, etc.)
5. **CLI arguments** (--chapters, --concurrent, etc.)

## Advanced Usage

### Batch Processing
```bash
# Process multiple books with same settings
for book in ~/Books/*.epub; do
  imaginize --text --images --concurrent --file "$book"
done
```

### Resume All Unfinished
```bash
# Find and resume all partially processed books
find . -name ".imaginize.state.json" -execdir imaginize --continue \;
```

### Custom Output Locations
```bash
# Organize by date
imaginize --text --output "output_{date}/{name}" --file book.epub

# Separate directory per book
imaginize --text --output "books/{name}" --file book1.epub
imaginize --text --output "books/{name}" --file book2.epub
```

### Dashboard + Concurrent
```bash
# Maximum performance with monitoring
imaginize \
  --text \
  --images \
  --concurrent \
  --dashboard \
  --dashboard-host 0.0.0.0 \
  --file large-book.epub

# Then monitor from any device on network:
# http://<server-ip>:3000
```

## Performance Tips

### Fastest Processing
```bash
# Use concurrent mode + OpenRouter free tier
export OPENROUTER_API_KEY="sk-or-..."
imaginize --text --images --concurrent --file book.epub

# Expected: 3h for 83-chapter book (vs 5h sequential)
```

### Lowest Cost
```bash
# OpenRouter free tier (100% free)
export OPENROUTER_API_KEY="sk-or-..."
imaginize --text --images --file book.epub

# Cost: $0.00
```

### Best Quality
```bash
# Use GPT-4o + DALL-E 3
export OPENAI_API_KEY="sk-..."
cat > .imaginize.config <<EOF
model: "gpt-4o"
imageEndpoint:
  model: "dall-e-3"
imageQuality: "hd"
EOF

imaginize --text --images --file book.epub

# Expected cost: ~$5-10 for full book
```

## Integration with Other Tools

### npm/npx
```bash
# One-time use (no install)
npx imaginize --text --file book.epub

# Global install
npm install -g imaginize
imaginize --text --file book.epub
```

### Docker
```bash
# Mount books directory and config
docker run -v $(pwd):/books -v ~/.imaginize.config:/root/.imaginize.config \
  imaginize/cli --text --images --file /books/novel.epub
```

### CI/CD
```bash
# GitHub Actions example
- name: Generate illustrated guide
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  run: |
    npx imaginize --text --elements --chapters 1-3 --file test-book.epub
    # Upload artifacts...
```

---

**See Also:**
- [Configuration System](./configuration.md)
- [Pipeline Architecture](./pipeline-architecture.md)
- [Dashboard System](./dashboard.md)
- [State Management](./state-management.md)
