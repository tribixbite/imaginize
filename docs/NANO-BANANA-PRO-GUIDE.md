# Nano Banana PRO (Gemini 3 Pro Image) - Integration Guide

**Model:** `gemini-3-pro-image-preview` (Google Gemini API)
**Colloquial Name:** Nano Banana PRO 🍌
**Base Model:** Gemini 3 Pro
**Released:** November 20, 2025
**Type:** Studio-quality image generation with deep reasoning

## Overview

Nano Banana PRO (Gemini 3 Pro Image) is Google's latest state-of-the-art image generation model, built on Gemini 3 Pro. It represents a significant upgrade from the previous Gemini 2.5 Flash Image model, offering professional-grade controls and higher fidelity outputs.

## Key Features

### 1. **Text Rendering** (Best-in-Class)
- Correctly rendered and legible text directly in images
- Supports short taglines and long paragraphs
- Ideal for book covers, posters, infographics

### 2. **High Resolution**
- **2K resolution** (2048px): $0.139/image
- **4K resolution** (4096px): $0.240/image
- **1080p** (1920px): $0.139/image
- Professional production standards

### 3. **Professional Controls**
Gemini 3 Pro Image provides control over:
- **Lighting** - Natural, studio, dramatic, golden hour, etc.
- **Camera** - Focal length, depth of field, angle, perspective
- **Focus** - Sharp, soft, selective focus points
- **Color Grading** - Cinematic, vibrant, muted, custom palettes

### 4. **Multi-Object Blending**
- Reference up to **6 high-fidelity shots**
- Blend up to **14 objects** within a single image
- Maintain consistency and resemblance of up to **5 people**
- No LoRA training required for character consistency

### 5. **Deep Think Reasoning**
- Built on Gemini 3 Pro's advanced reasoning capabilities
- Better understanding of complex scene compositions
- Improved adherence to nuanced requirements

## API Access

### Endpoints

**Google AI Studio:**
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateImage
```

**Vertex AI (Enterprise):**
```
projects/YOUR_PROJECT_ID/locations/YOUR_LOCATION/publishers/google/models/gemini-3-pro-image
```

### Authentication

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

Get your API key from:
- Google AI Studio: https://aistudio.google.com/apikey
- Vertex AI: https://console.cloud.google.com/vertex-ai

## Pricing

| Resolution | Price per Image | Use Case |
|-----------|----------------|----------|
| 1080p     | $0.139         | Web graphics, social media |
| 2K (2048px) | $0.139       | Professional prints, presentations |
| 4K (4096px) | $0.240       | High-end production, large format |

**Comparison:**
- Gemini 2.5 Flash Image: $0.039/image (faster, lower cost, lower quality)
- Nano Banana PRO: $0.139-$0.240/image (slower, higher cost, studio quality)

## Prompt Engineering for Nano Banana PRO

### Best Practices

#### 1. **Specify Professional Controls**

```
Create an image with the following requirements:

Scene: A mysterious forest at twilight with ancient trees
Lighting: Golden hour, warm directional light from the left, soft shadows
Camera: Shot with 50mm lens, f/2.8, shallow depth of field
Focus: Sharp focus on foreground character, soft bokeh background
Color Grading: Cinematic teal and orange color palette

The image MUST maintain photorealistic quality.
```

#### 2. **Use Markdown Structure**

Nano Banana PRO (like its predecessor) benefits from structured prompts:

```
## Scene Description
A medieval castle on a cliff overlooking the ocean

## Composition
- Rule of thirds placement
- Castle in right third of frame
- Ocean and sky filling left two-thirds
- Dramatic clouds in upper portion

## Technical Specs
- Resolution: 4K
- Aspect Ratio: 16:9
- Style: Cinematic landscape photography
```

#### 3. **Leverage Text Rendering**

```
Create a book cover image with the following elements:

Title Text: "The Chronicles of Aetheria" (large, ornate fantasy font)
Subtitle: "Volume One: The Awakening" (smaller, elegant serif)
Author: "by Katherine Blackwood" (bottom, simple sans-serif)

Background: Epic fantasy landscape with floating islands
Text Placement: Title centered in upper third, subtitle below, author at bottom
Text MUST be clearly legible and correctly spelled.
```

#### 4. **Multi-Character Consistency**

```
Create an image featuring five characters maintaining their established appearances:

