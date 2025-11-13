import { Page } from '@playwright/test';

/**
 * Mock OpenAI API responses for E2E testing
 *
 * This prevents actual API calls during testing, which:
 * - Avoids API costs
 * - Prevents rate limiting
 * - Makes tests faster and more reliable
 * - Allows testing without valid API keys
 */
export async function mockOpenAIAPI(page: Page) {
  // Mock chat completions (used for analysis)
  await page.route('**/v1/chat/completions', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                scenes: [
                  {
                    title: 'Opening Scene',
                    description: 'A test scene for E2E testing',
                    chapter: 1,
                  },
                  {
                    title: 'Second Scene',
                    description: 'Another test scene',
                    chapter: 1,
                  },
                ],
                elements: {
                  characters: [
                    {
                      name: 'Test Character',
                      description: 'A character for testing',
                    },
                  ],
                  locations: [
                    {
                      name: 'Test Location',
                      description: 'A location for testing',
                    },
                  ],
                },
              }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      }),
    });
  });

  // Mock image generation (DALL-E 3)
  await page.route('**/v1/images/generations', (route) => {
    // Generate a minimal 1x1 PNG image (base64 encoded)
    const minimalPNG =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        created: Date.now(),
        data: [
          {
            url: `data:image/png;base64,${minimalPNG}`,
          },
        ],
      }),
    });
  });
}

/**
 * Mock API error responses for error scenario testing
 */
export async function mockOpenAIAPIError(
  page: Page,
  errorType: 'invalid_key' | 'rate_limit' | 'network' = 'invalid_key'
) {
  const errorResponses = {
    invalid_key: {
      status: 401,
      body: {
        error: {
          message: 'Incorrect API key provided',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      },
    },
    rate_limit: {
      status: 429,
      body: {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded',
        },
      },
    },
    network: {
      status: 500,
      body: {
        error: {
          message: 'Internal server error',
          type: 'server_error',
          code: 'internal_error',
        },
      },
    },
  };

  const response = errorResponses[errorType];

  await page.route('**/v1/**', (route) => {
    route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: JSON.stringify(response.body),
    });
  });
}
