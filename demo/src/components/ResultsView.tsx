/**
 * Results view component for displaying and downloading processed book results
 */

import { useState } from 'react';
import type { ProcessingResult } from '../types';

interface ResultsViewProps {
  result: ProcessingResult;
  onReset: () => void;
}

export function ResultsView({ result, onReset }: ResultsViewProps) {
  const [selectedView, setSelectedView] = useState<'gallery' | 'chapters' | 'elements'>('gallery');

  const { chapters, elements, images, statistics } = result;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes} minutes${secs > 0 ? ` ${secs} seconds` : ''}`;
  };

  const downloadChaptersMd = () => {
    let content = '# Chapters\n\n';

    chapters.forEach((ch) => {
      content += `## Chapter ${ch.number}: ${ch.title}\n\n`;
      ch.scenes.forEach((scene) => {
        content += `### Scene ${scene.number}\n\n`;
        content += `${scene.description}\n\n`;
        if (scene.mood) content += `**Mood**: ${scene.mood}\n\n`;
        if (scene.lighting) content += `**Lighting**: ${scene.lighting}\n\n`;
      });
      content += '\n---\n\n';
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Chapters.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadElementsMd = () => {
    let content = '# Elements\n\n';

    if (elements.length > 0) {
      content += '## All Elements\n\n';
      elements.forEach((el) => {
        content += `### ${el.name}\n\n`;
        content += `**Type**: ${el.type}\n\n`;
        if (el.description) content += `${el.description}\n\n`;
        content += `**Appearances**: ${el.appearances.join(', ')}\n\n`;
        content += '---\n\n';
      });
    } else {
      content += 'No elements extracted.\n';
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Elements.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Processing Complete!</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Your book has been successfully processed</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{statistics.imagesGenerated}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Images</div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{statistics.chaptersProcessed}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Chapters</div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{formatTime(statistics.processingTime)}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Time</div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">${statistics.estimatedCost.toFixed(2)}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Estimated Cost</div>
        </div>
      </div>

      {/* Download Buttons */}
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={downloadChaptersMd}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Chapters.md
        </button>

        <button
          onClick={downloadElementsMd}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Elements.md
        </button>
      </div>

      {/* View Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setSelectedView('gallery')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              selectedView === 'gallery'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Gallery ({images.length})
          </button>
          <button
            onClick={() => setSelectedView('chapters')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              selectedView === 'chapters'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Chapters ({chapters.length})
          </button>
          <button
            onClick={() => setSelectedView('elements')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              selectedView === 'elements'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Elements ({elements.length})
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {/* Gallery View */}
        {selectedView === 'gallery' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((img, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                <img src={img.url} alt={`Chapter ${img.chapterNumber}, Scene ${img.sceneNumber}`} className="w-full h-64 object-cover" />
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Chapter {img.chapterNumber}, Scene {img.sceneNumber}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{img.prompt}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chapters View */}
        {selectedView === 'chapters' && (
          <div className="space-y-6">
            {chapters.map((ch) => (
              <div key={ch.number} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Chapter {ch.number}: {ch.title}
                </h3>
                <div className="space-y-4">
                  {ch.scenes.map((scene) => (
                    <div key={scene.number} className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">Scene {scene.number}</h4>
                      <p className="text-gray-700 dark:text-gray-300 mt-2">{scene.description}</p>
                      {scene.mood && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <span className="font-medium">Mood:</span> {scene.mood}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Elements View */}
        {selectedView === 'elements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {elements.length > 0 ? (
              elements.map((el, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">{el.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 capitalize">{el.type}</p>
                  {el.description && <p className="text-gray-700 dark:text-gray-300 mt-2">{el.description}</p>}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Appears in chapters: {el.appearances.join(', ')}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 col-span-2 text-center py-8">No elements extracted</p>
            )}
          </div>
        )}
      </div>

      {/* Start New Button */}
      <div className="flex justify-center pt-6">
        <button
          onClick={onReset}
          className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
        >
          Process Another Book
        </button>
      </div>
    </div>
  );
}
