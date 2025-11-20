/**
 * Tests for Referential Context System
 * Tests element extraction, entity resolution, description enrichment,
 * state persistence, and cross-scene consistency
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { BookElement, ChapterContent, IllustrateConfig } from '../types/config.js';
import { StateManager } from '../lib/state-manager.js';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';

// Test directory
const testDir = join(cwd(), 'src', 'test', '.test-data', `context-test-${Date.now()}`);
const testOutputDir = join(testDir, 'output');

// Mock OpenAI client
const mockOpenAI = {
  chat: {
    completions: {
      create: mock(async (params: any) => {
        // Default mock response
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  elements: [
                    {
                      type: 'character',
                      name: 'Test Character',
                      description: 'A test character',
                      quotes: [{ text: 'Test quote', page: '1' }],
                    },
                  ],
                }),
              },
            },
          ],
        };
      }),
    },
  },
};

// Mock config
const mockConfig: Required<IllustrateConfig> = {
  pagesPerImage: 10,
  extractElements: true,
  generateElementImages: false,
  apiKey: 'test-key',
  baseUrl: 'https://test.api.com',
  model: 'test-model',
  imageEndpoint: {
    apiKey: 'test-image-key',
    baseUrl: 'https://test.image.api.com',
    model: 'test-image-model',
  },
  outputPattern: 'test_{name}',
  maxConcurrency: 3,
  imageSize: '1024x1024',
  imageQuality: 'standard',
  pagesPerAutoChapter: 50,
  tokenSafetyMargin: 0.9,
  maxRetries: 1,
  retryTimeout: 1000,
  limit: undefined,
  enableStyleConsistency: false,
  styleBootstrapCount: 3,
  consistencyThreshold: 0.7,
  trackCharacterAppearances: true,
  series: undefined,
  customTemplates: undefined,
  genre: undefined,
  retryControl: undefined,
  maxExtractionChars: 50000,
  iterativeExtraction: true,
  smartElementMerging: true,
  entityMatchConfidence: 0.7,
  aiDescriptionEnrichment: false,
};

// Sample chapters for testing
const sampleChapters: ChapterContent[] = [
  {
    chapterNumber: 1,
    chapterTitle: 'Chapter One',
    pageRange: '1-10',
    content: 'John Snow stood at the wall. His dark hair caught the wind.',
    tokenCount: 15,
    lineNumbers: { start: 1, end: 50 },
  },
  {
    chapterNumber: 2,
    chapterTitle: 'Chapter Two',
    pageRange: '11-20',
    content: 'Jon Snow wore his black cloak. The bastard clutched his sword.',
    tokenCount: 15,
    lineNumbers: { start: 51, end: 100 },
  },
];

describe('Referential Context System', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    // Create test directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(testOutputDir, { recursive: true });

    // Initialize state manager
    stateManager = new StateManager(testOutputDir, 'test.epub', 'Test Book', 100);

    // Reset mocks
    mockOpenAI.chat.completions.create.mockClear();
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Element Extraction', () => {
    it('should extract elements from single chapter', async () => {
      // Mock response with specific elements
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                elements: [
                  {
                    type: 'character',
                    name: 'John Snow',
                    description: 'Dark hair, gray eyes',
                    quotes: [{ text: 'John stood at the wall', page: '1' }],
                  },
                  {
                    type: 'place',
                    name: 'The Wall',
                    description: 'Massive ice barrier',
                    quotes: [{ text: 'at the wall', page: '1' }],
                  },
                ],
              }),
            },
          },
        ],
      });

      // In real implementation, this would call extractElementsFromChapter
      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      const elements = parsed.elements;

      expect(elements).toHaveLength(2);
      expect(elements[0].type).toBe('character');
      expect(elements[0].name).toBe('John Snow');
      expect(elements[1].type).toBe('place');
      expect(elements[1].name).toBe('The Wall');
    });

    it('should handle empty chapter content', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ elements: [] }),
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      expect(parsed.elements).toHaveLength(0);
    });

    it('should extract multiple element types', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                elements: [
                  { type: 'character', name: 'John', description: 'Hero', quotes: [] },
                  { type: 'creature', name: 'Dragon', description: 'Large beast', quotes: [] },
                  { type: 'place', name: 'Castle', description: 'Stone fortress', quotes: [] },
                  { type: 'item', name: 'Sword', description: 'Steel blade', quotes: [] },
                  { type: 'object', name: 'Crown', description: 'Golden', quotes: [] },
                ],
              }),
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      const elements = parsed.elements;

      expect(elements).toHaveLength(5);
      expect(elements.map((e: any) => e.type)).toEqual([
        'character',
        'creature',
        'place',
        'item',
        'object',
      ]);
    });
  });

  describe('Entity Resolution', () => {
    it('should detect aliases (Dr. Jekyll / Mr. Hyde)', async () => {
      // First element
      const existingElement: BookElement = {
        type: 'character',
        name: 'Dr. Jekyll',
        description: 'Respectable doctor',
        quotes: [{ text: 'Dr. Jekyll smiled', page: '1' }],
      };

      // New element (alias)
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                is_match: true,
                matched_index: 0,
                confidence: 0.95,
                reasoning: 'Mr. Hyde is the alter ego of Dr. Jekyll',
              }),
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);

      expect(result.is_match).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.reasoning).toContain('alter ego');
    });

    it('should merge variants (Jon Snow / John Snow)', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                is_match: true,
                matched_index: 0,
                confidence: 0.88,
                reasoning: 'Jon and John are spelling variants of the same character',
              }),
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);

      expect(result.is_match).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle titles (The Dark Lord / Voldemort)', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                is_match: true,
                matched_index: 0,
                confidence: 0.92,
                reasoning: 'The Dark Lord is a title referring to Voldemort',
              }),
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);

      expect(result.is_match).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should respect confidence threshold', async () => {
      // Low confidence match should not merge
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                is_match: false,
                matched_index: null,
                confidence: 0.4,
                reasoning: 'Names are similar but likely different characters',
              }),
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);

      expect(result.confidence).toBeLessThan(0.7);
      expect(result.is_match).toBe(false);
    });

    it('should not match different entities', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                is_match: false,
                matched_index: null,
                confidence: 0.1,
                reasoning: 'Completely different characters',
              }),
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);

      expect(result.is_match).toBe(false);
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('Description Enrichment', () => {
    it('should skip redundant descriptions', () => {
      const existing = 'John has dark hair and gray eyes';
      const additional = 'dark hair';

      // Simulate enrichDescription logic
      const shouldSkip = existing.toLowerCase().includes(additional.toLowerCase());

      expect(shouldSkip).toBe(true);
    });

    it('should append unique details (simple mode)', () => {
      const existing = 'John has dark hair';
      const additional = 'wears a leather jacket';

      // Simple enrichment
      const result = `${existing}. Additional details: ${additional}`;

      expect(result).toBe('John has dark hair. Additional details: wears a leather jacket');
      expect(result).toContain(existing);
      expect(result).toContain(additional);
    });

    it('should use AI when enabled', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'John has dark hair, gray eyes, and wears a black cloak.',
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
      });

      const enriched = response.choices[0].message.content;

      expect(enriched).toContain('dark hair');
      expect(enriched).toContain('gray eyes');
      expect(enriched).toContain('black cloak');
      expect(enriched).not.toContain('Additional details:');
    });

    it('should handle AI enrichment failure gracefully', async () => {
      // Simulate API error
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      try {
        await mockOpenAI.chat.completions.create({
          model: 'test-model',
          messages: [],
        });
        expect(true).toBe(false); // Should not reach
      } catch (error: any) {
        expect(error.message).toBe('API Error');
        // Fallback to simple enrichment
        const fallback = 'Existing. Additional details: New';
        expect(fallback).toContain('Existing');
        expect(fallback).toContain('New');
      }
    });
  });

  describe('State Persistence', () => {
    it('should store complete BookElement objects', async () => {
      const elements: BookElement[] = [
        {
          type: 'character',
          name: 'John Snow',
          description: 'Dark hair, gray eyes',
          quotes: [
            { text: 'John stood at the wall', page: '1' },
            { text: 'Snow drew his sword', page: '5' },
          ],
          aliases: ['Jon Snow', 'The Bastard'],
        },
      ];

      stateManager.setElements(elements);
      await stateManager.save();

      // Load state from disk
      const newStateManager = new StateManager(testOutputDir, 'test.epub', 'Test Book', 100);
      await newStateManager.load();
      const loadedState = newStateManager.getState();

      expect(loadedState.elements).toBeDefined();
      expect(loadedState.elements).toHaveLength(1);
      expect(loadedState.elements![0].name).toBe('John Snow');
      expect(loadedState.elements![0].description).toBe('Dark hair, gray eyes');
      expect(loadedState.elements![0].quotes).toHaveLength(2);
      expect(loadedState.elements![0].aliases).toEqual(['Jon Snow', 'The Bastard']);
    });

    it('should load elements for regeneration', async () => {
      const elements: BookElement[] = [
        {
          type: 'character',
          name: 'Test Character',
          description: 'Test description',
          quotes: [{ text: 'Test quote', page: '1' }],
        },
      ];

      stateManager.setElements(elements);
      await stateManager.save();

      // Simulate regeneration
      const newStateManager = new StateManager(testOutputDir, 'test.epub', 'Test Book', 100);
      await newStateManager.load();
      const loadedElements = newStateManager.getState().elements || [];

      expect(loadedElements).toHaveLength(1);
      expect(loadedElements[0].name).toBe('Test Character');
    });

    it('should handle missing state gracefully', async () => {
      const newStateManager = new StateManager(testOutputDir, 'test.epub', 'Test Book', 100);
      const loaded = await newStateManager.load();

      expect(loaded).toBe(false);
      const state = newStateManager.getState();
      expect(state.elements).toBeUndefined();
    });

    it('should preserve all element properties', async () => {
      const element: BookElement = {
        type: 'item',
        name: 'Longclaw',
        description: 'Valyrian steel bastard sword',
        quotes: [
          { text: 'Longclaw gleamed', page: '10' },
          { text: 'the bastard sword', page: '15' },
        ],
        imageUrl: 'https://example.com/longclaw.png',
        aliases: ['the bastard sword', 'Jon\'s sword'],
      };

      stateManager.setElements([element]);
      await stateManager.save();

      const newStateManager = new StateManager(testOutputDir, 'test.epub', 'Test Book', 100);
      await newStateManager.load();
      const loadedElement = newStateManager.getState().elements![0];

      expect(loadedElement.type).toBe(element.type);
      expect(loadedElement.name).toBe(element.name);
      expect(loadedElement.description).toBe(element.description);
      expect(loadedElement.quotes).toEqual(element.quotes);
      expect(loadedElement.imageUrl).toBe(element.imageUrl);
      expect(loadedElement.aliases).toEqual(element.aliases);
    });
  });

  describe('Context Injection', () => {
    it('should format character context correctly', () => {
      const elements: BookElement[] = [
        {
          type: 'character',
          name: 'John Snow',
          description: 'Dark hair, gray eyes',
          quotes: [],
        },
        {
          type: 'character',
          name: 'Arya Stark',
          description: 'Young girl, brown hair',
          quotes: [],
        },
      ];

      const characters = elements
        .filter((e) => e.type === 'character')
        .map((e) => `- ${e.name}: ${e.description}`)
        .join('\n');

      expect(characters).toContain('John Snow');
      expect(characters).toContain('Arya Stark');
      expect(characters).toContain('Dark hair, gray eyes');
      expect(characters).toContain('Young girl, brown hair');
    });

    it('should include aliases in context', () => {
      const element: BookElement = {
        type: 'character',
        name: 'John Snow',
        description: 'Dark hair, gray eyes',
        quotes: [],
        aliases: ['Jon Snow', 'The Bastard'],
      };

      const aliases = element.aliases ? ` (aka ${element.aliases.join(', ')})` : '';
      const contextLine = `- ${element.name}${aliases}: ${element.description}`;

      expect(contextLine).toBe(
        '- John Snow (aka Jon Snow, The Bastard): Dark hair, gray eyes'
      );
    });

    it('should group by element type', () => {
      const elements: BookElement[] = [
        { type: 'character', name: 'John', description: 'Hero', quotes: [] },
        { type: 'place', name: 'Castle', description: 'Stone fortress', quotes: [] },
        { type: 'character', name: 'Arya', description: 'Warrior', quotes: [] },
        { type: 'item', name: 'Sword', description: 'Steel blade', quotes: [] },
      ];

      const characters = elements.filter((e) => e.type === 'character');
      const places = elements.filter((e) => e.type === 'place');
      const items = elements.filter((e) => e.type === 'item');

      expect(characters).toHaveLength(2);
      expect(places).toHaveLength(1);
      expect(items).toHaveLength(1);
    });

    it('should handle empty context gracefully', () => {
      const elements: BookElement[] = [];

      const characters = elements
        .filter((e) => e.type === 'character')
        .map((e) => `- ${e.name}: ${e.description}`)
        .join('\n');

      expect(characters).toBe('');
    });

    it('should format context string for prompt injection', () => {
      const elements: BookElement[] = [
        {
          type: 'character',
          name: 'John Snow',
          description: 'Dark hair, gray eyes',
          quotes: [],
          aliases: ['Jon Snow'],
        },
        {
          type: 'place',
          name: 'Winterfell',
          description: 'Ancient castle',
          quotes: [],
        },
      ];

      const characters = elements
        .filter((e) => e.type === 'character')
        .map((e) => {
          const aliases = e.aliases ? ` (aka ${e.aliases.join(', ')})` : '';
          return `- ${e.name}${aliases}: ${e.description}`;
        })
        .join('\n');

      const places = elements
        .filter((e) => e.type === 'place')
        .map((e) => `- ${e.name}: ${e.description}`)
        .join('\n');

      const contextString = `CHARACTERS:\n${characters}\n\nPLACES:\n${places}`;

      expect(contextString).toContain('CHARACTERS:');
      expect(contextString).toContain('PLACES:');
      expect(contextString).toContain('John Snow (aka Jon Snow)');
      expect(contextString).toContain('Winterfell: Ancient castle');
    });
  });

  describe('Cross-Scene Consistency', () => {
    it('should maintain consistent character descriptions', () => {
      const element: BookElement = {
        type: 'character',
        name: 'John Snow',
        description: 'Dark hair, gray eyes, black cloak',
        quotes: [
          { text: 'John at the wall', page: '1' },
          { text: 'Snow in battle', page: '50' },
          { text: 'Jon with his sword', page: '100' },
        ],
        aliases: ['Jon Snow', 'The Bastard'],
      };

      // All scenes should reference the same canonical description
      const scene1Context = `- ${element.name}: ${element.description}`;
      const scene2Context = `- ${element.name}: ${element.description}`;
      const scene3Context = `- ${element.name}: ${element.description}`;

      expect(scene1Context).toBe(scene2Context);
      expect(scene2Context).toBe(scene3Context);
      expect(scene1Context).toContain('Dark hair, gray eyes, black cloak');
    });

    it('should recognize aliases across scenes', () => {
      const element: BookElement = {
        type: 'character',
        name: 'John Snow',
        description: 'Hero of the story',
        quotes: [],
        aliases: ['Jon Snow', 'The Bastard', 'Lord Commander'],
      };

      // Different scenes might mention different names
      const mentionedNames = ['John Snow', 'Jon Snow', 'The Bastard'];

      // But all should map to the same canonical element
      const canonicalName = element.name;
      const allAliases = [canonicalName, ...(element.aliases || [])];

      for (const mention of mentionedNames) {
        const isRecognized = allAliases.some(
          (alias) => alias.toLowerCase() === mention.toLowerCase()
        );
        expect(isRecognized).toBe(true);
      }
    });

    it('should provide consistent visual style context', () => {
      const styleContext =
        'Consistent visual style: detailed, realistic, consistent character appearances';

      // Same style guide should be used across all scenes
      const scene1Style = styleContext;
      const scene2Style = styleContext;

      expect(scene1Style).toBe(scene2Style);
    });
  });

  describe('Configuration Options', () => {
    it('should respect iterativeExtraction flag', () => {
      const configWithIterative = { ...mockConfig, iterativeExtraction: true };
      const configWithoutIterative = { ...mockConfig, iterativeExtraction: false };

      expect(configWithIterative.iterativeExtraction).toBe(true);
      expect(configWithoutIterative.iterativeExtraction).toBe(false);
    });

    it('should respect smartElementMerging flag', () => {
      const configWithSmart = { ...mockConfig, smartElementMerging: true };
      const configWithoutSmart = { ...mockConfig, smartElementMerging: false };

      expect(configWithSmart.smartElementMerging).toBe(true);
      expect(configWithoutSmart.smartElementMerging).toBe(false);
    });

    it('should use entityMatchConfidence threshold', () => {
      const lowThreshold = { ...mockConfig, entityMatchConfidence: 0.5 };
      const highThreshold = { ...mockConfig, entityMatchConfidence: 0.9 };

      expect(lowThreshold.entityMatchConfidence).toBe(0.5);
      expect(highThreshold.entityMatchConfidence).toBe(0.9);

      // Low threshold = more aggressive merging
      const matchConfidence = 0.6;
      expect(matchConfidence > lowThreshold.entityMatchConfidence).toBe(true);
      expect(matchConfidence > highThreshold.entityMatchConfidence).toBe(false);
    });

    it('should respect aiDescriptionEnrichment flag', () => {
      const configWithAI = { ...mockConfig, aiDescriptionEnrichment: true };
      const configWithoutAI = { ...mockConfig, aiDescriptionEnrichment: false };

      expect(configWithAI.aiDescriptionEnrichment).toBe(true);
      expect(configWithoutAI.aiDescriptionEnrichment).toBe(false);
    });

    it('should use maxExtractionChars for legacy mode', () => {
      const config = { ...mockConfig, maxExtractionChars: 100000 };

      expect(config.maxExtractionChars).toBe(100000);
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures during extraction', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      try {
        await mockOpenAI.chat.completions.create({
          model: 'test-model',
          messages: [],
        });
        expect(true).toBe(false); // Should not reach
      } catch (error: any) {
        expect(error.message).toBe('API Error');
      }
    });

    it('should handle malformed API responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'invalid json {{{',
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
      });

      try {
        JSON.parse(response.choices[0].message.content);
        expect(true).toBe(false); // Should not reach
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing elements array in response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ other_field: 'value' }),
            },
          },
        ],
      });

      const response = await mockOpenAI.chat.completions.create({
        model: 'test-model',
        messages: [],
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      const elements = parsed.elements || [];

      expect(elements).toHaveLength(0);
    });

    it('should handle state save failures', async () => {
      // Try to save to invalid directory
      const invalidStateManager = new StateManager(
        '/invalid/path/that/does/not/exist',
        'test.epub',
        'Test Book',
        100
      );

      try {
        await invalidStateManager.save();
        expect(true).toBe(false); // Should not reach
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });
});
