#!/bin/bash
# Monitor extraction progress in real-time

LOG_FILE="extraction-openai.log"

echo "=== Extraction Progress Monitor ==="
echo "Started: $(date)"
echo ""

while true; do
    clear
    echo "=== Extraction Progress Monitor ==="
    echo "Time: $(date '+%H:%M:%S')"
    echo ""

    # Check if process is running
    if pgrep -f "imaginize.js.*--elements" > /dev/null; then
        echo "Status: ✅ Running (PID: $(pgrep -f 'imaginize.js.*--elements'))"
    else
        echo "Status: ⏹️  Stopped/Complete"
    fi

    echo ""

    # Get latest chapter progress
    LATEST_CHAPTER=$(tail -200 "$LOG_FILE" | grep -oE "[0-9]+/83 -" | tail -1)
    if [ -n "$LATEST_CHAPTER" ]; then
        CHAPTER_NUM=$(echo "$LATEST_CHAPTER" | cut -d'/' -f1)
        PERCENT=$((CHAPTER_NUM * 100 / 83))
        echo "📖 Progress: $LATEST_CHAPTER Extracting... ($PERCENT%)"
    fi

    # Get unique elements count
    ELEMENTS=$(tail -200 "$LOG_FILE" | grep -oE "Catalog now has [0-9]+ unique" | tail -1)
    if [ -n "$ELEMENTS" ]; then
        echo "📊 $ELEMENTS elements found"
    fi

    echo ""

    # Count rate limit errors
    RATE_LIMITS=$(grep -c "RateLimitError" "$LOG_FILE" 2>/dev/null || echo "0")
    echo "⚠️  Rate limit errors: $RATE_LIMITS"

    echo ""
    echo "--- Latest Activity (last 10 lines) ---"
    tail -10 "$LOG_FILE" | grep -E "(Extracting|Found|Error|Complete|Catalog)" || echo "(No recent activity)"

    echo ""
    echo "Press Ctrl+C to stop monitoring..."

    sleep 5
done
