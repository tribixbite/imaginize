#!/bin/bash
# Test unified prompt with multiple free tier models

MODELS=(
  "kwaipilot/kat-coder-pro:free"
  "z-ai/glm-4.5-air:free"
  "tngtech/deepseek-r1t2-chimera:free"
)

TEST_BOOK="$HOME/storage/shared/Books/imaginize/test/allsystemsred.epub"
OUTPUT_DIR="$HOME/storage/shared/Books/imaginize/test"

echo "==================================================================="
echo "Testing Unified Prompt with Multiple Free Tier Models"
echo "==================================================================="
echo "Test Book: All Systems Red by Martha Wells"
echo "Test: Single chapter (Chapter One) with optimized prompt"
echo ""

for model in "${MODELS[@]}"; do
  echo "-------------------------------------------------------------------"
  echo "Testing Model: $model"
  echo "-------------------------------------------------------------------"

  # Clean previous test
  rm -rf "$OUTPUT_DIR/imaginize_allsystemsred"

  # Create config for this model
  cat > "$OUTPUT_DIR/.imaginize.config.json" << EOF
{
  "model": "$model",
  "apiKey": "$OPENROUTER_API_KEY",
  "baseUrl": "https://openrouter.ai/api/v1"
}
EOF

  echo "Running test (limit 1 chapter)..."
  cd "$OUTPUT_DIR" && node ~/git/illustrate/bin/imaginize.js allsystemsred.epub --text --limit 1 2>&1 | \
    grep -E "MODEL:|Chapter One|Found.*visual|Completed Chapter|Error" | head -20

  # Check results
  if [ -f "$OUTPUT_DIR/imaginize_allsystemsred/.imaginize.state.json" ]; then
    echo ""
    echo "Results from state file:"
    node -e "
      const state = JSON.parse(require('fs').readFileSync('$OUTPUT_DIR/imaginize_allsystemsred/.imaginize.state.json'));
      const ch5 = state.phases.analyze.chapters['5'];
      if (ch5) {
        console.log('Chapter 5 (Chapter One):');
        console.log('  Scenes: ' + (ch5.sceneConcepts?.length || 0));
        console.log('  Elements: ' + (ch5.elements?.length || 0));
        console.log('  Tokens: ' + (ch5.tokensUsed || 0));
      }
    "
  fi

  echo ""
  echo "Waiting 15 seconds before next model..."
  sleep 15
done

echo "==================================================================="
echo "Model Comparison Complete"
echo "==================================================================="
