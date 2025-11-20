#!/bin/bash
# Full pipeline runner for Impossible Creatures
# This script runs all phases: analyze, extract, illustrate, and compile

set -e

BOOK="ImpossibleCreatures.epub"
OUTPUT_DIR="imaginize_ImpossibleCreatures"

echo "========================================"
echo "Full Pipeline for Impossible Creatures"
echo "========================================"
echo ""

# Phase 1: Text Analysis (all chapters)
echo "Phase 1: Text Analysis"
echo "----------------------"
echo "y" | node bin/imaginize.js --continue --text --file "$BOOK"
echo "✅ Text analysis complete"
echo ""

# Phase 2: Element Extraction
echo "Phase 2: Element Extraction"
echo "----------------------------"
echo "y" | node bin/imaginize.js --continue --elements --file "$BOOK"
echo "✅ Element extraction complete"
echo ""

# Phase 3: Image Generation
echo "Phase 3: Image Generation"
echo "-------------------------"
echo "y" | node bin/imaginize.js --continue --images --file "$BOOK"
echo "✅ Image generation complete"
echo ""

# Phase 4: Compilations (6 types)
echo "Phase 4: Graphic Novel Compilations"
echo "------------------------------------"

if [ ! -f "bin/compile-graphic-novel.js" ]; then
  echo "⚠️  Compilation script not found. Skipping compilations."
else
  # Run all 6 compilation types
  COMPILATION_TYPES=("standard" "compact" "deluxe" "minimalist" "annotated" "portfolio")

  for type in "${COMPILATION_TYPES[@]}"; do
    echo "Creating $type compilation..."
    node bin/compile-graphic-novel.js --type "$type" --input "$OUTPUT_DIR"
  done

  echo "✅ All 6 compilations complete"
fi

echo ""
echo "========================================"
echo "Pipeline Complete!"
echo "========================================"
echo ""
echo "Output directory: $OUTPUT_DIR"
echo ""
ls -lh "$OUTPUT_DIR"/*.{md,pdf} 2>/dev/null || true
