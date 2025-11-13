/**
 * Tests for ResultsView component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsView } from './ResultsView';
import type { ProcessingResult, Chapter, Element, GeneratedImage, Scene } from '../types';

describe('ResultsView', () => {
  // Mock URL methods
  const mockCreateObjectURL = vi.fn(() => 'mock-url');
  const mockRevokeObjectURL = vi.fn();
  const originalURL = global.URL;

  beforeEach(() => {
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    global.URL = originalURL;
    vi.clearAllMocks();
  });

  const createScene = (overrides: Partial<Scene> = {}): Scene => ({
    number: 1,
    description: 'Test scene description',
    mood: 'tense',
    lighting: 'dim',
    ...overrides,
  });

  const createChapter = (overrides: Partial<Chapter> = {}): Chapter => ({
    number: 1,
    title: 'Test Chapter',
    scenes: [createScene()],
    ...overrides,
  });

  const createElement = (overrides: Partial<Element> = {}): Element => ({
    type: 'character',
    name: 'Test Character',
    description: 'A test character',
    appearances: [1, 2],
    ...overrides,
  });

  const createImage = (overrides: Partial<GeneratedImage> = {}): GeneratedImage => ({
    chapterNumber: 1,
    sceneNumber: 1,
    filename: 'test.png',
    url: 'https://example.com/test.png',
    prompt: 'Test prompt',
    ...overrides,
  });

  const createResult = (overrides: Partial<ProcessingResult> = {}): ProcessingResult => ({
    chapters: [createChapter()],
    elements: [createElement()],
    images: [createImage()],
    statistics: {
      processingTime: 120,
      apiCalls: 10,
      estimatedCost: 2.5,
      imagesGenerated: 5,
      chaptersProcessed: 3,
    },
    ...overrides,
  });

  it('should render success header', () => {
    const result = createResult();
    render(<ResultsView result={result} onReset={vi.fn()} />);

    expect(screen.getByText('🎉')).toBeInTheDocument();
    expect(screen.getByText('Processing Complete!')).toBeInTheDocument();
    expect(screen.getByText('Your book has been successfully processed')).toBeInTheDocument();
  });

  it('should display statistics cards with correct values', () => {
    const result = createResult({
      statistics: {
        processingTime: 150,
        apiCalls: 20,
        estimatedCost: 4.75,
        imagesGenerated: 8,
        chaptersProcessed: 5,
      },
    });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    // Check images count
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();

    // Check chapters count
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Chapters')).toBeInTheDocument();

    // Check processing time
    expect(screen.getByText('2 minutes 30 seconds')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();

    // Check estimated cost
    expect(screen.getByText('$4.75')).toBeInTheDocument();
    expect(screen.getByText('Estimated Cost')).toBeInTheDocument();
  });

  it('should format time correctly for less than 60 seconds', () => {
    const result = createResult({
      statistics: {
        processingTime: 45,
        apiCalls: 5,
        estimatedCost: 1.0,
        imagesGenerated: 2,
        chaptersProcessed: 1,
      },
    });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    expect(screen.getByText('45 seconds')).toBeInTheDocument();
  });

  it('should format time without seconds when evenly divisible by 60', () => {
    const result = createResult({
      statistics: {
        processingTime: 180,
        apiCalls: 10,
        estimatedCost: 2.0,
        imagesGenerated: 3,
        chaptersProcessed: 2,
      },
    });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    expect(screen.getByText('3 minutes')).toBeInTheDocument();
  });

  it('should display download buttons', () => {
    const result = createResult();
    render(<ResultsView result={result} onReset={vi.fn()} />);

    expect(screen.getByText('Download Chapters.md')).toBeInTheDocument();
    expect(screen.getByText('Download Elements.md')).toBeInTheDocument();
  });

  it('should download Chapters.md when button clicked', async () => {
    const user = userEvent.setup();
    const result = createResult();
    render(<ResultsView result={result} onReset={vi.fn()} />);

    const downloadButton = screen.getByText('Download Chapters.md');

    // Should not throw error when clicked
    await expect(user.click(downloadButton)).resolves.not.toThrow();
  });

  it('should download Elements.md when button clicked', async () => {
    const user = userEvent.setup();
    const result = createResult();
    render(<ResultsView result={result} onReset={vi.fn()} />);

    const downloadButton = screen.getByText('Download Elements.md');

    // Should not throw error when clicked
    await expect(user.click(downloadButton)).resolves.not.toThrow();
  });

  it('should display view tabs with counts', () => {
    const result = createResult({
      images: [createImage(), createImage(), createImage()],
      chapters: [createChapter(), createChapter()],
      elements: [createElement(), createElement(), createElement(), createElement()],
    });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    expect(screen.getByText('Gallery (3)')).toBeInTheDocument();
    expect(screen.getByText('Chapters (2)')).toBeInTheDocument();
    expect(screen.getByText('Elements (4)')).toBeInTheDocument();
  });

  it('should show gallery view by default', () => {
    const image = createImage({
      chapterNumber: 2,
      sceneNumber: 3,
      url: 'https://example.com/image.png',
      prompt: 'A beautiful scene',
    });
    const result = createResult({ images: [image] });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    // Should show image with alt text
    const img = screen.getByAltText('Chapter 2, Scene 3');
    expect(img).toHaveAttribute('src', 'https://example.com/image.png');
    expect(screen.getByText('Chapter 2, Scene 3')).toBeInTheDocument();
    expect(screen.getByText('A beautiful scene')).toBeInTheDocument();
  });

  it('should switch to chapters view when tab clicked', async () => {
    const user = userEvent.setup();
    const chapter = createChapter({
      number: 5,
      title: 'Final Chapter',
      scenes: [createScene({ number: 1, description: 'Final scene' })],
    });
    const result = createResult({ chapters: [chapter] });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    const chaptersTab = screen.getByText('Chapters (1)');
    await user.click(chaptersTab);

    expect(screen.getByText('Chapter 5: Final Chapter')).toBeInTheDocument();
    expect(screen.getByText('Scene 1')).toBeInTheDocument();
    expect(screen.getByText('Final scene')).toBeInTheDocument();
  });

  it('should display chapter scenes with mood information', async () => {
    const user = userEvent.setup();
    const chapter = createChapter({
      scenes: [
        createScene({ number: 1, description: 'Dark scene', mood: 'ominous' }),
        createScene({ number: 2, description: 'Happy scene', mood: undefined }),
      ],
    });
    const result = createResult({ chapters: [chapter] });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    const chaptersTab = screen.getByText('Chapters (1)');
    await user.click(chaptersTab);

    // First scene should show mood
    expect(screen.getByText('Dark scene')).toBeInTheDocument();
    expect(screen.getByText(/Mood:/)).toBeInTheDocument();
    expect(screen.getByText(/ominous/)).toBeInTheDocument();

    // Second scene should not show mood
    expect(screen.getByText('Happy scene')).toBeInTheDocument();
  });

  it('should switch to elements view when tab clicked', async () => {
    const user = userEvent.setup();
    const element = createElement({
      type: 'character',
      name: 'Hero',
      description: 'The main hero',
      appearances: [1, 2, 3],
    });
    const result = createResult({ elements: [element] });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    const elementsTab = screen.getByText('Elements (1)');
    await user.click(elementsTab);

    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByText('character')).toBeInTheDocument();
    expect(screen.getByText('The main hero')).toBeInTheDocument();
    expect(screen.getByText(/Appears in chapters: 1, 2, 3/)).toBeInTheDocument();
  });

  it('should show "No elements extracted" message when elements array is empty', async () => {
    const user = userEvent.setup();
    const result = createResult({ elements: [] });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    const elementsTab = screen.getByText('Elements (0)');
    await user.click(elementsTab);

    expect(screen.getByText('No elements extracted')).toBeInTheDocument();
  });

  it('should display multiple images in gallery view', () => {
    const images = [
      createImage({ chapterNumber: 1, sceneNumber: 1, url: 'https://example.com/img1.png', prompt: 'First image' }),
      createImage({ chapterNumber: 1, sceneNumber: 2, url: 'https://example.com/img2.png', prompt: 'Second image' }),
      createImage({ chapterNumber: 2, sceneNumber: 1, url: 'https://example.com/img3.png', prompt: 'Third image' }),
    ];
    const result = createResult({ images });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    expect(screen.getByAltText('Chapter 1, Scene 1')).toBeInTheDocument();
    expect(screen.getByAltText('Chapter 1, Scene 2')).toBeInTheDocument();
    expect(screen.getByAltText('Chapter 2, Scene 1')).toBeInTheDocument();
    expect(screen.getByText('First image')).toBeInTheDocument();
    expect(screen.getByText('Second image')).toBeInTheDocument();
    expect(screen.getByText('Third image')).toBeInTheDocument();
  });

  it('should display multiple chapters with their scenes', async () => {
    const user = userEvent.setup();
    const chapters = [
      createChapter({ number: 1, title: 'Beginning', scenes: [createScene({ number: 1 })] }),
      createChapter({ number: 2, title: 'Middle', scenes: [createScene({ number: 1 }), createScene({ number: 2 })] }),
      createChapter({ number: 3, title: 'End', scenes: [createScene({ number: 1 })] }),
    ];
    const result = createResult({ chapters });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    const chaptersTab = screen.getByText('Chapters (3)');
    await user.click(chaptersTab);

    expect(screen.getByText('Chapter 1: Beginning')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2: Middle')).toBeInTheDocument();
    expect(screen.getByText('Chapter 3: End')).toBeInTheDocument();
  });

  it('should display multiple elements of different types', async () => {
    const user = userEvent.setup();
    const elements = [
      createElement({ type: 'character', name: 'Alice', appearances: [1] }),
      createElement({ type: 'place', name: 'Forest', appearances: [2] }),
      createElement({ type: 'object', name: 'Sword', appearances: [3] }),
    ];
    const result = createResult({ elements });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    const elementsTab = screen.getByText('Elements (3)');
    await user.click(elementsTab);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Forest')).toBeInTheDocument();
    expect(screen.getByText('Sword')).toBeInTheDocument();
  });

  it('should call onReset when "Process Another Book" button clicked', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const result = createResult();
    render(<ResultsView result={result} onReset={onReset} />);

    const resetButton = screen.getByText('Process Another Book');
    await user.click(resetButton);

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('should highlight active tab with correct styling', async () => {
    const user = userEvent.setup();
    const result = createResult();
    const { container } = render(<ResultsView result={result} onReset={vi.fn()} />);

    // Gallery tab should be active by default
    const galleryTab = screen.getByText('Gallery (1)');
    expect(galleryTab).toHaveClass('border-blue-500');

    // Click chapters tab
    const chaptersTab = screen.getByText('Chapters (1)');
    await user.click(chaptersTab);

    // Chapters tab should now be active
    expect(chaptersTab).toHaveClass('border-blue-500');
  });

  it('should display element without description', async () => {
    const user = userEvent.setup();
    const element = createElement({
      name: 'Mystery Object',
      description: '',
      appearances: [5],
    });
    const result = createResult({ elements: [element] });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    const elementsTab = screen.getByText('Elements (1)');
    await user.click(elementsTab);

    expect(screen.getByText('Mystery Object')).toBeInTheDocument();
    expect(screen.getByText(/Appears in chapters: 5/)).toBeInTheDocument();
  });

  it('should handle empty image prompt gracefully', () => {
    const image = createImage({ prompt: '' });
    const result = createResult({ images: [image] });
    render(<ResultsView result={result} onReset={vi.fn()} />);

    // Image should still render even with empty prompt
    expect(screen.getByAltText('Chapter 1, Scene 1')).toBeInTheDocument();
  });
});
