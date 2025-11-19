/**
 * Main application component for imaginize demo
 */

import { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { APIKeyInput } from './components/APIKeyInput';
import { ProcessingProgress } from './components/ProcessingProgress';
import { ProcessingSettings } from './components/ProcessingSettings';
import { ResultsView } from './components/ResultsView';
import { useProcessing } from './hooks/useProcessing';
import type { BookFile, ProcessingOptions } from './types';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check for saved preference or system preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) {
        return saved === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [selectedFile, setSelectedFile] = useState<BookFile | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [processingOptions, setProcessingOptions] = useState<Partial<ProcessingOptions>>({});

  // Processing state
  const { state, result, activityLogs, error, startProcessing, cancelProcessing, reset, isProcessing } = useProcessing();

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');

    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Apply dark mode on mount
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleFileSelected = (file: BookFile) => {
    setSelectedFile(file);
    console.log('File selected:', file.name, file.type, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
  };

  const handleAPIKeyChange = (key: string | null) => {
    setApiKey(key);
    console.log('API key updated:', key ? 'Set' : 'Cleared');
  };

  const handleStartProcessing = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    if (!apiKey) {
      alert('Please enter your OpenAI API key');
      return;
    }

    console.log('Starting processing with:', {
      file: selectedFile.name,
      type: selectedFile.type,
      hasApiKey: !!apiKey,
      options: processingOptions,
    });

    // Start processing with options
    await startProcessing(selectedFile, apiKey, processingOptions);
  };

  const handleReset = () => {
    reset();
    setSelectedFile(null);
  };

  const canStartProcessing = selectedFile !== null && apiKey !== null && apiKey.trim().startsWith('sk-') && !isProcessing;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              imaginize Demo
            </h1>

            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-gray-900 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-900 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && state.phase === 'error' && (
          <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Processing Failed</h3>
            <p className="text-red-700 dark:text-red-300">{error.message}</p>
            <button
              onClick={handleReset}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Processing View */}
        {isProcessing && (
          <ProcessingProgress
            state={state}
            activityLogs={activityLogs}
            onCancel={cancelProcessing}
          />
        )}

        {/* Results View */}
        {state.phase === 'complete' && result && (
          <ResultsView result={result} onReset={handleReset} />
        )}

        {/* Landing Page */}
        {state.phase === 'idle' && (
          <div className="space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
              Try It Now
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Transform your ebook into an illustrated guide.{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">No installation required</span> • Runs in
              your browser
            </p>
          </div>

          {/* File Upload Section */}
          <section className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">1. Select Your Book</h3>
            <FileUpload onFileSelected={handleFileSelected} />

            {selectedFile && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✓ Selected: <span className="font-medium">{selectedFile.name}</span> (
                  {(selectedFile.size / 1024 / 1024).toFixed(2)}MB, {selectedFile.type.toUpperCase()})
                </p>
              </div>
            )}
          </section>

          {/* API Key Section */}
          <section className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">2. Enter Your API Key</h3>
            <APIKeyInput onKeyChange={handleAPIKeyChange} />
          </section>

          {/* Processing Settings Section */}
          <section className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">3. Configure Settings</h3>
            <ProcessingSettings
              options={processingOptions}
              onChange={setProcessingOptions}
            />
          </section>

          {/* Start Button */}
          <section className="flex justify-center pt-4">
            <button
              onClick={handleStartProcessing}
              disabled={!canStartProcessing}
              className={`
                px-8 py-4 rounded-lg font-semibold text-lg
                transition-all duration-200
                ${
                  canStartProcessing
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                }
              `}
            >
              Start Processing
            </button>
          </section>

          {/* Features Section */}
          <section className="pt-8 border-t border-gray-200 dark:border-gray-800">
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="text-3xl">🔒</div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Private & Secure</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  All processing happens in your browser. Your API key never leaves your device.
                </p>
              </div>

              <div className="text-center space-y-2">
                <div className="text-3xl">⚡</div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Fast & Easy</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No installation required. Just upload your book and let AI do the work.
                </p>
              </div>

              <div className="text-center space-y-2">
                <div className="text-3xl">🎨</div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Beautiful Results</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Generate stunning illustrations for your book's key scenes.
                </p>
              </div>
            </div>
          </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Built with{' '}
            <a
              href="https://github.com/tribixbite/imaginize"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              imaginize
            </a>
            . Powered by OpenAI.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
