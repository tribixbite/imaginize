# GitHub Pages Demo Tool Specification

## Overview

A browser-based demo application deployed to GitHub Pages that allows users to try imaginize without installing anything. Users provide their own API keys (BYOK) and process books entirely in the browser.

**Status**: Specification Phase
**Estimated Effort**: 2-3 weeks for full implementation
**Priority**: Final checklist item (1/11 remaining)

---

## Requirements

### Functional Requirements

1. **Browser-Based Processing**
   - No server-side processing required
   - All computation happens in the browser
   - Works offline after initial load (except API calls)

2. **BYOK (Bring Your Own Key)**
   - Users provide their own OpenAI API keys
   - Keys stored securely in browser localStorage
   - Clear privacy notice (keys never sent to our servers)
   - Option to clear stored keys

3. **File Upload**
   - Support EPUB files
   - Support PDF files
   - Drag-and-drop interface
   - File validation (size limits, format checks)
   - Clear error messages

4. **Processing Pipeline**
   - Parse → Analyze → Extract → Illustrate
   - Real-time progress updates
   - Ability to pause/cancel processing
   - Download results (Chapters.md, Elements.md, images)

5. **Mobile-Friendly UI**
   - Responsive design (mobile, tablet, desktop)
   - Touch-friendly controls
   - Dark mode support
   - Accessibility (WCAG 2.1 AA)

6. **Testing**
   - Unit tests for core functionality
   - Integration tests for processing pipeline
   - E2E tests for user workflows
   - CI/CD integration

---

## Technical Architecture

### Frontend Stack

```
Technology Stack:
├── React 18 (UI framework)
├── TypeScript (type safety)
├── Vite (build tool)
├── Tailwind CSS v4 (styling with dark mode)
├── epub.js (EPUB parsing)
├── pdf.js (PDF parsing)
└── OpenAI SDK (browser build)
```

### Project Structure

