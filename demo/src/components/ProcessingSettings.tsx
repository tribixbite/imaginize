/**
 * Processing settings component for configuring pipeline options
 * Dynamically adapts to available CLI capabilities
 */

import { useState } from 'react';
import type { ProcessingOptions } from '../types';
import {
  DEFAULT_OPTIONS,
  MODEL_PROVIDERS,
  IMAGE_SIZES,
  getModelsForProvider,
} from '../lib/pipeline-config';

interface ProcessingSettingsProps {
  options: Partial<ProcessingOptions>;
  onChange: (options: Partial<ProcessingOptions>) => void;
}

export function ProcessingSettings({ options, onChange }: ProcessingSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentOptions = { ...DEFAULT_OPTIONS, ...options };
  const provider = currentOptions.provider;

  const textModels = getModelsForProvider(provider, 'text');
  const imageModels = getModelsForProvider(provider, 'image');

  const handleChange = (key: keyof ProcessingOptions, value: unknown) => {
    onChange({ ...options, [key]: value });
  };

  const handleProviderChange = (newProvider: string) => {
    // Reset models when provider changes
    const newTextModels = getModelsForProvider(newProvider, 'text');
    const newImageModels = getModelsForProvider(newProvider, 'image');

    onChange({
      ...options,
      provider: newProvider,
      textModel: newTextModels[0]?.id || 'gpt-4o-mini',
      imageModel: newImageModels[0]?.id || 'dall-e-3',
    });
  };

  return (
    <div className="space-y-4">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Advanced Settings
      </button>

      {/* Settings Panel */}
      {isExpanded && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              AI Provider
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MODEL_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {provider === 'openrouter' && (
              <p className="text-xs text-green-600 dark:text-green-400">
                OpenRouter offers free models for testing
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Text Model
              </label>
              <select
                value={currentOptions.textModel}
                onChange={(e) => handleChange('textModel', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {textModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.costPer1kTokens === 0 ? '(Free)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Image Model
              </label>
              <select
                value={currentOptions.imageModel}
                onChange={(e) => handleChange('imageModel', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={imageModels.length === 0}
              >
                {imageModels.length > 0 ? (
                  imageModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))
                ) : (
                  <option value="">No image models available</option>
                )}
              </select>
            </div>
          </div>

          {/* Custom Endpoint (for custom provider) */}
          {provider === 'custom' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom Endpoint URL
              </label>
              <input
                type="url"
                value={currentOptions.baseUrl || ''}
                onChange={(e) => handleChange('baseUrl', e.target.value)}
                placeholder="https://your-api-endpoint.com/v1"
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Image Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Image Size
              </label>
              <select
                value={currentOptions.imageSize}
                onChange={(e) =>
                  handleChange('imageSize', e.target.value as ProcessingOptions['imageSize'])
                }
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {IMAGE_SIZES.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Image Quality
              </label>
              <select
                value={currentOptions.imageQuality}
                onChange={(e) =>
                  handleChange('imageQuality', e.target.value as ProcessingOptions['imageQuality'])
                }
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="standard">Standard</option>
                <option value="hd">HD (Higher cost)</option>
              </select>
            </div>
          </div>

          {/* Processing Phases */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Processing Phases
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={currentOptions.enableAnalysis}
                  onChange={(e) => handleChange('enableAnalysis', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Analyze chapters (identify scenes)
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={currentOptions.enableIllustration}
                  onChange={(e) => handleChange('enableIllustration', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Generate images for scenes
                </span>
              </label>
            </div>
          </div>

          {/* Error Handling */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Error Handling
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={currentOptions.skipFailed}
                onChange={(e) => handleChange('skipFailed', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Continue processing on errors
              </span>
            </label>
          </div>

          {/* Retry Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Max Retries
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={currentOptions.maxRetries}
                onChange={(e) => handleChange('maxRetries', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Pages per Image
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={currentOptions.pagesPerImage}
                onChange={(e) => handleChange('pagesPerImage', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Style Guide */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Style Guide (optional)
            </label>
            <textarea
              value={currentOptions.styleGuide || ''}
              onChange={(e) => handleChange('styleGuide', e.target.value || undefined)}
              placeholder="Describe the visual style for generated images (e.g., 'watercolor painting style, soft colors, fantasy aesthetic')"
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Cost Estimate Note */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> Costs depend on book length and number of scenes identified. A
              typical novel may cost $2-5 for analysis and $5-15 for images.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
