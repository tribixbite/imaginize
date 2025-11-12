#!/bin/bash
while true; do
  clear
  echo "=== CONCURRENT PROCESSING TEST ==="
  echo "Started: $(date)"
  echo ""
  
  # Check if process is still running
  if ps -p $(cat concurrent_test.pid 2>/dev/null) > /dev/null 2>&1; then
    echo "Status: RUNNING ✓"
  else
    echo "Status: COMPLETED or STOPPED"
  fi
  
  echo ""
  echo "=== PROGRESS ==="
  
  # Count images
  img_count=$(ls imaginize_ImpossibleCreatures/*.png 2>/dev/null | wc -l)
  echo "Images generated: $img_count"
  
  # Check manifest if it exists
  if [ -f imaginize_ImpossibleCreatures/.imaginize.manifest.json ]; then
    echo ""
    echo "Manifest status:"
    jq -r '.elements_md_status, .analyze_complete, .illustrate_complete' imaginize_ImpossibleCreatures/.imaginize.manifest.json 2>/dev/null | \
      paste -d ' ' - - - | \
      awk '{print "  Elements.md: " $1 "\n  Analyze: " $2 "\n  Illustrate: " $3}'
    
    # Count chapter statuses
    echo ""
    echo "Chapter statuses:"
    jq -r '.chapters | to_entries[] | .value.status' imaginize_ImpossibleCreatures/.imaginize.manifest.json 2>/dev/null | \
      sort | uniq -c | awk '{print "  " $2 ": " $1}'
  fi
  
  # Show recent progress
  echo ""
  echo "=== RECENT ACTIVITY ==="
  tail -5 imaginize_ImpossibleCreatures/progress.md 2>/dev/null | grep -E "Pass |Found |Complete|Generating" | tail -3
  
  sleep 10
done
