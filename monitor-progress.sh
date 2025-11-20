#!/bin/bash
# Monitor processing progress for Impossible Creatures

OUTPUT_DIR="imaginize_ImpossibleCreatures"
STATE_FILE="$OUTPUT_DIR/.imaginize.state.json"

if [ ! -f "$STATE_FILE" ]; then
  echo "No processing found. Start with: ./run-full-pipeline.sh"
  exit 1
fi

echo "Impossible Creatures - Processing Monitor"
echo "=========================================="
echo ""

# Function to get chapter count for a phase
get_chapter_count() {
  local phase=$1
  local status=$2
  jq -r ".phases.$phase.chapters | to_entries | map(select(.value.status == \"$status\")) | length" "$STATE_FILE"
}

# Get overall stats
TOTAL_CHAPTERS=$(jq -r '.totalPages // 83' "$STATE_FILE")
TOKENS_USED=$(jq -r '.tokensUsed // 0' "$STATE_FILE")

# Analyze phase
ANALYZE_COMPLETE=$(get_chapter_count "analyze" "completed")
ANALYZE_PROGRESS=$(jq -r '.phases.analyze.progress // "N/A"' "$STATE_FILE")

# Extract phase
EXTRACT_STATUS=$(jq -r '.phases.extract.status // "pending"' "$STATE_FILE")

# Illustrate phase
ILLUSTRATE_COMPLETE=$(get_chapter_count "illustrate" "completed")

echo "Book: Impossible Creatures"
echo "Total Chapters: $TOTAL_CHAPTERS"
echo "Tokens Used: $TOKENS_USED"
echo ""

echo "Phase Progress:"
echo "---------------"
echo "📝 Analyze:    $ANALYZE_COMPLETE/$TOTAL_CHAPTERS chapters ($ANALYZE_PROGRESS)"
echo "🔍 Extract:    $EXTRACT_STATUS"
echo "🎨 Illustrate: $ILLUSTRATE_COMPLETE/$TOTAL_CHAPTERS images"
echo ""

# Check if any images exist
IMAGE_COUNT=$(ls "$OUTPUT_DIR"/images/*.png 2>/dev/null | wc -l)
echo "Generated Images: $IMAGE_COUNT"
echo ""

# Show recent progress entries
echo "Recent Activity:"
echo "----------------"
tail -10 "$OUTPUT_DIR/progress.md" 2>/dev/null || echo "No progress log found"

echo ""
echo "To monitor live: watch -n 5 ./monitor-progress.sh"
