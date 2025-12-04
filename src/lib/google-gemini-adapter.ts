/**
 * Google Gemini Native API Adapter
 *
 * Provides direct integration with Google's Gemini API (NOT OpenRouter proxy).
 * Uses Google's native endpoint format and authentication.
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * Auth: X-goog-api-key header
 * Body: {"contents": [{"parts": [{"text": "..."}]}]}
 */

import type { ChatCompletionCreateParams, ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { Stream } from 'openai/streaming';
import type { IAiClient } from './ai-client.js';

export interface GoogleGeminiConfig {
  apiKey: string;
  model: string;
  baseUrl?: string; // Default: https://generativelanguage.googleapis.com/v1beta
}

export interface GoogleGenerateContentRequest {
  contents: Array<{
    role?: string;
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

export interface GoogleGenerateContentResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
      role: string;
    };
    finishReason: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Adapter that makes OpenAI SDK-style calls work with Google's native Gemini API
 */
export class GoogleGeminiAdapter implements IAiClient {
  private config: GoogleGeminiConfig;
  private baseUrl: string;

  constructor(config: GoogleGeminiConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Convert OpenAI chat completion parameters to Google Gemini format
   */
  private convertToGoogleFormat(params: ChatCompletionCreateParams): GoogleGenerateContentRequest {
    const contents = params.messages.map(msg => {
      // Google uses "model" and "user" roles, OpenAI uses "assistant" and "user"
      const role = msg.role === 'assistant' ? 'model' : msg.role === 'system' ? 'user' : msg.role;

      return {
        role,
        parts: [{
          text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }]
      };
    });

    const generationConfig: GoogleGenerateContentRequest['generationConfig'] = {};

    if (params.temperature !== null && params.temperature !== undefined) {
      generationConfig.temperature = params.temperature;
    }
    if (params.top_p !== null && params.top_p !== undefined) {
      generationConfig.topP = params.top_p;
    }
    if (params.max_tokens !== null && params.max_tokens !== undefined) {
      generationConfig.maxOutputTokens = params.max_tokens;
    }

    // If response_format is json_object, set responseMimeType
    if (params.response_format && 'type' in params.response_format && params.response_format.type === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
    }

    return {
      contents,
      generationConfig
    };
  }

  /**
   * Convert Google Gemini response to OpenAI chat completion format
   */
  private convertFromGoogleFormat(response: GoogleGenerateContentResponse, model: string): ChatCompletion {
    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error('No candidates in Google Gemini response');
    }

    // Handle cases where content or parts may be undefined (e.g., safety filters)
    if (!candidate.content || !candidate.content.parts) {
      throw new Error(`Google Gemini response has no content. Finish reason: ${candidate.finishReason || 'unknown'}`);
    }

    const content = candidate.content.parts.map(part => part.text).join('');

    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content
        },
        finish_reason: candidate.finishReason.toLowerCase() as any
      }],
      usage: response.usageMetadata ? {
        prompt_tokens: response.usageMetadata.promptTokenCount,
        completion_tokens: response.usageMetadata.candidatesTokenCount,
        total_tokens: response.usageMetadata.totalTokenCount
      } : undefined
    } as ChatCompletion;
  }

  /**
   * Private method for handling the actual non-streaming API call
   */
  private async createChatCompletionInternal(params: ChatCompletionCreateParams): Promise<ChatCompletion> {
    const model = params.model;
    const url = `${this.baseUrl}/models/${model}:generateContent`;

    const googleRequest = this.convertToGoogleFormat(params);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.config.apiKey
        },
        body: JSON.stringify(googleRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Gemini API error (${response.status}): ${errorText}`);
      }

      const googleResponse = await response.json() as GoogleGenerateContentResponse;
      return this.convertFromGoogleFormat(googleResponse, model);

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Google Gemini API call failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Public create method compatible with the IAiClient interface
   * Handles the streaming parameter and delegates to the internal implementation
   */
  async create(params: ChatCompletionCreateParams): Promise<ChatCompletion | Stream<ChatCompletionChunk>> {
    if (params.stream) {
      // The native Gemini API supports streaming, but this adapter doesn't implement it yet
      throw new Error('Streaming is not yet implemented for the Google Gemini native adapter.');
    }
    return this.createChatCompletionInternal(params);
  }

  /**
   * Create an OpenAI-compatible client object
   * This allows drop-in replacement: openai.chat.completions.create() works
   */
  get chat() {
    return {
      completions: {
        create: this.create.bind(this)
      }
    };
  }
}

/**
 * Detect if a baseUrl is Google's native API (not OpenRouter proxy)
 */
export function isGoogleNativeEndpoint(baseUrl: string): boolean {
  return baseUrl.includes('generativelanguage.googleapis.com') &&
         !baseUrl.includes('/openai');
}

/**
 * Factory function to create appropriate client based on endpoint
 */
export function createAIClient(config: { baseUrl: string; apiKey: string; model: string }) {
  if (isGoogleNativeEndpoint(config.baseUrl)) {
    console.log('✓ Using Google Gemini native API (direct endpoint)');
    return new GoogleGeminiAdapter({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl
    });
  } else {
    console.log('✓ Using OpenAI-compatible API');
    // Return OpenAI client (will be imported from openai package)
    return null; // Caller will handle OpenAI client creation
  }
}
