#!/bin/bash
# Process All Systems Red with rate limit handling
# Uses direct Google API (60 requests/min) with delays between chapters

TEST_DIR="$HOME/storage/shared/Books/imaginize/test"
BOOK="allsystemsred.epub"

echo "=================================================="
echo "Processing All Systems Red with Google Gemini Free"
echo "=================================================="
echo ""
echo "Strategy: Process remaining chapters with 5s delay"
echo "Rate limit: Google Gemini ~60 req/min"
echo "Book: $BOOK"
echo ""

# Configure direct Google API
cat > "$TEST_DIR/.imaginize.config.json" << 'EOF'
{
  "model": "gemini-2.0-flash-exp",
  "apiKey": "AIzaSyDJ-S1TWlxbxkl_c0lR6Bs4V49MaEYBuZI",
  "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai/",
  "chapterDelay": 5000
}
EOF

echo "Configuration:"
cat "$TEST_DIR/.imaginize.config.json"
echo ""

# Check current progress
if [ -f "$TEST_DIR/imaginize_allsystemsred/.imaginize.state.json" ]; then
  echo "Current progress:"
  node -e "
    const state = JSON.parse(require('fs').readFileSync('$TEST_DIR/imaginize_allsystemsred/.imaginize.state.json'));
    const chapters = state.phases.analyze.chapters;
    const completed = Object.values(chapters).filter(c => c.sceneConcepts && c.sceneConcepts.length > 0).length;
    const total = Object.keys(chapters).length;
    console.log(\`Completed: \${completed}/\${total} chapters\`);
    console.log(\`Tokens used: \${state.tokensUsed || 0}\`);
  "
  echo ""
fi

# Run processing with auto-confirmation
echo "Starting processing..."
echo "This will take ~2-3 minutes for remaining chapters"
echo ""

cd "$TEST_DIR" && echo "y" | node ~/git/illustrate/bin/imaginize.js "$BOOK" --text 2>&1 | tee ~/allsystemsred-full.log

echo ""
echo "=================================================="
echo "Processing Complete"
echo "=================================================="
echo ""

# Show final results
if [ -f "$TEST_DIR/imaginize_allsystemsred/.imaginize.state.json" ]; then
  echo "Final Results:"
  node -e "
    const state = JSON.parse(require('fs').readFileSync('$TEST_DIR/imaginize_allsystemsred/.imaginize.state.json'));
    const chapters = state.phases.analyze.chapters;
    let successCount = 0;
    let sceneCount = 0;
    let elementCount = 0;

    for (const [id, data] of Object.entries(chapters)) {
      const scenes = data.sceneConcepts?.length || 0;
      const elements = data.elements?.length || 0;

      if (scenes > 0) successCount++;
      sceneCount += scenes;
      elementCount += elements;
    }

    console.log(\`Chapters with scenes: \${successCount}/18 (\${Math.round(successCount/18*100)}%)\`);
    console.log(\`Total scenes: \${sceneCount}\`);
    console.log(\`Total elements: \${elementCount}\`);
    console.log(\`Total tokens: \${state.tokensUsed || 0}\`);
  "
fi

echo ""
echo "Output directory: $TEST_DIR/imaginize_allsystemsred"
echo "Log file: ~/allsystemsred-full.log"
