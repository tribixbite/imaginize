#!/bin/bash
echo "=== Extraction Progress Monitor ==="
echo "Timestamp: $(date)"
echo ""

if [ -f extraction.log ]; then
  echo "Latest extraction log (last 15 lines):"
  tail -15 extraction.log
  echo ""
fi

if [ -f imaginize_ImpossibleCreatures/Elements.md ]; then
  echo "✅ Elements.md created!"
  ls -lh imaginize_ImpossibleCreatures/Elements.md
else
  echo "⏳ Elements.md not created yet"
fi

echo ""
echo "Progress file status:"
tail -10 imaginize_ImpossibleCreatures/progress.md 2>/dev/null || echo "No progress updates"

echo ""
echo "Process status:"
ps aux | grep "imaginize.js --continue --elements" | grep -v grep || echo "No extraction process running"
