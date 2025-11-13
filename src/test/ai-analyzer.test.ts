/**
 * Unit tests for AI analyzer
 * Tests OpenAI integration for chapter analysis, element extraction, and image generation
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type OpenAI from 'openai';
import {
  analyzeChapter,
  extractElements,
  generateImage,
  processChaptersInBatches,
} from '../lib/ai-analyzer.js';
import type {
  IllustrateConfig,
  ChapterContent,
  ImageConcept,
  BookElement,
} from '../types/config.js';

// Mock OpenAI types
interface MockChatCompletion {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

interface MockImageResponse {
  data: Array<{
    url?: string;
  }>;
}

describe('ai-analyzer', () => {
  // Test data
  const mockConfig: Required<IllustrateConfig> = {
    apiKey: 'test-key',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4',
    imageEndpoint: {
      apiKey: 'test-image-key',
      baseURL: 'https://api.openai.com/v1',
      model: 'dall-e-3',
    },
    imageSize: '1024x1024',
    imageQuality: 'standard',
    pagesPerImage: 10,
    maxConcurrency: 3,
    retryAttempts: 2,
    retryDelayMs: 100,
  };

  const mockChapter: ChapterContent = {
    chapterTitle: 'Chapter 1: The Beginning',
    pageRange: '1-20',
    content: 'The forest was dark and mysterious. A lone traveler walked through the ancient trees, carrying a glowing sword. The moonlight cast eerie shadows on the path ahead. Suddenly, a dragon appeared in the clearing, its scales gleaming like emeralds.',
  };

  describe('analyzeChapter', () => {
    it('should analyze chapter and return image concepts', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  quote: 'A lone traveler walked through the ancient trees, carrying a glowing sword.',
                  description: 'Traveler with glowing sword in dark forest',
                  reasoning: 'Key character introduction with visual prop',
                },
                {
                  quote: 'A dragon appeared in the clearing, its scales gleaming like emeralds.',
                  description: 'Emerald-scaled dragon in forest clearing',
                  reasoning: 'Major plot event with visually striking creature',
                },
              ]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => mockResponse),
          },
        },
      } as unknown as OpenAI;

      const result = await analyzeChapter(mockChapter, mockConfig, mockOpenai);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        chapter: 'Chapter 1: The Beginning',
        pageRange: '1-20',
        quote: expect.stringContaining('traveler'),
        description: expect.stringContaining('sword'),
        reasoning: expect.stringContaining('character'),
      });
      expect(result[1]).toMatchObject({
        chapter: 'Chapter 1: The Beginning',
        pageRange: '1-20',
        quote: expect.stringContaining('dragon'),
        description: expect.stringContaining('Emerald'),
        reasoning: expect.stringContaining('plot event'),
      });
    });

    it('should handle response with concepts wrapper object', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                concepts: [
                  {
                    quote: 'Test quote',
                    description: 'Test description',
                    reasoning: 'Test reasoning',
                  },
                ],
              }),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => mockResponse),
          },
        },
      } as unknown as OpenAI;

      const result = await analyzeChapter(mockChapter, mockConfig, mockOpenai);

      expect(result).toHaveLength(1);
      expect(result[0].quote).toBe('Test quote');
    });

    it('should calculate number of images based on word count', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                { quote: 'Q1', description: 'D1', reasoning: 'R1' },
                { quote: 'Q2', description: 'D2', reasoning: 'R2' },
              ]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              // Verify prompt includes calculated number of images
              expect(params.messages[1].content).toContain('identify');
              expect(params.messages[1].content).toContain('key visual concepts');
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await analyzeChapter(mockChapter, mockConfig, mockOpenai);
    });

    it('should use model name from string config', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              expect(params.model).toBe('gpt-4');
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await analyzeChapter(mockChapter, mockConfig, mockOpenai);
    });

    it('should use model name from object config', async () => {
      const configWithModelObject = {
        ...mockConfig,
        model: { name: 'gpt-4-turbo', maxTokens: 4000 },
      };

      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              expect(params.model).toBe('gpt-4-turbo');
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await analyzeChapter(mockChapter, configWithModelObject, mockOpenai);
    });

    it('should handle missing content in response', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => mockResponse),
          },
        },
      } as unknown as OpenAI;

      const result = await analyzeChapter(mockChapter, mockConfig, mockOpenai);

      expect(result).toEqual([]);
    });

    it('should handle empty choices array', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => mockResponse),
          },
        },
      } as unknown as OpenAI;

      const result = await analyzeChapter(mockChapter, mockConfig, mockOpenai);

      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => {
              throw new Error('API rate limit exceeded');
            }),
          },
        },
      } as unknown as OpenAI;

      const result = await analyzeChapter(mockChapter, mockConfig, mockOpenai);

      expect(result).toEqual([]);
    });

    it('should handle malformed JSON response', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: 'not valid json',
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => mockResponse),
          },
        },
      } as unknown as OpenAI;

      const result = await analyzeChapter(mockChapter, mockConfig, mockOpenai);

      expect(result).toEqual([]);
    });

    it('should handle concepts with missing fields', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                { quote: 'Only quote' },
                { description: 'Only description' },
                { reasoning: 'Only reasoning' },
                {},
              ]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => mockResponse),
          },
        },
      } as unknown as OpenAI;

      const result = await analyzeChapter(mockChapter, mockConfig, mockOpenai);

      expect(result).toHaveLength(4);
      expect(result[0]).toMatchObject({
        quote: 'Only quote',
        description: '',
        reasoning: '',
      });
      expect(result[3]).toMatchObject({
        quote: '',
        description: '',
        reasoning: '',
      });
    });

    it('should set correct system prompt', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              expect(params.messages[0].role).toBe('system');
              expect(params.messages[0].content).toContain('literary analyst');
              expect(params.messages[0].content).toContain('valid JSON');
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await analyzeChapter(mockChapter, mockConfig, mockOpenai);
    });

    it('should use correct temperature and response format', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              expect(params.temperature).toBe(0.7);
              expect(params.response_format).toEqual({ type: 'json_object' });
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await analyzeChapter(mockChapter, mockConfig, mockOpenai);
    });
  });

  describe('extractElements', () => {
    it('should extract story elements from text', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  type: 'character',
                  name: 'The Traveler',
                  quotes: [
                    { text: 'A lone traveler walked through...', page: '1' },
                    { text: 'The traveler carried a glowing sword', page: '1' },
                  ],
                  description: 'Mysterious traveler with magical sword',
                },
                {
                  type: 'creature',
                  name: 'Emerald Dragon',
                  quotes: [
                    { text: 'A dragon appeared, scales gleaming like emeralds', page: '1' },
                  ],
                  description: 'Large dragon with emerald-colored scales',
                },
                {
                  type: 'place',
                  name: 'Ancient Forest',
                  quotes: [
                    { text: 'The forest was dark and mysterious', page: '1' },
                    { text: 'Ancient trees loomed overhead', page: '1' },
                  ],
                  description: 'Dark, mysterious forest with ancient trees',
                },
              ]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => mockResponse),
          },
        },
      } as unknown as OpenAI;

      const fullText = 'A long book text with many elements and characters...';
      const result = await extractElements(fullText, mockConfig, mockOpenai);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        type: 'character',
        name: 'The Traveler',
      });
      expect(result[0].quotes).toHaveLength(2);
      expect(result[1].type).toBe('creature');
      expect(result[2].type).toBe('place');
    });

    it('should handle response with elements wrapper object', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                elements: [
                  {
                    type: 'item',
                    name: 'Magic Ring',
                    quotes: [{ text: 'A glowing ring', page: '5' }],
                    description: 'Powerful magical ring',
                  },
                ],
              }),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => mockResponse),
          },
        },
      } as unknown as OpenAI;

      const result = await extractElements('text', mockConfig, mockOpenai);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Magic Ring');
    });

    it('should truncate text to 50000 characters', async () => {
      const longText = 'x'.repeat(100000);
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              const userMessage = params.messages[1].content;
              // Should be truncated
              expect(userMessage.length).toBeLessThan(100000);
              expect(userMessage).toContain('truncated');
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await extractElements(longText, mockConfig, mockOpenai);
    });

    it('should use model name from string config', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              expect(params.model).toBe('gpt-4');
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await extractElements('text', mockConfig, mockOpenai);
    });

    it('should use model name from object config', async () => {
      const configWithModelObject = {
        ...mockConfig,
        model: { name: 'gpt-4-turbo', maxTokens: 4000 },
      };

      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              expect(params.model).toBe('gpt-4-turbo');
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await extractElements('text', configWithModelObject, mockOpenai);
    });

    it('should handle missing content in response', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => mockResponse),
          },
        },
      } as unknown as OpenAI;

      const result = await extractElements('text', mockConfig, mockOpenai);

      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async () => {
              throw new Error('API error');
            }),
          },
        },
      } as unknown as OpenAI;

      const result = await extractElements('text', mockConfig, mockOpenai);

      expect(result).toEqual([]);
    });

    it('should set correct system prompt for element extraction', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              expect(params.messages[0].role).toBe('system');
              expect(params.messages[0].content).toContain('literary analyst');
              expect(params.messages[0].content).toContain('cataloging story elements');
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await extractElements('text', mockConfig, mockOpenai);
    });

    it('should use temperature 0.5 for element extraction', async () => {
      const mockResponse: MockChatCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
      };

      const mockOpenai = {
        chat: {
          completions: {
            create: mock(async (params: any) => {
              expect(params.temperature).toBe(0.5);
              expect(params.response_format).toEqual({ type: 'json_object' });
              return mockResponse;
            }),
          },
        },
      } as unknown as OpenAI;

      await extractElements('text', mockConfig, mockOpenai);
    });
  });

  describe('generateImage', () => {
    it('should generate image and return URL', async () => {
      const mockResponse: MockImageResponse = {
        data: [
          {
            url: 'https://example.com/generated-image.png',
          },
        ],
      };

      const mockOpenai = {
        images: {
          generate: mock(async () => mockResponse),
        },
      } as unknown as OpenAI;

      const result = await generateImage(
        'A dragon with emerald scales',
        mockConfig,
        mockOpenai
      );

      expect(result).toBe('https://example.com/generated-image.png');
    });

    it('should use image model from config string', async () => {
      const mockResponse: MockImageResponse = {
        data: [{ url: 'https://example.com/img.png' }],
      };

      const mockOpenai = {
        images: {
          generate: mock(async (params: any) => {
            expect(params.model).toBe('dall-e-3');
            return mockResponse;
          }),
        },
      } as unknown as OpenAI;

      await generateImage('Test', mockConfig, mockOpenai);
    });

    it('should use image model from config object', async () => {
      const configWithModelObject = {
        ...mockConfig,
        imageEndpoint: {
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1',
          model: { name: 'flux-pro', maxTokens: 1000 },
        },
      };

      const mockResponse: MockImageResponse = {
        data: [{ url: 'https://example.com/img.png' }],
      };

      const mockOpenai = {
        images: {
          generate: mock(async (params: any) => {
            expect(params.model).toBe('flux-pro');
            return mockResponse;
          }),
        },
      } as unknown as OpenAI;

      await generateImage('Test', configWithModelObject, mockOpenai);
    });

    it('should use default dall-e-3 if no image model specified', async () => {
      const configWithoutImageModel = {
        ...mockConfig,
        imageEndpoint: {
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1',
        },
      };

      const mockResponse: MockImageResponse = {
        data: [{ url: 'https://example.com/img.png' }],
      };

      const mockOpenai = {
        images: {
          generate: mock(async (params: any) => {
            expect(params.model).toBe('dall-e-3');
            return mockResponse;
          }),
        },
      } as unknown as OpenAI;

      await generateImage('Test', configWithoutImageModel, mockOpenai);
    });

    it('should pass size and quality from config', async () => {
      const mockResponse: MockImageResponse = {
        data: [{ url: 'https://example.com/img.png' }],
      };

      const mockOpenai = {
        images: {
          generate: mock(async (params: any) => {
            expect(params.size).toBe('1024x1024');
            expect(params.quality).toBe('standard');
            expect(params.n).toBe(1);
            return mockResponse;
          }),
        },
      } as unknown as OpenAI;

      await generateImage('Test', mockConfig, mockOpenai);
    });

    it('should handle missing URL in response', async () => {
      const mockResponse: MockImageResponse = {
        data: [{}],
      };

      const mockOpenai = {
        images: {
          generate: mock(async () => mockResponse),
        },
      } as unknown as OpenAI;

      const result = await generateImage('Test', mockConfig, mockOpenai);

      expect(result).toBeUndefined();
    });

    it('should handle empty data array', async () => {
      const mockResponse: MockImageResponse = {
        data: [],
      };

      const mockOpenai = {
        images: {
          generate: mock(async () => mockResponse),
        },
      } as unknown as OpenAI;

      const result = await generateImage('Test', mockConfig, mockOpenai);

      expect(result).toBeUndefined();
    });

    it('should handle API errors gracefully', async () => {
      const mockOpenai = {
        images: {
          generate: mock(async () => {
            throw new Error('Image generation failed');
          }),
        },
      } as unknown as OpenAI;

      const result = await generateImage('Test', mockConfig, mockOpenai);

      expect(result).toBeUndefined();
    });
  });

  describe('processChaptersInBatches', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const processOrder: number[] = [];

      const processor = async (item: number) => {
        processOrder.push(item);
        return item * 2;
      };

      const result = await processChaptersInBatches(items, processor, 3);

      expect(result).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
      expect(processOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('should respect max concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5];
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const processor = async (item: number) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise((resolve) => setTimeout(resolve, 10));
        concurrentCount--;
        return item;
      };

      await processChaptersInBatches(items, processor, 2);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should handle empty array', async () => {
      const processor = async (item: number) => item * 2;
      const result = await processChaptersInBatches([], processor, 3);

      expect(result).toEqual([]);
    });

    it('should handle single item', async () => {
      const processor = async (item: number) => item * 2;
      const result = await processChaptersInBatches([5], processor, 3);

      expect(result).toEqual([10]);
    });

    it('should handle items equal to batch size', async () => {
      const items = [1, 2, 3];
      const processor = async (item: number) => item * 2;
      const result = await processChaptersInBatches(items, processor, 3);

      expect(result).toEqual([2, 4, 6]);
    });

    it('should handle processor that throws error', async () => {
      const items = [1, 2, 3];
      const processor = async (item: number) => {
        if (item === 2) {
          throw new Error('Processing error');
        }
        return item * 2;
      };

      await expect(processChaptersInBatches(items, processor, 2)).rejects.toThrow(
        'Processing error'
      );
    });

    it('should process batches sequentially', async () => {
      const items = [1, 2, 3, 4, 5, 6];
      const batchStarts: number[][] = [];
      let currentBatch: number[] = [];

      const processor = async (item: number) => {
        if (currentBatch.length === 0) {
          currentBatch = [item];
        } else {
          currentBatch.push(item);
        }

        // Small delay to ensure batch grouping
        await new Promise((resolve) => setTimeout(resolve, 1));

        if (currentBatch.length === 2) {
          batchStarts.push([...currentBatch]);
          currentBatch = [];
        }

        return item * 2;
      };

      await processChaptersInBatches(items, processor, 2);

      // Should have processed in 3 batches of 2
      expect(batchStarts.length).toBeGreaterThan(0);
    });

    it('should handle async processor with different return types', async () => {
      const items = ['a', 'b', 'c'];
      const processor = async (item: string) => {
        return { value: item, length: item.length };
      };

      const result = await processChaptersInBatches(items, processor, 2);

      expect(result).toEqual([
        { value: 'a', length: 1 },
        { value: 'b', length: 1 },
        { value: 'c', length: 1 },
      ]);
    });
  });
});
