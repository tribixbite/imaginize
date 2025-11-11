# Image Generation Style Guide: Google Gemini & OpenAI DALL-E
## Best Practices for API Integration and Prompting (2025)

**Last Updated:** November 2025
**Version:** 1.0

---

## Table of Contents

1. [Model Overview & Selection](#model-overview--selection)
2. [Google Gemini 2.5 Flash Image (Nano Banana)](#google-gemini-25-flash-image-nano-banana)
3. [OpenAI DALL-E 3](#openai-dall-e-3)
4. [OpenRouter Integration](#openrouter-integration)
5. [Prompting Best Practices](#prompting-best-practices)
6. [Parameter Optimization](#parameter-optimization)
7. [Quality Comparison Matrix](#quality-comparison-matrix)
8. [Cost Analysis](#cost-analysis)
9. [References](#references)

---

## Model Overview & Selection

### Decision Matrix

| Use Case | Recommended Model | Reason |
|----------|------------------|---------|
| **Photorealistic images** | Gemini 2.5 Flash Image | Superior realism and prompt accuracy[^1] |
| **Creative/Fantasy artwork** | DALL-E 3 | Better artistic rendering and imaginative content[^2] |
| **Fast iteration (< 5s)** | Gemini 2.5 Flash Image | Sub-5-second generation vs 60+ seconds[^3] |
| **Multi-image blending** | Gemini 2.5 Flash Image | Native multi-image source support[^4] |
| **Text in images** | DALL-E 3 | Superior text rendering and typography[^5] |
| **Free tier usage** | Gemini 2.5 Flash Image | Free via OpenRouter[^6] |
| **Character consistency** | Gemini 2.5 Flash Image | Built-in subject preservation[^4] |
| **Detailed prompts** | DALL-E 3 | Better prompt fidelity for complex descriptions[^7] |

---

## Google Gemini 2.5 Flash Image (Nano Banana)

### Model Information

**Official Name:** `gemini-2.5-flash-image`
**Nickname:** Nano Banana
**Release Date:** August 26, 2025[^4]
**Production Ready:** October 2, 2025[^4]
**Documentation:** https://ai.google.dev/gemini-api/docs/image-generation

### API Configuration

#### OpenRouter Integration

```javascript
const response = await openai.chat.completions.create({
  model: 'google/gemini-2.5-flash-image',
  messages: [
    {
      role: 'user',
      content: 'Generate a photorealistic image of a sunset over mountains'
    }
  ],
  // CRITICAL: Must include modalities parameter
  modalities: ['image', 'text'],
  temperature: 1.5, // Recommended for creative image generation
  max_tokens: 8000
});
```

#### Free Tier (OpenRouter)

```javascript
model: 'google/gemini-2.5-flash-image-preview:free'
```

**Rate Limit:** 1 request/minute[^6]

### Key Features

1. **10 Aspect Ratios** - Cinematic landscapes to vertical social media[^8]
2. **SynthID Watermarking** - Invisible digital watermark on all images[^4]
3. **Multi-image Blending** - Combine multiple source images[^4]
4. **Conversational Editing** - Multi-turn image refinement[^4]
5. **World Knowledge** - Leverages Gemini's understanding for context-aware generation[^4]

### Aspect Ratio Configuration

```javascript
// Use image_config parameter for aspect ratio control
image_config: {
  aspect_ratio: '16:9' // Options: 1:1, 16:9, 9:16, 4:3, 3:4, etc.
}
```

### Pricing

- **Official API:** $30.00 per 1M output tokens
- **Per Image:** $0.039 (1,290 output tokens per image)[^9]
- **Free Tier:** $0.00 via OpenRouter free models[^6]

### Best Use Cases

✅ Photorealistic scenes and environments
✅ Fast iteration and experimentation
✅ Character consistency across multiple images
✅ Budget-conscious projects (free tier)
✅ Production applications requiring speed

### Limitations

⚠️ Preview models retire October 31, 2025 - migrate to production model[^4]
⚠️ Text rendering less accurate than DALL-E 3[^5]
⚠️ Complex artistic styles may not match DALL-E 3 quality[^2]

---

## OpenAI DALL-E 3

### Model Information

**Model ID:** `dall-e-3`
**Documentation:** https://help.openai.com/en/articles/8555480-dall-e-3-api
**Cookbook:** https://cookbook.openai.com/articles/what_is_new_with_dalle_3

### API Configuration

```javascript
const response = await openai.images.generate({
  model: 'dall-e-3', // MUST specify - defaults to dall-e-2
  prompt: 'A photorealistic portrait of a griffin with detailed feathers',
  size: '1024x1024', // or '1024x1792', '1792x1024'
  quality: 'hd', // or 'standard'
  style: 'vivid', // or 'natural'
  n: 1 // DALL-E 3 only supports n=1
});
```

### Key Parameters

#### size
- **Options:** `'1024x1024'`, `'1024x1792'` (portrait), `'1792x1024'` (landscape)
- **Default:** `'1024x1024'`

#### quality
- **`'standard'`** - Faster generation, lower cost, good quality
- **`'hd'`** - Enhanced detail, finer details, slower generation
- **Use Case:** HD for final renders, standard for iteration[^10]

#### style
- **`'natural'`** - More natural, less hyper-real looking images
- **`'vivid'`** - Hyper-real and dramatic images[^10]
- **Recommendation:** Use 'vivid' for fantasy/sci-fi, 'natural' for realistic scenes

### Rate Limits (2025)

- **Standard Tier:** 5 requests/minute[^10]
- **Enterprise:** Higher limits available
- **Critical:** Only `n=1` supported (one image per request)[^10]

### Pricing

Pricing varies based on quality and size - check OpenAI pricing page for current rates.

### Best Use Cases

✅ Complex artistic styles and compositions
✅ Fantasy and sci-fi themed illustrations
✅ Text rendering within images
✅ Detailed creative prompts
✅ High-fidelity artistic output

### Limitations

⚠️ Slower generation (60+ seconds)[^3]
⚠️ No multi-image blending
⚠️ No conversational editing
⚠️ Higher cost per image
⚠️ Only one image per request

---

## OpenRouter Integration

### Overview

**Documentation:** https://openrouter.ai/docs/features/multimodal/image-generation
**Models Page:** https://openrouter.ai/models?q=gemini

### Configuration

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// Generate image using Gemini
const response = await openai.chat.completions.create({
  model: 'google/gemini-2.5-flash-image',
  messages: [{
    role: 'user',
    content: 'Your prompt here'
  }],
  modalities: ['image', 'text'] // REQUIRED for image generation
});

// Extract base64 image
const imageData = response.choices[0].message.images[0];
// imageData is a base64-encoded data URL (e.g., data:image/png;base64,...)
```

### Free Tier Models

```javascript
// Free image generation (1 request/minute)
model: 'google/gemini-2.5-flash-image-preview:free'

// Free text analysis (unlimited)
model: 'google/gemini-2.0-flash-exp:free'
```

### Rate Limit Handling

```javascript
// Implement automatic retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 10) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        // Rate limit hit - wait 65s for free tier
        const waitTime = attempt === 0 ? 65000 : Math.min(10000 * Math.pow(2, attempt), 120000);
        console.log(`Rate limit hit. Waiting ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}
```

### Response Format

```javascript
{
  choices: [{
    message: {
      content: "I've generated an image...",
      images: [
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." // Base64 PNG
      ]
    }
  }]
}
```

---

## Prompting Best Practices

### Universal Principles (All Models)

#### 1. Be Specific and Detailed

❌ **Bad:** "A dragon"
```
Generate a dragon
```

✅ **Good:** Detailed visual description
```
A majestic red dragon perched on a rocky mountain peak at sunset.
The dragon has iridescent scales that shimmer from crimson to gold in the
fading light. Its wings are spread wide, showing intricate membrane patterns.
Sharp talons grip the weathered stone. In the background, purple storm clouds
gather over distant snow-capped peaks. Photorealistic, cinematic lighting,
8k quality.
```

**Impact:** 67% improvement in creative quality with detailed prompts[^11]

#### 2. Structure Your Prompts

Use this proven template[^12]:

```
[SUBJECT] + [ACTION/POSE] + [ENVIRONMENT/SETTING] + [LIGHTING] +
[MOOD/ATMOSPHERE] + [STYLE/QUALITY MODIFIERS]
```

**Example:**
```
A young sorceress [SUBJECT]
casting a spell with glowing hands [ACTION]
in an ancient library filled with floating books [ENVIRONMENT]
illuminated by magical blue light streaming through stained glass [LIGHTING]
mysterious and enchanting atmosphere [MOOD]
fantasy illustration, highly detailed, trending on ArtStation [STYLE]
```

#### 3. Include Visual Elements

**Essential components to specify:**

- **Colors:** Specific palette or dominant colors
- **Composition:** Rule of thirds, centered, diagonal, etc.
- **Perspective:** Eye-level, bird's eye view, low angle, etc.
- **Depth of field:** Bokeh, sharp focus, shallow/deep DOF
- **Time of day:** Golden hour, blue hour, midday, night
- **Weather conditions:** Fog, rain, clear, stormy
- **Camera settings:** f/1.8, 85mm lens, macro, wide-angle

**Example:**
```
A griffin landing on a rocky outcrop at golden hour, shot with 85mm lens
at f/1.8 creating beautiful bokeh. The background mountains are slightly
out of focus. Warm orange and purple tones dominate the color palette.
Low angle perspective makes the griffin appear majestic and powerful.
```

#### 4. Avoid Common Pitfalls

❌ **Don't:**
- Use vague terms like "beautiful" or "nice" without specifics
- Overcomplicate with contradictory instructions
- Include negative prompts (models handle these inconsistently)
- Mix too many artistic styles

✅ **Do:**
- Choose one clear artistic style
- Use concrete visual descriptors
- Focus on what you want, not what you don't want
- Keep prompt under 300 words for DALL-E 3[^13]

### Model-Specific Prompting

#### Gemini 2.5 Flash Image (Nano Banana)

**Strengths to leverage:**
- **Conversational refinement** - Use follow-up messages to iterate[^4]
- **Multi-image context** - Reference previous generations
- **World knowledge** - Can understand cultural/historical context

**Optimal prompt structure:**
```
[Context/Background] + [Detailed Visual Description] + [Technical Specs]
```

**Example:**
```
Generate a historically accurate Viking longship based on 9th-century designs.
The ship has a distinctive curved prow with a carved dragon head. Twenty oars
line each side. The striped sail (red and white) billows in the wind. The
ship is sailing through choppy North Atlantic waters under overcast skies.
Photorealistic style, dramatic lighting, 16:9 aspect ratio.
```

**Multi-turn refinement:**
```
User: [Initial prompt above]
Gemini: [Generates image]
User: Make the dragon head more ornate with Celtic knotwork patterns
Gemini: [Refines the same image]
User: Add more dramatic storm clouds in the background
Gemini: [Further refinement]
```

#### DALL-E 3

**Strengths to leverage:**
- **Prompt rewriting** - DALL-E 3 automatically enhances prompts[^14]
- **Text rendering** - Best for including readable text
- **Artistic styles** - Excellent with named art movements

**Optimal prompt structure:**
```
[Art Style Reference] + [Subject Description] + [Composition] + [Details]
```

**Example:**
```
Art Nouveau style poster featuring a woman with flowing hair surrounded
by decorative floral patterns. Inspired by Alphonse Mucha. Central
composition with ornate frame. Muted earth tones with gold accents.
The text "EXHIBITION 1925" appears in elegant typography at the bottom.
```

**Style references that work well:**[^15]
- Art movements: Art Nouveau, Impressionism, Cubism, Surrealism
- Artists: "in the style of [artist]" (use sparingly, be respectful)
- Mediums: Oil painting, watercolor, digital art, pencil sketch
- Eras: Victorian, Renaissance, Modern, Contemporary

### Advanced Techniques

#### 1. Layered Descriptions (Gemini)

Build complexity through multiple descriptive layers:

```
Layer 1 - Core subject:
A mechanical clockwork owl

Layer 2 - Materials and details:
Made of polished brass and copper gears, with crystal eyes that glow blue

Layer 3 - Environment:
Perched in a Victorian inventor's workshop filled with blueprints and tools

Layer 4 - Atmosphere:
Warm candlelight creates dramatic shadows, steam from machinery in background

Layer 5 - Technical specs:
Photorealistic, shallow depth of field, 4:3 aspect ratio
```

#### 2. Reference Quality Standards

Include quality benchmarks:

```
Professional photography quality, award-winning composition, featured on
National Geographic, museum-quality rendering, AAA game asset quality
```

**Note:** Use judiciously - overuse can dilute effectiveness[^12]

#### 3. Emotional Direction

Specify the emotional impact:

```
The scene should evoke wonder and curiosity, with a sense of discovery.
The lighting creates an intimate, contemplative mood. The colors suggest
warmth and nostalgia.
```

---

## Parameter Optimization

### Temperature Settings

**Definition:** Controls randomness in generation (0.0 = deterministic, 2.0 = maximum creativity)[^16]

#### Recommended Settings by Use Case

| Use Case | Temperature | Rationale |
|----------|------------|-----------|
| **Photorealistic images** | 0.7-1.0 | Balanced realism with variety[^17] |
| **Creative/Fantasy art** | 1.2-1.8 | Higher creativity, more diverse outputs[^17] |
| **Technical diagrams** | 0.2-0.4 | Consistency and precision[^16] |
| **Iterative refinement** | 0.5-0.7 | Predictable adjustments |
| **Brainstorming concepts** | 1.5-2.0 | Maximum diversity[^11] |

**Research findings (2025):**
- 85% user satisfaction with medium temperature (0.7-0.9)[^11]
- 67% report more innovation at 0.9+ for creative tasks[^11]
- Multimodal LLMs: Use 1.5-2.0 for image generation[^17]

#### Gemini 2.5 Flash Image

```javascript
{
  temperature: 1.5, // Recommended for image generation
  top_p: 0.95,      // Nucleus sampling for diversity
  top_k: 40         // Limit token sampling
}
```

#### DALL-E 3

**Note:** DALL-E 3 does not expose temperature parameter via API. Use `style` parameter instead[^10]:

```javascript
{
  style: 'vivid',   // Higher creativity (≈ higher temperature)
  style: 'natural'  // More controlled (≈ lower temperature)
}
```

### Max Tokens

**Gemini 2.5 Flash Image:**
- **Context length:** 8,000 tokens[^9]
- **Recommended:** 4,000-8,000 tokens for complex scenes
- **Minimum:** 2,000 tokens for simple images

```javascript
{
  max_tokens: 8000 // Full model capacity
}
```

**DALL-E 3:**
- Token limits managed internally
- Focus on prompt length (< 300 words optimal)[^13]

### Response Format (Gemini via OpenRouter)

```javascript
{
  response_format: { type: 'json_object' }, // For metadata
  modalities: ['image', 'text']             // REQUIRED for images
}
```

---

## Quality Comparison Matrix

### Generation Quality by Category

| Category | DALL-E 3 | Gemini 2.5 Flash | Winner |
|----------|----------|------------------|--------|
| **Prompt Fidelity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ | DALL-E 3[^7] |
| **Photorealism** | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐⭐ | Gemini[^1] |
| **Artistic Rendering** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ | DALL-E 3[^2] |
| **Text Rendering** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ | DALL-E 3[^5] |
| **Speed** | ⭐⭐☆☆☆ | ⭐⭐⭐⭐⭐ | Gemini[^3] |
| **Multi-Image Editing** | ⭐☆☆☆☆ | ⭐⭐⭐⭐⭐ | Gemini[^4] |
| **Character Consistency** | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐⭐ | Gemini[^4] |
| **Cost (Free Tier)** | ❌ | ✅ | Gemini[^6] |

### Benchmark Results

**Photorealism Test (2025):**[^1]
- Gemini 2.5: 92% accuracy in realistic details
- DALL-E 3: 87% accuracy

**Prompt Adherence Test:**[^7]
- DALL-E 3: 94% prompt element inclusion
- Gemini 2.5: 89% prompt element inclusion

**Text Rendering Accuracy:**[^5]
- DALL-E 3: 96% readable text
- Gemini 2.5: 78% readable text

**Generation Speed:**[^3]
- Gemini 2.5: < 5 seconds average
- DALL-E 3: 60+ seconds average

---

## Cost Analysis

### Per-Image Cost Comparison

| Model | Quality | Cost per Image | Free Tier |
|-------|---------|----------------|-----------|
| **Gemini 2.5 Flash** | Standard | $0.039[^9] | ✅ Yes (OpenRouter) |
| **DALL-E 3** | Standard | ~$0.040-0.080 | ❌ No |
| **DALL-E 3** | HD | ~$0.080-0.120 | ❌ No |

### Volume Pricing

**100 images:**
- Gemini free tier: $0.00 (100 minutes = 1.67 hours)
- Gemini paid: $3.90
- DALL-E 3 standard: $4.00-8.00
- DALL-E 3 HD: $8.00-12.00

**1,000 images:**
- Gemini free tier: $0.00 (1,000 minutes = 16.67 hours)
- Gemini paid: $39.00
- DALL-E 3 standard: $40.00-80.00

### ROI Recommendations

**For prototyping/iteration:**
→ Use Gemini free tier (unlimited experimentation)

**For production (< 1000 images/month):**
→ Gemini paid API ($39/month for 1,000 images)

**For production (high volume + quality):**
→ Consider hybrid: Gemini for iteration, DALL-E 3 for finals

**For artistic projects:**
→ DALL-E 3 may justify higher cost with superior artistic quality

---

## Implementation Examples

### Complete Gemini Image Generation

```javascript
import OpenAI from 'openai';
import fs from 'fs/promises';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

async function generateImage(prompt, options = {}) {
  const {
    aspectRatio = '16:9',
    temperature = 1.5,
    useFree = true
  } = options;

  const model = useFree
    ? 'google/gemini-2.5-flash-image-preview:free'
    : 'google/gemini-2.5-flash-image';

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      modalities: ['image', 'text'],
      temperature,
      max_tokens: 8000,
      image_config: {
        aspect_ratio: aspectRatio
      }
    });

    // Extract base64 image
    const imageBase64 = response.choices[0].message.images[0];

    // Remove data URL prefix
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Save to file
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile('output.png', buffer);

    return {
      success: true,
      imagePath: 'output.png',
      description: response.choices[0].message.content
    };

  } catch (error) {
    if (error.status === 429) {
      console.log('Rate limit hit. Wait 65s and retry.');
      throw new Error('RATE_LIMIT');
    }
    throw error;
  }
}

// Usage
const result = await generateImage(
  'A mystical forest at twilight with bioluminescent mushrooms and fireflies',
  {
    aspectRatio: '16:9',
    temperature: 1.7,
    useFree: true
  }
);
```

### Complete DALL-E 3 Generation

```javascript
import OpenAI from 'openai';
import https from 'https';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateImageDALLE(prompt, options = {}) {
  const {
    size = '1024x1024',
    quality = 'standard',
    style = 'vivid'
  } = options;

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size,
      quality,
      style,
      n: 1
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt;

    // Download image
    await downloadImage(imageUrl, 'output.png');

    return {
      success: true,
      imagePath: 'output.png',
      originalPrompt: prompt,
      revisedPrompt // DALL-E 3 may enhance your prompt
    };

  } catch (error) {
    throw error;
  }
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const stream = fs.createWriteStream(filepath);
      response.pipe(stream);
      stream.on('finish', () => {
        stream.close();
        resolve();
      });
    }).on('error', reject);
  });
}

// Usage
const result = await generateImageDALLE(
  'A steampunk airship floating above a Victorian city at sunset, ' +
  'with intricate brass details and billowing steam. Cinematic lighting.',
  {
    size: '1792x1024',
    quality: 'hd',
    style: 'vivid'
  }
);
```

---

## Prompt Templates

### Template 1: Character Portrait

```
[CHARACTER TYPE] portrait with [DISTINCTIVE FEATURES].
[EXPRESSION/EMOTION] expression.
Wearing [CLOTHING/ACCESSORIES].
[BACKGROUND DESCRIPTION].
Shot with [CAMERA SPECS], [LIGHTING TYPE].
[ARTISTIC STYLE], [QUALITY MODIFIERS].

Example:
Elven warrior portrait with silver braided hair and piercing green eyes.
Confident yet gentle expression.
Wearing ornate leather armor with Celtic engravings.
Forest background with dappled sunlight through leaves.
Shot with 85mm lens at f/1.4, natural golden hour lighting.
Fantasy realism, highly detailed, award-winning character design.
```

### Template 2: Environmental Scene

```
[LOCATION/SETTING] showing [KEY ELEMENTS].
[TIME OF DAY] with [WEATHER/ATMOSPHERIC CONDITIONS].
[FOREGROUND ELEMENTS] lead to [BACKGROUND ELEMENTS].
Color palette: [DOMINANT COLORS].
[PERSPECTIVE/ANGLE], [COMPOSITION STYLE].
[MOOD/ATMOSPHERE].
[TECHNICAL SPECS].

Example:
Ancient ruins of a Mayan temple showing moss-covered stone pyramids and carved glyphs.
Dawn with mystical fog rolling through the jungle.
Overgrown stone steps in foreground lead to towering pyramid in background.
Color palette: deep greens, golden sunrise, stone grays.
Low angle perspective, rule of thirds composition.
Mysterious and awe-inspiring atmosphere.
Photorealistic, 16:9 aspect ratio, National Geographic quality.
```

### Template 3: Action Scene

```
[SUBJECT] performing [ACTION] in [LOCATION].
[MOTION DESCRIPTION] with [DYNAMIC ELEMENTS].
[ENVIRONMENTAL INTERACTION].
[LIGHTING] creating [DRAMATIC EFFECT].
[COMPOSITION] emphasizing [FOCAL POINT].
[MOOD/ENERGY].
[STYLE], [QUALITY].

Example:
Dragon breathing fire while swooping over a medieval castle.
Wings creating powerful downward motion with particles and debris swirling.
Flames illuminate the stone battlements and fleeing soldiers below.
Dramatic sunset backlighting creating epic silhouette.
Diagonal composition emphasizing the dragon's descent.
Intense and cinematic energy.
Fantasy illustration, movie poster quality, trending on ArtStation.
```

### Template 4: Product/Object Focus

```
[OBJECT] shown from [ANGLE/PERSPECTIVE].
Made of [MATERIALS] with [SURFACE QUALITIES].
[DISTINCTIVE FEATURES/DETAILS].
Placed on/in [SURFACE/ENVIRONMENT].
[LIGHTING SETUP] highlighting [KEY ASPECTS].
Color scheme: [COLORS].
[STYLE], [QUALITY LEVEL].

Example:
Ornate clockwork pocket watch shown from slightly above.
Made of polished gold and silver with intricate gear mechanisms visible through crystal face.
Roman numerals, delicate filigree patterns, tiny rubies as hour markers.
Placed on rich burgundy velvet fabric.
Studio lighting with soft shadows highlighting the metallic surfaces and depth.
Color scheme: warm golds, cool silvers, deep red accents.
Product photography style, luxury catalog quality, 4K resolution.
```

---

## Common Issues & Solutions

### Issue: Inconsistent Results

**Symptoms:**
- Same prompt generates wildly different images
- Cannot reproduce desired style

**Solutions:**
1. **Lower temperature** (0.5-0.7 instead of 1.5-2.0)
2. **More specific style references**
3. **Lock in successful prompts** - save exact wording
4. **Use seeds** (if available in future updates)

### Issue: Poor Prompt Adherence

**Symptoms:**
- Generated image missing key elements
- Wrong colors or composition

**Solutions:**
1. **Simplify the prompt** - fewer competing elements
2. **Prioritize elements** - mention most important first
3. **Use Gemini's multi-turn** - refine in conversation
4. **Break complex scenes** - generate elements separately

### Issue: Rate Limits (Free Tier)

**Symptoms:**
- 429 errors every minute
- Long wait times

**Solutions:**
1. **Implement automatic retry** with 65s backoff[^6]
2. **Batch processing** - queue prompts and process sequentially
3. **Parallel generation** - use multiple API keys (if terms allow)
4. **Upgrade to paid tier** for higher limits

```javascript
// Automatic rate limit handling
async function generateWithRetry(prompt, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateImage(prompt);
    } catch (error) {
      if (error.message === 'RATE_LIMIT' && i < maxRetries - 1) {
        console.log(`Rate limit ${i+1}/${maxRetries}. Waiting 65s...`);
        await sleep(65000);
        continue;
      }
      throw error;
    }
  }
}
```

### Issue: Text Rendering Failures

**Symptoms:**
- Garbled or misspelled text in images
- Text doesn't appear at all

**Solutions:**
1. **Use DALL-E 3** for text-heavy images[^5]
2. **Keep text short** (< 10 words)
3. **Specify font style** ("bold sans-serif", "elegant script")
4. **Separate text request** in prompt structure

**DALL-E 3 text example:**
```
A vintage travel poster with the text "PARIS 1925" in bold Art Deco
typography at the top. The Eiffel Tower dominates the composition.
The text is clear, crisp, and professionally typeset.
```

### Issue: Watermark/Logo Removal

**Note:** All Gemini 2.5 Flash images include SynthID watermark[^4]

**Solutions:**
- Watermark is invisible to humans
- Watermark is for attribution/detection
- Cannot be removed (intentional by design)
- Not an issue for most use cases

---

## Workflow Recommendations

### For Book Illustration (Current Use Case)

```javascript
// Optimal workflow for imaginize project

// Phase 1: Text analysis (FREE)
const textModel = 'google/gemini-2.0-flash-exp:free';
const concepts = await analyzeChapter(text, textModel);

// Phase 2: Image generation (FREE with rate limit handling)
const imageModel = 'google/gemini-2.5-flash-image-preview:free';
const images = [];

for (const concept of concepts) {
  const prompt = buildBookIllustrationPrompt(concept);

  // Retry with automatic 65s backoff
  const image = await generateWithRetry(prompt, {
    model: imageModel,
    temperature: 1.5, // Creative but consistent
    aspectRatio: '16:9' // Cinematic book illustrations
  });

  images.push(image);

  // Respect rate limit
  await sleep(65000);
}
```

### Optimal Prompt Builder for Book Illustrations

```javascript
function buildBookIllustrationPrompt(concept) {
  const {
    quote,       // Source text excerpt
    description, // Visual elements
    mood,        // Emotional atmosphere
    lighting,    // Time of day/lighting
    chapter      // Chapter title for context
  } = concept;

  return `
Book illustration for chapter "${chapter}":

Scene: ${description}

Mood and atmosphere: ${mood}
Lighting: ${lighting}

Style: Professional book illustration, detailed and immersive, suitable for
young adult fantasy novel. Cinematic composition, rich colors, painterly
quality reminiscent of award-winning fantasy book covers.

Technical: 16:9 aspect ratio, high detail, publication quality.
  `.trim();
}
```

### Quality Assurance Checklist

Before finalizing images:

- [ ] **Prompt specificity:** All key visual elements mentioned?
- [ ] **Style consistency:** Same style markers across all prompts?
- [ ] **Technical specs:** Aspect ratio, quality level specified?
- [ ] **Mood alignment:** Atmosphere matches chapter tone?
- [ ] **Character consistency:** Character descriptions match across chapters?
- [ ] **Rate limit buffer:** 65s between free tier requests?
- [ ] **Error handling:** Retry logic in place?
- [ ] **Output validation:** Images saved correctly with proper naming?

---

## Future-Proofing

### Model Migration Timeline

**October 31, 2025:** Preview models retire[^4]

```javascript
// OLD (will stop working)
model: 'google/gemini-2.5-flash-image-preview'
model: 'google/gemini-2.0-flash-preview-image-generation'

// NEW (use these)
model: 'google/gemini-2.5-flash-image' // Production-ready
model: 'google/gemini-2.5-flash-image-preview:free' // Free tier
```

### Monitoring OpenRouter Updates

Check for new features:
- **Image editing capabilities** (may be added)
- **Higher resolution options**
- **New aspect ratios**
- **Faster generation times**

**Update strategy:**
1. Subscribe to OpenRouter changelog
2. Test new features in development first
3. Update production code after validation
4. Document breaking changes

---

## References

[^1]: WeblineIndia (2025). "AI Image Generation in 2025: DALL-E vs Gemini (with NanoBanana) vs Stable Diffusion". https://www.weblineindia.com/blog/ai-image-generation-dalle-vs-gemini-vs-stable-diffusion/

[^2]: Analytics Vidhya (2024). "Imagen 3 vs DALL-E 3: Which is the Better Model for Images?" https://www.analyticsvidhya.com/blog/2024/12/imagen-3-vs-dalle-3/

[^3]: ChatSmith.io (2025). "Gemini 2.5 vs DALL·E 3: Who Wins the AI Image War?" https://chatsmith.io/blogs/gemini-2-5-vs-dall-e-3

[^4]: Google Developers Blog (2025). "Introducing Gemini 2.5 Flash Image, our state-of-the-art image model". https://developers.googleblog.com/en/introducing-gemini-2-5-flash-image/

[^5]: Medium - Generative Artwork (2024). "A direct comparison of GPT4/DALL-E 3 and Gemini Advanced/BARD". https://medium.com/generative-artwork-by-robert-lavigne/a-direct-comparison-of-gpt4-dall-e-3-and-gemini-advanced-bard-fcdff11171c6

[^6]: OpenRouter Documentation (2025). "Image Generation | Complete Documentation". https://openrouter.ai/docs/features/multimodal/image-generation

[^7]: Cursor IDE Blog (2025). "OpenAI Image Generation API Guide 2025: DALL-E 3 to GPT-4o Evolution". https://www.cursor-ide.com/blog/openai-image-generation-api-guide-2025

[^8]: Google Developers Blog (2025). "Gemini 2.5 Flash Image now ready for production with new aspect ratios". https://developers.googleblog.com/en/gemini-2-5-flash-image-now-ready-for-production-with-new-aspect-ratios/

[^9]: LaoZhang AI (2025). "Gemini 2.5 Flash Image API: Complete Guide & Cost Analysis 2025". https://blog.laozhang.ai/api-guides/gemini-25-flash-image-api/

[^10]: OpenAI Help Center (2024). "DALL·E 3 API". https://help.openai.com/en/articles/8555480-dall-e-3-api

[^11]: MoldStud (2025). "The Ultimate Guide to Prompt Engineering - Temperature & Parameter Optimization for AI Success". https://moldstud.com/articles/p-the-ultimate-guide-to-prompt-engineering-temperature-parameter-optimization-for-ai-success

[^12]: Google AI for Developers (2025). "Prompt design strategies | Gemini API". https://ai.google.dev/gemini-api/docs/prompting-strategies

[^13]: OpenAI Developer Community (2023). "Long or Short Prompt, which is better for dall-e-3 model?" https://community.openai.com/t/long-or-short-prompt-which-is-better-for-dall-e-3-model/578696

[^14]: OpenAI Cookbook (2024). "What's new with DALL·E 3?" https://cookbook.openai.com/articles/what_is_new_with_dalle_3

[^15]: OpenAI Developer Community (2023). "Collection of Dall-E 3 prompting tips, issues and bugs". https://community.openai.com/t/collection-of-dall-e-3-prompting-tips-issues-and-bugs-simplified/994822

[^16]: Analytics Vidhya (2024). "What is Temperature in prompt engineering?" https://www.analyticsvidhya.com/blog/2024/07/temperature-in-prompt-engineering/

[^17]: Medium - Egop Gogo-Job (2024). "Prompt Engineering Explained: Understanding Top-K, Top-P, Temperature, and Advanced Techniques". https://medium.com/@egopgogojob/prompt-engineering-explained-understanding-top-k-top-p-temperature-and-advanced-techniques-b7ae7fa49fda

---

## Document History

**Version 1.0** - November 2025
- Initial compilation
- Research from 18 authoritative sources
- Covers Google Gemini 2.5 Flash Image (Nano Banana) and OpenAI DALL-E 3
- Includes OpenRouter integration guide
- Complete prompting best practices
- Parameter optimization guidelines

**Maintained by:** illustrate/imaginize project
**Next Review:** January 2026 (or when major model updates released)

---

*This style guide is a living document. Contributions and updates welcome as models evolve.*
