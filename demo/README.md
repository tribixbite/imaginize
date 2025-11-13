# imaginize Demo

Browser-based demo application for trying imaginize without installation. Process EPUB and PDF files entirely in your browser using your own OpenAI API key.

**Live Demo**: [https://tribixbite.github.io/imaginize/](https://tribixbite.github.io/imaginize/)

## Features

- 📖 **EPUB & PDF Support**: Upload and process both EPUB and PDF files
- 🔑 **BYOK (Bring Your Own Key)**: Use your own OpenAI API key (stored locally)
- 🎨 **AI-Powered Analysis**: Automatic scene detection and image generation
- 🌙 **Dark Mode**: Full dark mode support with system preference detection
- 📱 **Mobile-Friendly**: Responsive design that works on all devices
- 🔒 **Privacy-First**: All processing happens in your browser
- ⚡ **Real-Time Progress**: Live updates during processing
- 📥 **Easy Downloads**: Download Chapters.md, Elements.md, and images

## How It Works

1. **Select Your Book**: Upload an EPUB or PDF file (max 10MB)
2. **Enter API Key**: Provide your OpenAI API key (stored securely in your browser)
3. **Start Processing**: Click "Start Processing" to begin
4. **Watch Progress**: Monitor real-time progress through parsing, analysis, and illustration
5. **Download Results**: Get your Chapters.md, Elements.md, and generated images

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 with dark mode
- **Parsing**: epub.js (EPUB) + pdf.js (PDF)
- **AI**: OpenAI GPT-4 + DALL-E 3
- **Deployment**: GitHub Pages

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Preview production build
npm run preview
```

## Testing

The demo includes a comprehensive test suite using Vitest and React Testing Library:

- **85 total tests** across 6 test files
- **100% passing** in CI/CD pipeline
- Tests run automatically before deployment
- Coverage includes:
  - **18 utility tests**: API key storage, localStorage synchronization, React hooks
  - **67 component tests**: FileUpload (10), APIKeyInput (12), ProcessingProgress (25), ResultsView (20)
  - File upload validation and drag-and-drop
  - API key security and persistence
  - Processing progress visualization
  - Results display and downloads

Run tests locally:
```bash
npm test                # Run all tests once
npm run test:watch      # Run tests in watch mode
npm run test:ui         # Open Vitest UI
```

Test files:
- `src/lib/storage.test.ts` - API key storage utilities (12 tests)
- `src/hooks/useLocalStorage.test.ts` - React hooks (6 tests)
- `src/components/APIKeyInput.test.tsx` - API key input component (12 tests)
- `src/components/FileUpload.test.tsx` - File upload component (10 tests)
- `src/components/ProcessingProgress.test.tsx` - Progress visualization (25 tests)
- `src/components/ResultsView.test.tsx` - Results display (20 tests)

## E2E Testing

The demo includes comprehensive end-to-end tests using Playwright:

- **68 E2E tests** across 8 test suites
- **340 browser test runs** (5 browsers × 68 tests)
- **Cross-browser testing**: Chrome, Firefox, Safari/WebKit
- **Mobile testing**: iPhone 12 and Pixel 5 viewports
- **Accessibility validation**: WCAG 2.1 AA compliance with @axe-core/playwright
- **CI/CD integration**: Automatic execution on PRs and deployment gate

Run E2E tests locally:
```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Open Playwright UI
npm run test:e2e:debug    # Debug mode with inspector
npm run test:e2e:headed   # Run with visible browser
npm run test:e2e:report   # View HTML test report
```

E2E test suites:
- `e2e/tests/01-initial-load.spec.ts` - Page load validation (8 tests)
- `e2e/tests/02-file-upload.spec.ts` - File upload functionality (9 tests)
- `e2e/tests/03-api-key-management.spec.ts` - API key security (8 tests)
- `e2e/tests/04-processing-flow.spec.ts` - Processing pipeline (10 tests)
- `e2e/tests/05-results-view.spec.ts` - Results and downloads (8 tests)
- `e2e/tests/06-error-scenarios.spec.ts` - Error handling & recovery (9 tests)
- `e2e/tests/07-mobile-responsive.spec.ts` - Mobile UX validation (8 tests)
- `e2e/tests/08-accessibility.spec.ts` - WCAG 2.1 AA compliance (8 tests)

**Note**: E2E tests require Playwright browsers which cannot be installed on Android/Termux. These tests are designed to run in CI/CD (GitHub Actions) on Linux runners.

See `e2e/README.md` for complete E2E testing documentation.

## API Key Security

Your OpenAI API key is stored in your browser's localStorage and **never sent to our servers**. You have two storage options:

- **Persistent**: Key saved in localStorage (persists across browser sessions)
- **Session Only**: Key saved in sessionStorage (cleared when browser closes)

### Recommendations

- Use a rate-limited API key for testing
- Never share your API key
- Clear your key after use with the "Forget Key" button

## Processing Pipeline

1. **Parsing**: Extract text and chapters from EPUB/PDF
2. **Analyzing**: Use GPT-4 to identify key scenes
3. **Illustrating**: Generate images with DALL-E 3
4. **Complete**: Download results

## Cost Estimation

Processing costs depend on book length and number of scenes:

- **Analysis**: ~$0.03 per 1,000 tokens (GPT-4)
- **Images**: ~$0.04 per image (DALL-E 3 standard quality)
- **Typical Book**: $2-5 for a short novel

The demo provides real-time cost estimates during processing.

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile**: Responsive design works on all modern mobile browsers

## Limitations

- **File Size**: Maximum 10MB per file
- **Processing Time**: Depends on book length (estimate shown during processing)
- **CORS**: Direct API calls may require browser CORS extensions (documented in errors)
- **Performance**: Large files may be slow on mobile devices

## Project Structure

```
demo/
├── src/
│   ├── components/        # React components
│   │   ├── FileUpload.tsx       # Drag-and-drop file picker
│   │   ├── APIKeyInput.tsx      # Secure API key input
│   │   ├── ProcessingProgress.tsx  # Progress visualization
│   │   └── ResultsView.tsx      # Results display
│   ├── lib/               # Core functionality
│   │   ├── epub-parser.ts       # EPUB parsing
│   │   ├── pdf-parser.ts        # PDF parsing
│   │   ├── book-parser.ts       # Unified book parser
│   │   ├── api-client.ts        # OpenAI API wrapper
│   │   ├── processor.ts         # Processing pipeline
│   │   └── storage.ts           # localStorage utilities
│   ├── hooks/             # React hooks
│   │   ├── useProcessing.ts     # Processing state management
│   │   └── useLocalStorage.ts   # localStorage hook
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── public/                # Static assets
├── dist/                  # Build output (GitHub Pages)
└── README.md              # This file
```

## Contributing

This demo is part of the [imaginize](https://github.com/tribixbite/imaginize) project. See the main repository for contribution guidelines.

## License

MIT License - see [LICENSE](../LICENSE) in the main repository.

## Support

- **Issues**: [GitHub Issues](https://github.com/tribixbite/imaginize/issues)
- **Documentation**: [Main Repository](https://github.com/tribixbite/imaginize)
- **OpenAI API**: [OpenAI Platform](https://platform.openai.com/)

## Privacy

- Your API key is stored only in your browser
- No data is sent to our servers
- All processing happens client-side
- We do not collect analytics or telemetry

---

Built with ❤️ using [imaginize](https://github.com/tribixbite/imaginize)
