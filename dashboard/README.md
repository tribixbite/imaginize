# imaginize Dashboard

Real-time web dashboard for monitoring book processing with live WebSocket updates.

## Overview

The imaginize dashboard provides real-time visualization of book processing progress, including:
- Overall progress percentage and statistics
- Visual 5-phase pipeline (Initialize → Analyze → Extract → Illustrate → Complete)
- Chapter grid with status indicators
- Live log stream with color-coded messages
- Connection status with automatic reconnection

**Latest Version:** v2.6.1 with enhanced accessibility, performance, and error handling

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Integration with imaginize CLI

The dashboard is automatically started when using the `--dashboard` flag:

```bash
# From imaginize root directory
npx imaginize --dashboard --file mybook.epub
```

The dashboard will be available at http://localhost:3000 by default.

## Architecture

### Frontend Stack

- **React 18** - UI framework with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool with hot module replacement
- **Tailwind CSS v4** - Utility-first CSS with dark theme
- **WebSocket API** - Real-time bidirectional communication

### Component Structure

```
src/
├── components/
│   ├── ErrorBoundary.tsx    # Error isolation and recovery
│   ├── Toast.tsx             # Toast notification component
│   ├── OverallProgress.tsx   # Progress bar and stats grid
│   ├── PipelineVisualization.tsx  # 5-phase pipeline flow
│   ├── ChapterGrid.tsx       # Responsive chapter status grid
│   └── LogStream.tsx         # Live log viewer with auto-scroll
├── contexts/
│   └── ToastContext.tsx      # Global toast management
├── hooks/
│   └── useWebSocket.ts       # WebSocket connection management
├── types.ts                  # TypeScript type definitions
├── App.tsx                   # Main application component
└── main.tsx                  # Application entry point
```

### WebSocket Protocol

The dashboard connects to the imaginize backend via WebSocket and listens for 7 event types:

1. **initial-state** - Complete initial state on connection
2. **progress** - Log messages (info, success, warning, error)
3. **stats** - Statistics updates (completed chapters, concepts, images)
4. **chapter-start** - Chapter processing started
5. **chapter-complete** - Chapter processing completed
6. **phase-start** - Phase transition (analyze, extract, illustrate, complete)
7. **image-complete** - Image generation completed

### REST API Endpoints

- `GET /api/state` - Current progress state (JSON)
- `GET /api/health` - Server health and connection count (JSON)

## Features

### Core Features (v2.6.0)

- **Real-Time Updates** - WebSocket-driven live updates
- **Visual Pipeline** - Animated 5-phase progress flow
- **Chapter Grid** - Responsive grid (4-10 columns) with status colors
- **Log Stream** - Scrolling log viewer with timestamps
- **Auto-Reconnection** - Exponential backoff (max 10 attempts, 2s delay)
- **ETA Calculation** - Intelligent time estimation
- **Responsive Design** - Mobile-first, works on all screen sizes

### Enhanced Features (v2.6.1)

- **Error Boundaries** - Component-level fault isolation prevents cascading failures
- **WCAG 2.1 AA Accessibility** - Full screen reader support, keyboard navigation, semantic HTML, ARIA attributes
- **Performance Optimization** - React.memo() and useMemo() reduce unnecessary re-renders
- **Toast Notifications** - Visual feedback for connection status changes with auto-dismiss

## Development

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn

### Project Structure

```
dashboard/
├── src/              # Source code
├── public/           # Static assets
├── dist/             # Production build output
├── index.html        # HTML entry point
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
├── vite.config.ts    # Vite build configuration
└── tailwind.config.js  # Tailwind CSS configuration
```

### Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production (TypeScript + Vite)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checker

### Build Configuration

**Vite Configuration** (vite.config.ts):
- React plugin with Fast Refresh
- Output directory: `../dist/dashboard/`
- Build target: ES2020
- Minification: esbuild
- Source maps: disabled in production

**TypeScript Configuration** (tsconfig.json):
- Target: ES2020
- Module: ESNext
- Strict mode enabled
- React JSX support

**Tailwind Configuration** (tailwind.config.js):
- Tailwind CSS v4
- Dark theme with custom colors
- Custom animations (pulse, slide-in)

## Accessibility

The dashboard is fully accessible and compliant with WCAG 2.1 Level AA standards:

### Semantic HTML
- Proper heading hierarchy with unique IDs
- `<section>`, `<header>`, `<nav>`, `<ol>`, `<time>` elements
- Logical document structure

### ARIA Attributes
- `aria-label` and `aria-labelledby` for all interactive elements
- `aria-live="polite"` regions for dynamic content
- `aria-hidden="true"` for decorative elements
- Proper roles: `progressbar`, `grid`, `gridcell`, `log`, `list`, `listitem`