```
demo/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── FileUpload.tsx          # Drag-and-drop file picker
│   │   ├── APIKeyInput.tsx         # BYOK API key input
│   │   ├── ProcessingProgress.tsx  # Progress visualization
│   │   ├── ResultsView.tsx         # Download results
│   │   └── MobileNav.tsx           # Mobile-friendly navigation
│   ├── lib/
│   │   ├── epub-parser.ts          # Client-side EPUB parsing
│   │   ├── pdf-parser.ts           # Client-side PDF parsing
│   │   ├── api-client.ts           # OpenAI API wrapper
│   │   ├── storage.ts              # localStorage management
│   │   └── processor.ts            # Main processing pipeline
│   ├── types/
│   │   └── index.ts                # TypeScript types
│   ├── hooks/
│   │   ├── useLocalStorage.ts      # localStorage hook
│   │   ├── useProcessing.ts        # Processing state hook
│   │   └── useFileUpload.ts        # File upload hook
│   ├── App.tsx                     # Main app component
│   └── main.tsx                    # Entry point
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Pages deployment
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## Implementation Phases

### Phase 1: Project Setup (Week 1, Days 1-2)
- [x] Create specification document
- [ ] Initialize Vite + React + TypeScript project
- [ ] Configure Tailwind CSS v4 with dark mode
- [ ] Set up ESLint and Prettier
- [ ] Create GitHub Actions workflow for deployment
- [ ] Set up test framework (Vitest)

### Phase 2: Core UI (Week 1, Days 3-5)
- [ ] File upload component with drag-and-drop
- [ ] API key input with secure storage
- [ ] Mobile-friendly layout
- [ ] Dark mode toggle
- [ ] Privacy notice and key management

### Phase 3: Client-Side Parsing (Week 2, Days 1-3)
- [ ] EPUB parsing with epub.js
- [ ] PDF parsing with pdf.js
- [ ] Text extraction and chapter detection
- [ ] Table of contents parsing
- [ ] Error handling for malformed files

### Phase 4: Processing Pipeline (Week 2, Days 4-5)
- [ ] API client with CORS handling
- [ ] Analyze phase (scene detection)
- [ ] Extract phase (elements extraction)
- [ ] Illustrate phase (image generation)
- [ ] Progress tracking and cancellation

### Phase 5: Results & Polish (Week 3, Days 1-3)
- [ ] Results download (ZIP file)
- [ ] Image gallery view
- [ ] Chapters.md and Elements.md preview
- [ ] Usage statistics and cost estimation
- [ ] Error recovery and retry logic

### Phase 6: Testing & Deployment (Week 3, Days 4-5)
- [ ] Unit tests for core functions
- [ ] Integration tests for pipeline
- [ ] E2E tests for user workflows
- [ ] GitHub Pages deployment
- [ ] Documentation and user guide

---

## Technical Challenges

### Challenge 1: CORS Issues
**Problem**: Direct API calls from browser to OpenAI may face CORS restrictions

**Solutions**:
1. Use OpenAI's CORS-enabled endpoints (if available)
2. Document workaround with browser extensions (CORS Everywhere)
3. Provide alternative: use local proxy server
4. Consider using Cloudflare Workers as proxy

**Recommendation**: Start with direct API calls, provide docs for CORS workarounds

### Challenge 2: Client-Side File Parsing
**Problem**: EPUB and PDF parsing in browser is resource-intensive

**Solutions**:
1. Use Web Workers for parsing to avoid blocking UI
2. Implement progressive loading (parse chunks)
3. Set file size limits (e.g., 10MB max)
4. Show parsing progress to user

**Recommendation**: Web Workers + progressive loading

### Challenge 3: API Key Security
**Problem**: API keys in browser localStorage are accessible to JavaScript

**Solutions**:
1. Clear warning in UI that keys are stored locally
2. Option to use session-only storage (cleared on close)
3. Privacy policy explaining no keys sent to our servers
4. Recommend using rate-limited API keys

**Recommendation**: localStorage with clear warnings + session option

### Challenge 4: Large Image Downloads
**Problem**: Generated images consume bandwidth and storage

**Solutions**:
1. Use lower resolution for demo (512x512 or 1024x1024)
2. Compress images before download
3. Option to generate subset of scenes
4. Stream images as they're generated (don't wait for all)

**Recommendation**: 1024x1024 default + progressive download

### Challenge 5: Mobile Performance
**Problem**: Processing on mobile devices may be slow

**Solutions**:
1. Detect device capabilities and warn users
2. Reduce concurrent API requests on mobile
3. Simplified UI for mobile (fewer animations)
4. Option to process in "background" tab

**Recommendation**: Device detection + adaptive concurrency

---

## User Interface Design

### Landing Page
```
┌─────────────────────────────────────────────────────────────┐
│  imaginize Demo - Try It Now                         🌙 Dark│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Transform your ebook into an illustrated guide              │
│  No installation required • Runs in your browser             │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📁  Drop your EPUB or PDF here                      │   │
│  │      or click to browse                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  🔑 API Key (stored locally, never shared)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  sk-...                                              │   │
│  └─────────────────────────────────────────────────────┘   │
│  [ ] Session only (cleared on close)                        │
│                                                               │
│  [Start Processing]                                          │
│                                                               │
│  ℹ️  Your API key is stored securely in your browser and    │
│      never sent to our servers. We recommend using a         │
│      rate-limited key for testing.                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Processing View
```
┌─────────────────────────────────────────────────────────────┐
│  Processing: my-book.epub                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Progress: 45%  [████████████░░░░░░░░░░░░]                 │
│                                                               │
│  ┌─ Parse ─ Analyze ─ Extract ─ Illustrate ─ Complete ─┐  │
│  │   ✓       ✓         ✓          ⟳                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Current: Generating images (12/25)                          │
│  Estimated time: 8 minutes remaining                         │
│                                                               │
│  📝 Recent Activity:                                         │
│  ✓ Analyzed Chapter 3: The Journey Begins                    │
│  ✓ Generated image for Scene 2                               │
│  ⟳ Generating image for Scene 3...                           │
│                                                               │
│  [Pause] [Cancel]                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Results View
```
┌─────────────────────────────────────────────────────────────┐
│  Results: my-book.epub                                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ Processing Complete!                                     │
│                                                               │
│  Generated:                                                   │
│  • 25 images across 5 chapters                               │
│  • Chapters.md with scene descriptions                       │
│  • Elements.md with character details                        │
│                                                               │
│  [Download All (ZIP)]  [View Gallery]  [Start New]          │
│                                                               │
│  📊 Statistics:                                              │
│  • Processing time: 15 minutes                               │
│  • API calls: 78                                             │
│  • Estimated cost: $2.45                                     │
│                                                               │
│  Gallery Preview:                                            │
│  ┌────┬────┬────┬────┐                                      │
│  │ 🖼️ │ 🖼️ │ 🖼️ │ 🖼️ │                                      │
│  ├────┼────┼────┼────┤                                      │
│  │ 🖼️ │ 🖼️ │ 🖼️ │ 🖼️ │                                      │
│  └────┴────┴────┴────┘                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

