# Dashboard Quick Reference Guide

**Version:** v2.6.0
**Last Updated:** 2025-11-12
**Target Audience:** Users, Contributors, Support Teams

---

## 🚀 Quick Start

### Start Dashboard
```bash
# Basic usage
npx imaginize --text --images --dashboard

# Custom port
npx imaginize --text --dashboard --dashboard-port 8080

# Network access (accessible from other devices on network)
npx imaginize --text --dashboard --dashboard-host 0.0.0.0 --dashboard-port 3000

# With concurrent processing (faster)
npx imaginize --concurrent --text --images --dashboard
```

### Open Dashboard
1. Start imaginize with `--dashboard` flag
2. Open browser to: **http://localhost:3000** (or your custom port)
3. Dashboard updates automatically as processing occurs

---

## 📊 Dashboard UI Overview

```
┌──────────────────────────────────────────────────────────┐
│  imaginize Dashboard                    ● Connected       │
├──────────────────────────────────────────────────────────┤
│  Overall Progress: ████████░░░░░░░░░░ 45%               │
│  ┌─────────┬─────────┬─────────┬─────────┐             │
│  │ Chapters│ Images  │ Phase   │ ETA     │             │
│  │ 12/83   │ 5/12    │ Analyze │ 2.5h    │             │
│  └─────────┴─────────┴─────────┴─────────┘             │
├──────────────────────────────────────────────────────────┤
│  Pipeline: [✓] Init → [●] Analyze → [ ] Extract → ...   │
├──────────────────────────────────────────────────────────┤
│  Chapter Grid: (10 columns on desktop)                   │
│  [✓1][✓2][✓3][●4][ 5][ 6][ 7][ 8][ 9][10]             │
│  [11][12][13][14][15][16][17][18][19][20] ...           │
├──────────────────────────────────────────────────────────┤
│  Real-time Logs:                                         │
│  ● 18:32:01 Starting chapter 4 analysis...              │
│  ✓ 18:31:52 Chapter 3 complete (15 concepts)            │
│  ⚠ 18:31:20 Rate limit hit, waiting 65s...              │
└──────────────────────────────────────────────────────────┘
```

---

## 🎨 Visual Elements

### Color Codes

**Chapter Status:**
- **Gray** - Pending (not started)
- **Blue** - Analyzed (text complete, ready for images)
- **Yellow** - Illustrating (generating images)
- **Green** - Complete (all work done)

**Log Levels:**
- **Blue** (ℹ) - Info message
- **Green** (✓) - Success message
- **Yellow** (⚠) - Warning message
- **Red** (✗) - Error message

**Connection Status:**
- **Green dot** - Connected to server
- **Red dot** - Disconnected, reconnecting...

### Pipeline Phases

1. **Initialize** - Parsing book, setting up state
2. **Analyze** - Extracting visual concepts from chapters
3. **Extract** - Identifying characters, places, items
4. **Illustrate** - Generating images with AI
5. **Complete** - All processing finished

---

## 🔧 Common Use Cases

### Use Case 1: Monitor Long-Running Process
```bash
# Start processing a large book
npx imaginize --concurrent --text --images --dashboard --file LargeBook.epub

# Open dashboard in browser
open http://localhost:3000

# Leave running, check progress periodically
# Dashboard auto-reconnects if browser tab is closed/reopened
```

### Use Case 2: Test With Limited Chapters
```bash
# Process just 3 chapters for testing
npx imaginize --concurrent --text --images --chapters 1-3 --dashboard --force

# Watch real-time progress in dashboard
# Verify chapter grid shows 3 chapters
# Check logs for any errors
```

### Use Case 3: Remote Monitoring
```bash
# On server (e.g., Termux, Linux server)
npx imaginize --text --images --dashboard --dashboard-host 0.0.0.0 --dashboard-port 3000

# On laptop/phone browser (replace with server IP)
open http://192.168.1.100:3000

# Monitor processing remotely
```

### Use Case 4: Multiple Sessions
```bash
# Terminal 1
npx imaginize --text --dashboard --dashboard-port 3001 --file Book1.epub

# Terminal 2
npx imaginize --text --dashboard --dashboard-port 3002 --file Book2.epub

# Open both dashboards:
# http://localhost:3001 - Book1 progress
# http://localhost:3002 - Book2 progress
```

---

## 🐛 Troubleshooting

### Dashboard Not Loading

**Symptom:** Browser shows "Cannot connect" or blank page

**Solutions:**
1. Verify imaginize is running with `--dashboard` flag
2. Check correct port (default: 3000)
3. Try different browser (Chrome 90+, Firefox 88+, Safari 14+)
4. Check if port is already in use: `lsof -i :3000` (Unix/Mac)
5. Try custom port: `--dashboard-port 3001`

### Connection Lost / Reconnecting

**Symptom:** Dashboard shows "Reconnecting (attempt X/10)"

