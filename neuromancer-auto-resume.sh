#!/bin/bash

# Neuromancer Auto-Resume Script with Smart Rate Limit Handling
# This script will automatically wait for rate limits to reset and continue processing

EPUB_FILE="neuromancer.epub"
CONFIG_FILE=".imaginize.config.json"
LOG_FILE="neuromancer-auto-resume.log"
STATE_FILE="imaginize_neuromancer/.imaginize.state.json"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to wait for rate limit reset
wait_for_rate_limit() {
    local wait_minutes=${1:-3}
    log_warn "Rate limit hit. Waiting $wait_minutes minutes for reset..."

    local wait_seconds=$((wait_minutes * 60))
    local end_time=$(($(date +%s) + wait_seconds))

    while [ $(date +%s) -lt $end_time ]; do
        local remaining=$((end_time - $(date +%s)))
        local mins=$((remaining / 60))
        local secs=$((remaining % 60))
        printf "\r  Waiting... %02d:%02d remaining" $mins $secs
        sleep 10
    done

    echo ""  # New line after countdown
    log "Wait complete. Resuming..."
}

# Function to run extraction phase
run_extraction() {
    log "Starting extraction phase..."

    # Run extraction and capture output
    timeout 600 node bin/imaginize.js --file "$EPUB_FILE" --elements 2>&1 | tee -a "$LOG_FILE" | {
        local had_rate_limit=false

        while IFS= read -r line; do
            echo "$line"

            # Check for rate limit errors
            if echo "$line" | grep -q "RateLimitError: 429"; then
                had_rate_limit=true
            fi

            # Check for success
            if echo "$line" | grep -q "✨ Processing complete"; then
                return 0
            fi
        done

        # If we exit the loop and had rate limits, return special code
        if [ "$had_rate_limit" = true ]; then
            return 2  # Rate limit code
        fi

        return 1  # Generic error
    }

    return $?
}

# Function to check current progress
check_progress() {
    if [ ! -f "$STATE_FILE" ]; then
        echo "0/0"
        return
    fi

    # Extract progress from state file using grep and awk
    local extract_progress=$(cat "$STATE_FILE" | grep -A 5 '"extract"' | grep '"chaptersCompleted"' | awk -F':' '{print $2}' | tr -d ', ')
    local total_chapters=$(cat "$STATE_FILE" | grep '"totalChapters"' | head -1 | awk -F':' '{print $2}' | tr -d ', ')

    echo "${extract_progress:-0}/${total_chapters:-33}"
}

# Main loop
main() {
    log "=== Neuromancer Auto-Resume Script Started ==="
    log "Configuration: AI features disabled (smartElementMerging: false, aiDescriptionEnrichment: false)"
    log "This reduces API calls to avoid rate limits"
    echo ""

    local attempt=1
    local max_attempts=50  # Allow up to 50 attempts (enough to complete 33 chapters)

    while [ $attempt -le $max_attempts ]; do
        local progress=$(check_progress)
        log "Attempt #$attempt - Progress: $progress"

        # Run extraction
        run_extraction
        local exit_code=$?

        if [ $exit_code -eq 0 ]; then
            log "✅ Extraction completed successfully!"
            break
        elif [ $exit_code -eq 2 ]; then
            log_warn "Rate limit encountered. Waiting before retry..."
            wait_for_rate_limit 3  # Wait 3 minutes
            ((attempt++))
        else
            log_error "Extraction failed with error code $exit_code"
            log "Waiting 5 minutes before retry..."
            wait_for_rate_limit 5
            ((attempt++))
        fi

        echo ""
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "Max attempts ($max_attempts) reached. Please check the log for details."
        exit 1
    fi

    # Check final state
    local final_progress=$(check_progress)
    log "=== Final Progress: $final_progress ==="

    # If extraction is complete, offer to run illustration
    if grep -q '"extract".*"status":"completed"' "$STATE_FILE" 2>/dev/null; then
        log "✅ Extraction phase complete!"
        log ""
        log "Next steps:"
        log "  1. Generate illustrations: node bin/imaginize.js --file neuromancer.epub --images"
        log "  2. Compile all formats: node bin/imaginize.js --file neuromancer.epub --all-formats"
        log "  3. Or run both: node bin/imaginize.js --file neuromancer.epub --images --all-formats"
    fi
}

# Trap Ctrl+C for clean exit
trap 'echo ""; log "Script interrupted by user"; exit 130' INT

# Run main function
main
