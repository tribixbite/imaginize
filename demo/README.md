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

- **18 unit tests** covering core utilities and hooks
- **100% passing** in CI/CD pipeline
- Tests run automatically before deployment
- Coverage includes:
  - API key storage and management
  - localStorage synchronization
  - React hooks functionality

Run tests locally:
```bash
npm test                # Run all tests once
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
npm run test:ui         # Open Vitest UI
```

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