Character 1: Reference image [uploaded separately]
  - Position: Center foreground
  - Expression: Confident smile

Character 2: Reference image [uploaded separately]
  - Position: Left mid-ground
  - Expression: Thoughtful, looking at Character 1

MUST maintain exact facial features, hair color, and distinctive marks from reference images.
```

#### 5. **Professional Color Control**

```
Color Palette:
- Primary: #1A2B3C (deep navy) - sky and shadows
- Secondary: #F4A460 (sandy brown) - desert landscape
- Accent: #FF6B6B (coral red) - character's cloak
- Highlights: #FFE5B4 (peach) - sunset lighting

The image MUST use these exact hex colors in the specified elements.
```

## Integration Examples

### TypeScript/Node.js (Gemini SDK)

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

async function generateNanoBanaanaProImage(prompt: string, resolution: '1080p' | '2k' | '4k') {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview'
  });

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      // Resolution controls
      responseMediaType: 'image/png',
      responseSchema: {
        width: resolution === '4k' ? 4096 : resolution === '2k' ? 2048 : 1920,
        height: resolution === '4k' ? 4096 : resolution === '2k' ? 2048 : 1080
      }
    }
  });

  return result.response.candidates[0].content.parts[0].inlineData;
}

// Example usage
const prompt = `
Create an image for a fantasy book scene:

Scene: A wizard's study filled with ancient tomes and magical artifacts
Lighting: Warm candlelight, shadows dancing on stone walls
Camera: Wide angle (24mm), slight low angle looking up at bookshelves
Focus: Sharp focus throughout (f/8)
Color Grading: Warm amber tones with deep purple shadows

Style: Professional fantasy illustration, detailed and atmospheric
Resolution: 4K
`;

const imageData = await generateNanoBanaanaProImage(prompt, '4k');
```

### REST API (cURL)

```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Create a high-resolution fantasy landscape with a castle on a cliff at sunset. Lighting: Golden hour with warm directional light. Camera: 70mm lens, f/4. Color grading: Cinematic orange and teal."
      }]
    }],
    "generationConfig": {
      "temperature": 0.7,
      "responseMediaType": "image/png"
    }
  }'
```

## Imaginize Integration

### Configuration

Add to `.imaginize.json`:

```json
{
  "provider": "gemini",
  "model": "gemini-3-pro-image-preview",
  "apiKey": "${GOOGLE_API_KEY}",
  "baseUrl": "https://generativelanguage.googleapis.com/v1beta",

  "nanoBanana": {
    "useMarkdownLists": true,
    "usePhotographyBuzzwords": true,
    "enforcePhysicality": true,
    "resolution": "2k"
  },

  "imageEndpoint": {
    "provider": "gemini",
    "model": "gemini-3-pro-image-preview",
    "apiKey": "${GOOGLE_API_KEY}"
  }
}
```

### CLI Usage

```bash
# Use Nano Banana PRO for image generation
imaginize --images --provider gemini --model gemini-3-pro-image-preview --file book.epub

# Specify resolution
imaginize --images --provider gemini --nano-banana-resolution 4k --file book.epub

# Enable professional controls
imaginize --images --provider gemini --nano-banana-professional-controls --file book.epub
```

## Comparison: Nano Banana vs Nano Banana PRO

| Feature | Gemini 2.5 Flash Image (Original) | Gemini 3 Pro Image (PRO) |
|---------|----------------------------------|--------------------------|
| **Base Model** | Gemini 2.5 Flash | Gemini 3 Pro |
| **Released** | Mid-2024 | November 20, 2025 |
| **Price** | $0.039/image | $0.139-$0.240/image |
| **Max Resolution** | 1024x1024 | 4096x4096 (4K) |
| **Generation Time** | ~30 seconds | ~45-60 seconds |
| **Text Rendering** | Basic | Best-in-class |
| **Professional Controls** | Limited | Full (lighting, camera, focus, color) |
| **Multi-Object Blending** | Up to 2 images | Up to 14 objects, 6 reference images |
| **Character Consistency** | Limited | Up to 5 people consistently |
| **Context Window** | 32K tokens | 1M tokens (Gemini 3 Pro) |
| **Best For** | Rapid prototyping, low-cost generation | Professional production, studio quality |

## Use Cases for Imaginize

### Book Illustration Pipeline

**Scenario:** Generating professional-quality illustrations for a fantasy novel

