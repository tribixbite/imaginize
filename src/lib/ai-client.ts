/**
 * Common AI Client Interface
 *
 * Defines the contract for any AI client that can create chat completions.
 * This interface is compatible with the OpenAI SDK and can be implemented by custom adapters.
 */

import type { Stream } from 'openai/streaming';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from 'openai/resources/chat/completions';

/**
 * Defines the common interface for an AI client that can create chat completions.
 * This contract is compatible with the OpenAI SDK and can be implemented by custom adapters.
 */
export interface IAiClient {
  chat: {
    completions: {
      create(
        params: ChatCompletionCreateParams
      ): Promise<ChatCompletion | Stream<ChatCompletionChunk>>;
    };
  };
}