### Keyboard Navigation
- `tabIndex={0}` for focusable elements
- Logical tab order through all components
- Visible focus indicators

### Screen Reader Support
- Tested with NVDA, JAWS (Windows), and VoiceOver (macOS)
- Live announcements for progress updates
- Descriptive labels for all UI elements

## Performance

### Optimization Techniques

1. **React.memo()** - All components wrapped to prevent unnecessary re-renders
2. **useMemo()** - Expensive computations memoized (array operations, calculations)
3. **Helper Functions** - Moved outside components to avoid recreation
4. **Circular Buffer** - Log limit (1000 entries) prevents memory leaks

### Bundle Size

- **JavaScript:** 211.58 kB (65.52 kB gzipped)
- **CSS:** 18.54 kB (4.55 kB gzipped)
- **Total (gzipped):** 70.07 kB

### Performance Metrics

- **Build Time:** ~5 seconds
- **HMR:** <100ms for component updates
- **Initial Load:** <1 second on broadband
- **WebSocket Latency:** <50ms for local connections

## Error Handling

### Error Boundaries

Each major component is wrapped with an ErrorBoundary to prevent cascading failures:

- **OverallProgress** - Fallback: "Unable to load progress overview"
- **PipelineVisualization** - Fallback: "Unable to load pipeline visualization"
- **ChapterGrid** - Fallback: "Unable to load chapter grid"
- **LogStream** - Fallback: "Unable to load log stream"

### Error Recovery Options

1. **Try Again** - Re-render the failed component
2. **Reload Page** - Full page refresh
3. **Error Details** - Expandable stack trace for debugging

### Production Error Logging

In production, errors are logged conditionally:
- Console logging disabled (use `import.meta.env.DEV` check)
- Integration with error tracking services (Sentry, LogRocket) recommended

## Testing

### Manual Testing

1. Start dashboard: `npm run dev`
2. In separate terminal, run imaginize: `npx imaginize --dashboard --file book.epub`
3. Open http://localhost:3000
4. Verify all components render correctly
5. Test connection status by stopping/starting imaginize process

### Integration Testing

From imaginize root directory:

```bash
# Backend test
node test-dashboard-backend.js

# Integration test
node test-dashboard-integration.js
```

### Accessibility Testing

Using screen readers:
- NVDA (Windows): Download from nvaccess.org
- JAWS (Windows): Free trial from freedomscientific.com
- VoiceOver (macOS): Built-in, enable in System Preferences

Using keyboard only:
- Tab through all components
- Verify focus indicators are visible
- Ensure all information is accessible via keyboard

## Deployment

### Production Build

```bash
npm run build
```

Output: `../dist/dashboard/` directory with:
- `index.html` - Entry point
- `assets/index-[hash].css` - Minified CSS
- `assets/index-[hash].js` - Minified JavaScript

### Serving the Dashboard

The dashboard is automatically served by the imaginize Express server when using `--dashboard` flag. No additional deployment steps required.

### Custom Deployment

To deploy separately:

1. Build the dashboard: `npm run build`
2. Copy `dist/dashboard/` to your web server
3. Configure reverse proxy to forward WebSocket connections
4. Set CORS headers if hosting on different domain

## Troubleshooting

### Dashboard won't connect

- Verify imaginize is running with `--dashboard` flag
- Check port is not in use: `lsof -i :3000`
- Verify firewall allows connections on dashboard port
- Check WebSocket URL in browser console

### Components not updating

- Check WebSocket connection status (green dot = connected)
- Verify imaginize process is actively processing chapters
- Check browser console for JavaScript errors
- Ensure dashboard and imaginize versions match

### Build errors

- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`
- Verify Node.js version: `node --version` (should be >=18.0.0)

## Contributing

### Code Style

- TypeScript strict mode required
- ESLint configuration provided
- Prettier for code formatting
- Component naming: PascalCase
- File naming: kebab-case for utilities, PascalCase for components

### Pull Request Guidelines

1. Run `npm run typecheck` (0 errors required)
2. Run `npm run lint` (no warnings)
3. Test accessibility with screen reader
4. Test performance with large books (100+ chapters)
5. Update documentation if adding features

## Version History

### v2.6.1 (2025-11-12)
- Added Error Boundaries for component fault isolation
- Implemented WCAG 2.1 Level AA accessibility
- Applied React memoization for performance
- Added Toast notifications for connection status

### v2.6.0 (2025-11-12)
- Initial dashboard release
- React 18 + TypeScript + Vite stack
- 5 main components with WebSocket updates
- Responsive design with Tailwind CSS v4

## License

MIT - See LICENSE file in root directory

## Support

- **Issues:** https://github.com/tribixbite/imaginize/issues
- **Documentation:** See main README.md and RELEASE_NOTES_v2.6.1.md
- **npm Package:** https://www.npmjs.com/package/imaginize