**Configuration:**
- **Text Analysis**: Use Gemini 3 Pro (text model) for scene analysis
- **Image Generation**: Use Nano Banana PRO for high-quality illustrations
- **Resolution**: 2K for digital distribution, 4K for print editions
- **Professional Controls**: Enable lighting, camera, and color grading

**Workflow:**
1. Analyze chapters with Gemini 3 Pro to extract detailed scene descriptions
2. Generate 2K images with Nano Banana PRO for character consistency
3. Apply consistent lighting and color grading across all images
4. Compile into PDF with smart captions

### Character Reference Sheets

**Scenario:** Creating consistent character appearances across multiple scenes

**Benefits of Nano Banana PRO:**
- Maintains character features across up to 5 different people
- Can reference initial character design images
- Supports detailed appearance specifications (hex colors for hair/eyes/clothing)

**Example Prompt Template:**
```
Create a character reference sheet for [Character Name]

## Physical Appearance
- Age: [age]
- Height: [height]
- Build: [build type]
- Hair: [color hex code], [style]
- Eyes: [color hex code], [shape]
- Skin Tone: [hex code]

## Clothing
- [Detailed outfit description with colors]

## Expression Variants
- Neutral
- Smiling
- Serious
- Surprised

Style: Professional character design sheet, clean background
Resolution: 4K
Lighting: Even, neutral studio lighting
```

## Limitations & Considerations

### 1. **Cost**
At $0.139-$0.240 per image, Nano Banana PRO is 3.5-6x more expensive than Flash Image. Budget accordingly:
- 100 images @ 2K = $13.90
- 100 images @ 4K = $24.00

### 2. **Generation Time**
~45-60 seconds per image vs. 30 seconds for Flash Image. Plan for longer processing times.

### 3. **Availability**
Currently in paid preview. May have rate limits:
- Free tier: Limited quota (check Google AI Studio)
- Paid tier: Higher limits but still subject to fair use

### 4. **API Stability**
As a preview model (`gemini-3-pro-image-preview`), the API may change. Monitor:
- Google AI Developer Blog: https://developers.googleblog.com/
- Gemini API Docs: https://ai.google.dev/gemini-api/docs

## Troubleshooting

### "Model not found" Error

**Problem:** `gemini-3-pro-image-preview` not available

**Solutions:**
1. Check API key has access to preview models
2. Verify you're using the latest Gemini SDK
3. Check regional availability (may not be available in all regions)
4. Fallback to `gemini-2.5-flash-image` if PRO unavailable

### Rate Limit Exceeded

**Problem:** Too many requests in short time

**Solutions:**
1. Implement exponential backoff (already in retry-utils.ts)
2. Reduce concurrency (`maxConcurrency: 1` in config)
3. Upgrade to paid tier for higher limits
4. Batch process overnight for large jobs

### Poor Text Rendering Quality

**Problem:** Text in images is blurry or misspelled

**Solutions:**
1. Use ALL CAPS for critical text requirements: `The text MUST say "Exactly This"`
2. Specify exact font styles and sizes
3. Provide reference images with desired text style
4. Use high resolution (4K) for better text clarity

### Inconsistent Character Appearance

**Problem:** Character looks different across images

**Solutions:**
1. Upload reference image of character first
2. Use detailed physical descriptions with hex colors
3. Maintain consistent lighting/camera settings
4. Generate all character images in single session
5. Use character reference sheets as input for each scene

## Roadmap & Future Enhancements

### Planned Imaginize Features (v2.10.0)

- [ ] Automatic resolution selection based on use case
- [ ] Character reference sheet generation
- [ ] Multi-image consistency validation
- [ ] Professional control presets (cinematic, editorial, artistic)
- [ ] Cost estimation before generation
- [ ] Fallback to Flash Image for non-critical scenes
- [ ] Hybrid workflow (Flash for drafts, PRO for final)

## Additional Resources

- **Official Blog**: https://blog.google/technology/developers/gemini-3-pro-image-developers/
- **API Docs**: https://ai.google.dev/gemini-api/docs/models
- **Google AI Studio**: https://aistudio.google.com/
- **Community Examples**: https://github.com/google-gemini/cookbook

---

**Last Updated:** November 20, 2025
**Imaginize Version:** v2.9.0+
**Model ID:** `gemini-3-pro-image-preview`