### API Key Storage
- Store in browser localStorage (encrypted if possible)
- Option for session-only storage (sessionStorage)
- Clear "Forget API Key" button
- Never log or transmit keys to analytics

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';
               connect-src 'self' https://api.openai.com;">
```

### Privacy Policy
- Clear statement: API keys never leave user's browser
- No analytics tracking of content
- Optional telemetry (page views only, no PII)
- GDPR compliant

---

## Deployment

### GitHub Pages Setup

1. **Repository Configuration**:
   - Enable GitHub Pages in repository settings
   - Source: GitHub Actions
   - Custom domain (optional): demo.imaginize.ai

2. **GitHub Actions Workflow**:
```yaml
# .github/workflows/deploy-demo.yml
name: Deploy Demo to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'demo/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: demo
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - uses: actions/upload-pages-artifact@v2
        with:
          path: demo/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v2
        id: deployment
```

3. **Base URL Configuration**:
```typescript
// vite.config.ts
export default defineConfig({
  base: '/imaginize/', // Repository name
  // ...
});
```

---

## Testing Strategy

### Unit Tests (Vitest)
- File parsers (EPUB, PDF)
- API client wrappers
- Storage utilities
- Processing pipeline functions

### Integration Tests
- End-to-end processing flow
- API key management
- File upload and validation
- Results generation

### E2E Tests (Playwright)
- User uploads file
- User enters API key
- Processing completes successfully
- User downloads results
- Mobile responsive design

### Manual Testing Checklist
- [ ] Upload EPUB file
- [ ] Upload PDF file
- [ ] Invalid file handling
- [ ] API key validation
- [ ] Process cancellation
- [ ] Mobile layout
- [ ] Dark mode
- [ ] Results download

---

## Success Criteria

### MVP (Minimum Viable Product)
1. ✅ Users can upload EPUB files
2. ✅ Users can provide API keys (BYOK)
3. ✅ Basic processing pipeline works
4. ✅ Users can download Chapters.md
5. ✅ Mobile-friendly UI
6. ✅ Deployed to GitHub Pages

### Full Feature Set
1. ✅ EPUB and PDF support
2. ✅ Complete processing pipeline
3. ✅ Image generation and download
4. ✅ Progress tracking and cancellation
5. ✅ Dark mode
6. ✅ Test coverage > 80%
7. ✅ WCAG 2.1 AA compliance

---

## Future Enhancements

### Version 2.0
- Style wizard integration (reference images in browser)
- Series support (upload multiple books)
- Export to graphic novel PDF
- Shareable result links (with user consent)

### Version 3.0
- Collaborative features (share processing with friends)
- Premium features (faster processing, higher quality)
- Integration marketplace (connect to other tools)
- Mobile app (React Native or PWA)

---

## Implementation Notes

### Quick Start (for developers)

```bash
# Create demo project
cd demo
npm create vite@latest . -- --template react-ts

# Install dependencies
npm install
npm install -D tailwindcss postcss autoprefixer
npm install epub.js pdfjs-dist openai

# Initialize Tailwind
npx tailwindcss init -p

# Start development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "epub.js": "^0.3.93",
    "pdfjs-dist": "^4.0.0",
    "openai": "^4.20.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "vitest": "^1.0.0",
    "playwright": "^1.40.0"
  }
}
```

---

## Timeline

### Week 1: Foundation
- Day 1-2: Project setup, Tailwind configuration
- Day 3-4: File upload and API key UI
- Day 5: Mobile layout and dark mode

### Week 2: Core Features
- Day 1-2: EPUB/PDF parsing
- Day 3-4: Processing pipeline
- Day 5: Image generation

### Week 3: Polish & Deploy
- Day 1-2: Results view and download
- Day 3: Testing and bug fixes
- Day 4: Documentation
- Day 5: GitHub Pages deployment

**Total Estimated Time**: 15 working days (3 weeks)

---

## References

- [epub.js Documentation](https://github.com/futurepress/epub.js/)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [GitHub Pages Deployment](https://docs.github.com/en/pages)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-13
**Status**: Specification Complete, Implementation Pending
