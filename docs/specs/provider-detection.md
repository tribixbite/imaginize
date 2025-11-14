# Provider Detection Specification

Automatic API provider detection and configuration in imaginize.

## Overview

imaginize auto-detects API providers based on:
- API key format
- Environment variables
- Configuration file settings
- Base URL patterns

**Supported Providers**:
- OpenAI (official)
- OpenRouter (proxy with free tier)
- Custom endpoints (self-hosted)

---

## Detection Algorithm

### Step 1: Check Explicit Configuration

**Priority Order**:
1. CLI flags (`--api-key`, `--model`)
2. Environment variables (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`)
3. Config file (`.imaginize.config`)

### Step 2: API Key Format Detection

**OpenAI Keys**:
- Format: `sk-...` (56+ characters)
- Detection: `/^sk-[A-Za-z0-9]{48,}$/`

**OpenRouter Keys**:
- Format: `sk-or-v1-...` (64+ characters)
- Detection: `/^sk-or-v1-[A-Za-z0-9]{64,}$/`

### Step 3: Base URL Detection

**OpenAI**: `https://api.openai.com/v1`
**OpenRouter**: `https://openrouter.ai/api/v1`
**Custom**: User-specified URL

---

## Decision Tree

```
User provides API key
├─ Key matches /^sk-or-v1-/
│  └─ Provider: OpenRouter
│     ├─ Base URL: https://openrouter.ai/api/v1
│     ├─ Model: anthropic/claude-3.5-sonnet (free tier)
│     └─ Rate limit: free tier (1 req/min)
│
├─ Key matches /^sk-/
│  └─ Provider: OpenAI
│     ├─ Base URL: https://api.openai.com/v1
│     ├─ Model: gpt-4o-mini (default)
│     └─ Rate limit: paid tier (flexible)
│
└─ Custom base URL provided
   └─ Provider: Custom
      ├─ Base URL: user-specified
      ├─ Model: user-specified
      └─ Rate limit: user-specified
```

---

## Configuration Preparation

### OpenAI Configuration

```typescript
const config = {
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
  defaultModel: {
    text: 'gpt-4o-mini',
    image: 'dall-e-3',
  },
  rateLimit: 'paid',
};
```

### OpenRouter Configuration

```typescript
const config = {
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultModel: {
    text: 'anthropic/claude-3.5-sonnet',
    image: 'black-forest-labs/flux-1.1-pro',
  },
  rateLimit: 'free',
};
```

### Custom Endpoint Configuration

```typescript
const config = {
  apiKey: process.env.CUSTOM_API_KEY,
  baseURL: 'http://localhost:1234/v1',
  defaultModel: {
    text: 'llama-3.1-8b',
    image: 'stable-diffusion-xl',
  },
  rateLimit: 'paid', // User configures
};
```

---

## Provider-Specific Behavior

### OpenAI

**Features**:
- Official GPT models
- DALL-E image generation
- Function calling support
- Structured outputs

**Rate Limits**:
- Tier-based (paid accounts)
- Flexible batch processing

### OpenRouter

**Features**:
- Access to multiple AI models
- Free tier with rate limits
- Unified API interface
- Model fallbacks

**Rate Limits**:
- Free tier: 1 request/minute
- Paid tier: Higher limits

**Free Tier Models**:
- `anthropic/claude-3.5-sonnet`
- `meta-llama/llama-3.1-8b-instruct`
- `black-forest-labs/flux-1.1-pro` (images)

### Custom Endpoints

**Use Cases**:
- Self-hosted LLMs (LM Studio, Ollama)
- Corporate API gateways
- Development/testing environments

**Requirements**:
- OpenAI-compatible API
- `/v1/chat/completions` endpoint
- `/v1/images/generations` endpoint (optional)

---

## Environment Variables

### Detection Priority

1. `OPENROUTER_API_KEY` - OpenRouter (free tier)
2. `OPENAI_API_KEY` - OpenAI (paid tier)
3. `CUSTOM_API_KEY` + `CUSTOM_BASE_URL` - Custom endpoint

### Configuration File

**`.imaginize.config`**:
```json
{
  "apiKey": "sk-...",
  "baseURL": "https://api.openai.com/v1",
  "model": {
    "text": "gpt-4o-mini",
    "image": "dall-e-3"
  },
  "rateLimit": "paid"
}
```

---

## Model Selection

### Default Models by Provider

| Provider | Text Model | Image Model |
|----------|-----------|-------------|
| OpenAI | gpt-4o-mini | dall-e-3 |
| OpenRouter | anthropic/claude-3.5-sonnet | black-forest-labs/flux-1.1-pro |
| Custom | User-specified | User-specified |

### Model Override

**CLI**: `--model gpt-4o`
**Config**: `{ "model": { "text": "gpt-4o" } }`
**Env**: `IMAGINIZE_MODEL=gpt-4o`

---

## Error Handling

### Invalid API Key

```
❌ Invalid API key format

Expected:
- OpenAI: sk-... (56+ characters)
- OpenRouter: sk-or-v1-... (64+ characters)

Please check your API key configuration.
```

### Provider Auto-Detection Failed

```
⚠️  Could not auto-detect API provider

Using default: OpenAI
Base URL: https://api.openai.com/v1

To specify provider:
- Set OPENROUTER_API_KEY for OpenRouter
- Use --base-url for custom endpoints
```

---

## Related Documentation

- [Configuration](./configuration.md) - Config file format
- [CLI Interface](./cli-interface.md) - Command-line options
- [AI Integration](./ai-integration.md) - Provider integration

---

**Status**: Complete ✅
**Last Updated**: 2025-11-14
**Supported Providers**: 3 (OpenAI, OpenRouter, Custom)