**Solutions:**
1. **Normal behavior** - Dashboard auto-reconnects if connection drops
2. Check imaginize process is still running (`ps aux | grep imaginize`)
3. If process crashed, check `progress.md` for errors
4. Restart imaginize and dashboard will reconnect automatically
5. If all 10 attempts fail, reload browser page

### Empty Data / No Book Title

**Symptom:** Dashboard shows empty bookTitle or totalChapters = 0

**Solutions:**
1. This was fixed in v2.6.0 - update to latest version
2. If using older version, try `--force` flag to reinitialize
3. Check book file is valid EPUB/PDF
4. Restart with `--force --dashboard` flags

### Missing Chapter Updates

**Symptom:** Chapter grid doesn't update or shows all gray

**Solutions:**
1. Verify processing is actually running (check CPU usage)
2. Check if using correct phase flags (`--text`, `--images`)
3. Look at log stream - should show chapter progress
4. If using `--chapters`, verify selection includes chapters being processed
5. Try browser refresh (F5)

### Dashboard Shows Wrong Phase

**Symptom:** Pipeline stuck on "Initialize" or doesn't update

**Solutions:**
1. This was fixed in v2.6.0 - update to latest version
2. Check `progress.md` - if phases are progressing there, it's a dashboard bug
3. Try browser refresh (F5)
4. Check JavaScript console for errors (F12 → Console tab)

---

## 📱 Mobile Usage

### Mobile Browser Support
- **iOS Safari 14+:** ✅ Full support
- **Android Chrome 90+:** ✅ Full support
- **Mobile Firefox 88+:** ✅ Full support

### Mobile Layout
- Chapter grid: 4 columns (mobile), 6-8 (tablet), 10 (desktop)
- All components stack vertically on narrow screens
- Touch-friendly tap targets (44x44px minimum)
- Auto-scroll for log stream works on mobile

