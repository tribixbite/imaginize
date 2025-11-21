#!/bin/bash
# Retry Neuromancer processing after waiting for rate limits to reset

WAIT_HOURS=${1:-2}
WAIT_SECONDS=$((WAIT_HOURS * 3600))

echo "=== Neuromancer Retry Script ==="
echo ""
echo "Failed at: 2025-11-21 08:02 UTC (due to Gemini rate limits)"
echo "Current time: $(date -u '+%Y-%m-%d %H:%M UTC')"
echo ""
echo "Will wait $WAIT_HOURS hour(s) ($WAIT_SECONDS seconds) before retrying..."
echo ""
echo "Options:"
echo "  1. Wait and use Gemini free tier (current plan)"
echo "  2. Ctrl+C and set up paid API instead"
echo ""
echo "Starting countdown in 5 seconds... (Ctrl+C to cancel)"
sleep 5

echo ""
echo "Waiting $WAIT_HOURS hours for rate limits to reset..."
echo "Started: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "Will retry: $(date -d "+$WAIT_HOURS hours" '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# Wait with progress updates every 10 minutes
ELAPSED=0
UPDATE_INTERVAL=600  # 10 minutes

while [ $ELAPSED -lt $WAIT_SECONDS ]; do
    REMAINING=$((WAIT_SECONDS - ELAPSED))
    REMAINING_HOURS=$((REMAINING / 3600))
    REMAINING_MINS=$(((REMAINING % 3600) / 60))

    echo "[$(date '+%H:%M')] Waiting... ${REMAINING_HOURS}h ${REMAINING_MINS}m remaining"

    if [ $REMAINING -lt $UPDATE_INTERVAL ]; then
        sleep $REMAINING
        break
    else
        sleep $UPDATE_INTERVAL
        ELAPSED=$((ELAPSED + UPDATE_INTERVAL))
    fi
done

echo ""
echo "=== Wait complete! Retrying Neuromancer processing... ==="
echo ""

# Clean up old state and retry
rm -rf imaginize_neuromancer
node bin/imaginize.js --file neuromancer.epub 2>&1 | tee neuromancer-retry.log

echo ""
echo "=== Processing complete or failed ==="
echo "Check neuromancer-retry.log for details"
echo "Or run: ./monitor-neuromancer.sh"
