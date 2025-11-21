#!/bin/bash
# Monitor Neuromancer processing progress

echo "=== Neuromancer Processing Monitor ==="
echo ""

# Check if process is running
if pgrep -f "node bin/imaginize.*neuromancer" > /dev/null; then
    echo "✓ Process: RUNNING"
else
    echo "✗ Process: STOPPED"
fi

echo ""

# Count completed chapters
COMPLETED=$(grep -c "✅ Completed Chapter" imaginize_neuromancer/progress.md 2>/dev/null || echo "0")
PERCENT=$((COMPLETED * 100 / 33))
echo "Progress: $COMPLETED / 33 chapters ($PERCENT%)"

# Count visual concepts
CONCEPTS=$(grep "Completed Chapter" imaginize_neuromancer/progress.md 2>/dev/null | grep -o "Found [0-9]" | awk '{sum+=$2} END {print sum}')
echo "Visual concepts found: ${CONCEPTS:-0}"

echo ""
echo "Latest activity:"
tail -5 imaginize_neuromancer/progress.md 2>/dev/null | grep -E "(Starting|Completed|Rate)" || echo "No progress file yet"

echo ""
echo "---"
echo "Run: watch -n 10 ./monitor-neuromancer.sh"