### Tips for Mobile
1. Use landscape orientation for better chapter grid view
2. Enable "Request Desktop Site" for desktop layout on tablet
3. Bookmark dashboard URL for quick access
4. Dashboard URL includes port, so bookmark full URL (http://192.168.1.100:3000)

---

## ⌨️ Keyboard Shortcuts

**Browser Standard:**
- `Ctrl/Cmd + R` - Refresh dashboard
- `Ctrl/Cmd + T` - New tab for multiple dashboards
- `Ctrl/Cmd + W` - Close tab (reconnects automatically when reopened)
- `F5` - Refresh page
- `F12` - Open developer tools (for debugging)

**Dashboard Specific:**
- No custom keyboard shortcuts in v2.6.0
- *(Future enhancement: keyboard navigation)*

---

## 🔍 Understanding Dashboard Data

### Progress Bar
- **Percentage:** (Completed chapters ÷ Total chapters) × 100
- Updates in real-time as chapters complete
- Green fill indicates progress

### Stats Grid
- **Chapters Processed:** X/Y format (completed/total)
- **Images Generated:** Count of images created so far
- **Current Phase:** Name of active phase (analyze, extract, illustrate, complete)
- **ETA:** Estimated time remaining (based on avg speed)

### Chapter Grid
- **Number:** Chapter number from EPUB/PDF
- **Color:** Status (pending/analyzed/illustrating/complete)
- **Layout:** Responsive grid (4-10 columns)
- **Order:** Left to right, top to bottom

### Log Stream
- **Latest First:** Newest logs at top (auto-scroll)
- **Timestamp:** HH:MM:SS format
- **Level:** Info/Success/Warning/Error
- **Message:** Processing status, errors, warnings

---

## 🔒 Security Considerations

### Local Development (Default)
- Dashboard binds to `localhost` by default
- Only accessible from same machine
- **Safe for local development**

### Network Access (`--dashboard-host 0.0.0.0`)
- Dashboard accessible from network
- No authentication/authorization in v2.6.0
- **Use on trusted networks only**
- Consider firewall rules to restrict access

### Production Use
**⚠️ WARNING:** Dashboard is designed for local/development use.

For production environments:
1. Use `localhost` only (default)
2. Or restrict network access with firewall
3. Consider SSH tunneling for remote access
4. Future versions may add authentication (v2.7.0+)

**SSH Tunnel Example:**
```bash
# On remote server
npx imaginize --text --images --dashboard

# On local machine (creates tunnel to remote server)
ssh -L 3000:localhost:3000 user@remote-server

# Open local browser to http://localhost:3000
# Securely access remote dashboard
```

---

## 📊 Performance & Resource Usage

### Dashboard Server
- **Memory:** ~15 MB additional
- **CPU:** Negligible (< 1%)
- **Network:** Local only, no external requests
- **Port:** 1 port (default 3000, configurable)

### Frontend Bundle
- **Size:** 67.85 kB gzipped (fast load)
- **Memory:** ~20 MB in browser
- **CPU:** Minimal (UI updates < 16ms)
- **Network:** WebSocket only (low bandwidth)

### Processing Impact
- **Impact on processing:** < 1% overhead
- **Does not slow down book processing**
- **Safe to use for large books**

---

## 🎯 Best Practices

### For Users
1. **Always use `--dashboard` for visual feedback** - easier than reading progress.md
2. **Bookmark dashboard URL** - quick access to http://localhost:3000
3. **Use custom ports for multiple books** - `--dashboard-port 3001`, `--dashboard-port 3002`
4. **Check logs first for errors** - log stream shows real-time issues
5. **Dashboard auto-reconnects** - safe to close/reopen browser

### For Contributors
1. **Test dashboard with every backend change** - use test-dashboard-integration.js
2. **Emit events at appropriate times** - follow progressTracker.emit() pattern
3. **Use consistent event data format** - follow types.ts definitions
4. **Update dashboard docs** - keep DASHBOARD_*.md files current
5. **Test browser compatibility** - Chrome, Firefox, Safari

### For Support Teams
1. **Ask for screenshot** - visual dashboard is easier to diagnose
2. **Check connection status** - green dot = connected, red = issue
3. **Look at log stream** - errors show in red with timestamps
4. **Verify version** - `npx imaginize@latest --version` (should be 2.6.0+)
5. **Check browser compatibility** - Chrome 90+, Firefox 88+, Safari 14+

---

## 📖 Reference Links

### Documentation
- **Architecture:** docs/DASHBOARD_ARCHITECTURE.md
- **Phase 1 (Backend):** docs/DASHBOARD_PHASE1_COMPLETE.md
- **Phase 2 (Frontend):** docs/DASHBOARD_PHASE2_COMPLETE.md
- **Phase 3 (Integration):** docs/DASHBOARD_PHASE3_COMPLETE.md
- **Phase 4 (Assessment):** docs/DASHBOARD_PHASE4_STATUS.md
- **Release Summary:** docs/RELEASE_v2.6.0_SUMMARY.md

### User Guides
- **README.md** - Main documentation with dashboard section
- **CHANGELOG.md** - Version history with v2.6.0 entry
- **PUBLISH_v2.6.0.md** - Publication guide (for maintainers)

### Code References
- **Backend Server:** src/lib/dashboard/server.ts:1
- **Progress Tracker:** src/lib/progress-tracker.ts:1
- **Event Types:** src/lib/dashboard/types.ts:1
- **CLI Integration:** src/index.ts:214-221 (dashboard startup)
- **Frontend App:** dashboard/src/App.tsx:1
- **WebSocket Hook:** dashboard/src/hooks/useWebSocket.ts:1

---

## 🆘 Getting Help

### Troubleshooting Steps
1. Check this Quick Reference first
2. Read log stream in dashboard for error details
3. Check progress.md file for detailed logs
4. Verify version: `npx imaginize@latest --version`
5. Try with `--force` flag to reset state

### Reporting Issues
When reporting dashboard issues, include:
1. **Version:** Output of `npx imaginize --version`
2. **Command Used:** Full command with all flags
3. **Browser:** Name and version (Chrome 95, Firefox 92, etc.)
4. **Screenshot:** Dashboard showing the issue
5. **Logs:** Relevant lines from progress.md or log stream
6. **Expected vs Actual:** What you expected vs what happened

**Issue Tracker:** https://github.com/tribixbite/imaginize/issues

### Community Support
- **GitHub Discussions:** https://github.com/tribixbite/imaginize/discussions
- **Issue Tracker:** https://github.com/tribixbite/imaginize/issues
- **Documentation:** https://github.com/tribixbite/imaginize#readme

---

## 🎓 Learning Resources

### For New Users
1. Read README.md Dashboard section
2. Try basic example: `npx imaginize --text --dashboard --chapters 1-3`
3. Watch dashboard update in real-time
4. Check DASHBOARD_PHASE3_COMPLETE.md for screenshots references

### For Contributors
1. Read DASHBOARD_ARCHITECTURE.md for complete design
2. Study Phase 1-3 completion docs for implementation details
3. Run test-dashboard-integration.js to understand flow
4. Review src/lib/dashboard/server.ts for backend code
5. Review dashboard/src/App.tsx for frontend code

### For Advanced Users
1. Study WebSocket protocol in DASHBOARD_ARCHITECTURE.md
2. Learn about EventEmitter pattern in progress-tracker.ts
3. Explore custom React hooks in useWebSocket.ts
4. Understand phase state machine in DASHBOARD_PHASE1_COMPLETE.md

---

## 🔄 Version History

**v2.6.0** (2025-11-12) - Initial dashboard release
- Real-time WebSocket updates
- 5 UI components
- 7 event types
- Responsive design
- Dark theme
- Automatic reconnection

**Future Versions:**
- v2.6.1 - Screenshots, enhanced error handling (planned)
- v2.7.0 - Session history, image gallery, authentication (planned)

---

**Last Updated:** 2025-11-12
**Maintainer:** imaginize Development Team
**License:** MIT
**Status:** Production-ready ✅
