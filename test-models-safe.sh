#!/bin/bash
# Test unified prompt with multiple free tier models (rate-limit aware)

MODELS=(
  "kwaipilot/kat-coder-pro:free"
  "z-ai/glm-4.5-air:free"
  "tngtech/deepseek-r1t2-chimera:free"
)

TEST_BOOK="$HOME/storage/shared/Books/imaginize/test/allsystemsred.epub"
OUTPUT_DIR="$HOME/storage/shared/Books/imaginize/test"
RESULTS_FILE="$HOME/git/illustrate/model-comparison-results.md"

# Rate limit settings
WAIT_BETWEEN_MODELS=60  # 1 minute between models
WAIT_BETWEEN_CHAPTERS=5 # 5 seconds between chapters
MAX_RETRIES=3
RETRY_WAIT=30

echo "==================================================================="
echo "Testing Unified Prompt with Multiple Free Tier Models"
echo "==================================================================="
echo "Test Book: All Systems Red by Martha Wells"
echo "Strategy: Process ONE chapter per model to avoid rate limits"
echo "Wait time between models: ${WAIT_BETWEEN_MODELS}s"
echo ""

# Initialize results file
cat > "$RESULTS_FILE" << 'EOF'
# Model Comparison Results - Optimized Unified Prompt

**Test Date:** $(date +%Y-%m-%d)
**Test Book:** All Systems Red by Martha Wells
**Test Strategy:** Single chapter per model (Chapter One only)
**Objective:** Compare free tier model performance with optimized prompt

---

## Test Configuration

- **Optimized Prompt:** Few-shot example + structured sections
- **Wait between models:** 60 seconds
- **Retries on rate limit:** 3 attempts with 30s backoff
- **Chapter tested:** Chapter 5 (Chapter One - first story chapter)

---

## Results Summary

| Model | Scenes | Elements | Tokens | Status |
|-------|--------|----------|--------|--------|
EOF

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

  echo "Running test with retries..."

  retry_count=0
  success=false

  while [ $retry_count -lt $MAX_RETRIES ] && [ "$success" = false ]; do
    if [ $retry_count -gt 0 ]; then
      echo "Retry attempt $retry_count after ${RETRY_WAIT}s wait..."
      sleep $RETRY_WAIT
    fi

    # Run test, capturing output
    output=$(cd "$OUTPUT_DIR" && node ~/git/illustrate/bin/imaginize.js allsystemsred.epub --text --limit 1 2>&1)

    # Check for rate limit errors
    if echo "$output" | grep -q "RateLimitError"; then
      echo "⚠️  Rate limit hit, will retry..."
      retry_count=$((retry_count + 1))
    else
      success=true
      echo "✅ Test completed successfully"
    fi
  done

  # Extract and display results
  if [ -f "$OUTPUT_DIR/imaginize_allsystemsred/.imaginize.state.json" ]; then
    echo ""
    echo "Results from state file:"
    result=$(node -e "
      const state = JSON.parse(require('fs').readFileSync('$OUTPUT_DIR/imaginize_allsystemsred/.imaginize.state.json'));
      const ch5 = state.phases.analyze.chapters['5'];
      if (ch5) {
        const scenes = ch5.sceneConcepts?.length || 0;
        const elements = ch5.elements?.length || 0;
        const tokens = ch5.tokensUsed || 0;
        const status = scenes > 0 ? '✅ Success' : '⚠️ No scenes';
        console.log('RESULT|' + scenes + '|' + elements + '|' + tokens + '|' + status);
        console.log('  Scenes: ' + scenes);
        console.log('  Elements: ' + elements);
        console.log('  Tokens: ' + tokens);
        if (scenes > 0 && ch5.sceneConcepts[0]) {
          console.log('  Sample quote: ' + ch5.sceneConcepts[0].quote.substring(0, 80) + '...');
        }
      } else {
        console.log('RESULT|0|0|0|❌ Failed');
      }
    ")

    echo "$result"

    # Extract data for results table
    table_row=$(echo "$result" | grep "^RESULT|" | cut -d'|' -f2-)
    if [ -n "$table_row" ]; then
      scenes=$(echo "$table_row" | cut -d'|' -f1)
      elements=$(echo "$table_row" | cut -d'|' -f2)
      tokens=$(echo "$table_row" | cut -d'|' -f3)
      status=$(echo "$table_row" | cut -d'|' -f4)

      echo "| $model | $scenes | $elements | $tokens | $status |" >> "$RESULTS_FILE"
    fi
  else
    echo "❌ No state file generated"
    echo "| $model | 0 | 0 | 0 | ❌ Failed |" >> "$RESULTS_FILE"
  fi

  # Save detailed output for this model
  echo "$output" > "$HOME/git/illustrate/model-test-${model//\//-}.log"

  echo ""
  echo "Waiting ${WAIT_BETWEEN_MODELS}s before next model to avoid rate limits..."
  sleep $WAIT_BETWEEN_MODELS
done

# Finalize results file
cat >> "$RESULTS_FILE" << 'EOF'

---

## Detailed Analysis

EOF

# Add summary statistics
cat >> "$RESULTS_FILE" << 'EOF'

### Performance Comparison

Models ranked by combined scenes + elements extracted:

EOF

# Process logs and add details
for model in "${MODELS[@]}"; do
  log_file="$HOME/git/illustrate/model-test-${model//\//-}.log"
  if [ -f "$log_file" ]; then
    cat >> "$RESULTS_FILE" << EOF

#### $model

\`\`\`
$(grep -E "MODEL:|Chapter One|Found.*visual|Completed Chapter" "$log_file" | head -10)
\`\`\`

EOF
  fi
done

echo "==================================================================="
echo "Model Comparison Complete"
echo "==================================================================="
echo ""
echo "Results saved to: $RESULTS_FILE"
echo ""
cat "$RESULTS_FILE"
