/**
 * API key input component with secure storage and privacy controls
 */

import { useState, useEffect, type ChangeEvent } from 'react';
import { saveAPIKey, loadAPIKey, clearAPIKey } from '../lib/storage';

interface APIKeyInputProps {
  onKeyChange: (key: string | null) => void;
  disabled?: boolean;
}

export function APIKeyInput({ onKeyChange, disabled = false }: APIKeyInputProps) {
  const [apiKey, setApiKey] = useState('');
  const [sessionOnly, setSessionOnly] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);

  // Load API key on mount
  useEffect(() => {
    const config = loadAPIKey();
    if (config) {
      setApiKey(config.key);
      setSessionOnly(config.sessionOnly);
      setHasStoredKey(true);
      onKeyChange(config.key);
    } else {
      setHasStoredKey(false);
    }
  }, []);

  const handleKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);

    if (newKey.trim()) {
      saveAPIKey(newKey, sessionOnly);
      setHasStoredKey(true);
      onKeyChange(newKey);
    } else {
      clearAPIKey();
      setHasStoredKey(false);
      onKeyChange(null);
    }
  };

  const handleSessionOnlyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newSessionOnly = e.target.checked;
    setSessionOnly(newSessionOnly);

    if (apiKey.trim()) {
      saveAPIKey(apiKey, newSessionOnly);
    }
  };

  const handleForgetKey = () => {
    clearAPIKey();
    setApiKey('');
    setHasStoredKey(false);
    onKeyChange(null);
  };

  const isValidKey = apiKey.trim().startsWith('sk-');

  return (
    <div className="w-full space-y-4">
      <div>
        <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          🔑 OpenAI API Key
        </label>

        <div className="relative">
          <input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={handleKeyChange}
            disabled={disabled}
            placeholder="sk-..."
            className={`
              w-full px-4 py-3 pr-12 rounded-lg border
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors
              ${disabled
                ? 'opacity-50 cursor-not-allowed border-gray-300 dark:border-gray-700'
                : isValidKey
                  ? 'border-green-500 dark:border-green-600'
                  : apiKey.trim()
                    ? 'border-red-500 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600'
              }
            `}
          />

          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            disabled={disabled}
          >
            {showKey ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>

        {apiKey.trim() && !isValidKey && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            API key should start with "sk-"
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sessionOnly}
            onChange={handleSessionOnlyChange}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Session only (cleared on close)
          </span>
        </label>

        {hasStoredKey && (
          <button
            type="button"
            onClick={handleForgetKey}
            disabled={disabled}
            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
          >
            Forget Key
          </button>
        )}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <span className="font-medium">ℹ️ Privacy Notice:</span> Your API key is stored securely in your browser and{' '}
          <span className="font-semibold">never sent to our servers</span>. We recommend using a rate-limited key for
          testing. Learn more about{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-600 dark:hover:text-blue-300"
          >
            OpenAI API keys
          </a>
          .
        </p>
      </div>
    </div>
  );
}
