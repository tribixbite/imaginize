# Nano Banana (Gemini 2.5 Flash Image) - LLM Prompting Guide

**Model:** `gemini-2.5-flash-image` (Google Gemini API)
**Colloquial Name:** Nano Banana 🍌
**Type:** Autoregressive image generation (1,290 tokens/image)
**Cost:** ~$0.04/image (1 megapixel, e.g. 1024x1024)
**Context Window:** 32,768 tokens

## Quick Reference

### API Endpoint
```
Model ID: gemini-2.5-flash-image
Provider: Google Gemini API
Generation Time: ~30 seconds/image (autoregressive)
No watermark when using API directly
```

### Key Advantages Over Other Models
1. **Extreme prompt adherence** - Best-in-class for following complex, nuanced requirements
2. **Large context window** - 32K tokens vs. T5's 512 or CLIP's 77
3. **Multimodal encoder** - Trained on Markdown, JSON, code, structured data
4. **Subject consistency** - Can maintain character appearance across generations without LoRA training
5. **Multi-image input** - Can reference multiple input images for context

---

## Core Prompt Engineering Principles

### 1. Use Markdown Lists for Requirements

**Why:** Nano Banana's text encoder is trained on Markdown (for agentic coding pipelines)

**Pattern:**
```
Create an image with the following requirements:
- Requirement 1
- Requirement 2
  - Sub-requirement 2a
- Requirement 3
```

**Example:**
```
Create an image featuring three specific kittens in three specific positions.

All of the kittens MUST follow these descriptions EXACTLY:
- Left: a kitten with prominent black-and-silver fur, wearing both blue denim overalls and a blue plain denim baseball hat.
- Middle: a kitten with prominent white-and-gold fur and prominent gold-colored long goatee facial hair, wearing a 24k-carat golden monocle.
- Right: a kitten with prominent #9F2B68-and-#00FF00 fur, wearing a San Francisco Giants sports jersey.
```

### 2. Capitalize MUST/NEVER for Critical Constraints

**Why:** Caps improve adherence (confirmed by leaked system prompt: "YOU WILL BE PENALIZED")

**Pattern:**
```
The image MUST include X.
The composition MUST follow Y.
NEVER include watermarks or text overlays.
```

**Best Practices:**
- Use `MUST` for requirements that cannot be violated
- Use `NEVER` for explicit exclusions
- Use `EXACTLY` for precision requirements
- Don't overuse - reserve for truly critical constraints

### 3. Leverage Professional Photography Buzzwords

**Why:** Nano Banana trained on extensive annotated image datasets (Google Images)

**Effective Buzzwords:**
- `Pulitzer Prize-winning cover photo for The New York Times`
- `Shot with a Canon EOS 90D DSLR camera`
- `Vanity Fair cover profile`
- `4K HD for MKBHD video`
- `Neutral diffuse lighting`
- `Rule of thirds composition`

**Example:**
```
The image is a Pulitzer Prize-winning cover photo for The New York Times with neutral diffuse 3PM lighting for both the subjects and background that complement each other.
```

**Note:** System prompt contains guard against 2022-era AI buzzwords:
- Avoid: `trending on artstation`, `award-winning` (alone), `hyperrealistic` (alone)
- These may trigger anti-model-collapse heuristics

### 4. Use Hex Colors for Precision

**Why:** Nano Banana can parse and render specific hex color codes accurately

**Pattern:**
```
- A kitten with prominent #9F2B68-and-#00FF00 fur
- Background color: #1A1A1A
```

### 5. Specify Physical/Compositional Details for Photorealism

**Why:** Forces model toward photorealistic generation vs. digital illustration

**Pattern:**
```
The photo is taken with a Canon EOS 90D DSLR camera for a [Publication] with:
- Real-world natural lighting
- Real-world natural uniform depth of field (DOF)
- Natural uniform depth of field
- [Specific camera angle, e.g. "rotated 20 degrees"]
- Complete body visible in frame
```

**Anti-Illustration Constraints:**
- Specify camera model and settings
- Mention "real-world" lighting and DOF
- Reference physical photography concepts
- Include natural imperfections

### 6. Use JSON for Extremely Granular Control

**Why:** Nano Banana's base encoder trained on JSON (for structured output/function calling)

**Pattern:**
```
Generate a photo featuring the specified person. Do not include any logos, text, or watermarks.
---
{
  "gender": "male",
  "age": 30,
  "build": {
    "overall": "athletic, muscular",
    "height": "6'2\"",
    "shoulder_width": "broad"
  },
  "face": {
    "shape": "angular, defined jawline",
    "eyes": {
      "color": "#4A7C59",
      "size": "medium",
      "expression": "intense"
    },
    "hair": {
      "color": "#2C1810",
      "style": "short, tousled",
      "volume": "medium-high"
    }
  },
  "clothing": {
    "top": "tailored emerald green silk doublet with chrome shoulderplates",
    "bottom": "black leather pants with silver buckles"
  },
  "pose": "standing, right hand on hilt of cutlass, left hand holding golden espresso tamper aloft"
}
```

**Best Practices for JSON Prompting:**
- Keep structure logical and hierarchical
- Use descriptive keys (`shoulder_width` not `sw`)
- Combine with photography buzzwords for best results
- Can include 2000+ tokens of detail

---

## Advanced Techniques

### Multi-Image Subject Consistency

**Pattern:**
```
Create an image of the character in all the user-provided images [doing X].
```

**Best Practices:**
- Provide 2-17 reference images for best results
- More images = better consistency
- Images should show different angles/poses of subject
- Works without LoRA training

**Example:**
```
Create an image of the character in all the user-provided images smiling with their mouth open while shaking hands with President Barack Obama.

The image is a Pulitzer Prize-winning cover photo for The New York Times. Do not include any text or watermarks.
```

### Image Editing (Multiple Simultaneous Edits)

**Pattern:**
```
Make ALL of the following edits to the image:
- Edit 1
- Edit 2
- Edit 3
- Edit 4
- Edit 5
```

**Best Practices:**
- Can handle 5+ simultaneous edits
- Uses "Make ALL of the following edits" not just "Edit"
- Each edit should be independent
- Nano Banana changes only what's necessary

**Example:**
```
Make ALL of the following edits to the image:
- Put a strawberry in the left eye socket.
- Put a blackberry in the right eye socket.
- Put a mint garnish on top of the pancake.
- Change the plate to a plate-shaped chocolate-chip cookie.
- Add happy people to the background.
```

### Heterochromia and Complex Attribute Deduction

**Pattern:**
```
All kittens MUST have heterochromatic eye colors matching their two specified fur colors.
```

**Why This Works:**
- Nano Banana can deduce attribute relationships from earlier in prompt
- Model maintains state across long prompts (32K context)
- Can cross-reference multiple specifications

### Text Generation in Images

**Capability:** Nano Banana can generate relevant code, typography, and text within images

**Pattern:**
```
Create an image depicting a minimal recursive Python implementation `fib()` of the Fibonacci sequence using many large refrigerator magnets:
- The magnets are placed on top of an expensive aged wooden table.
- All code characters MUST EACH be colored according to standard Python syntax highlighting.
- All code characters MUST follow proper Python indentation and formatting.
```

**Note:** Text won't be perfect but will be semantically appropriate

### HTML/Web Page Rendering

**Capability:** Can render single-page HTML/CSS/JS as visual mockups

**Pattern:**
```
Create a rendering of the webpage represented by the provided HTML, CSS, and JavaScript. The rendered webpage MUST take up the complete image.
---
<!DOCTYPE html>
<html>
...
</html>
```

**Use Cases:**
- UI mockups from code
- Visual representations of web layouts
- Design prototyping

---

## Common Patterns & Templates

### High-Quality Character Portrait

```
Generate a photo featuring a closeup of the specified human person. The person is standing rotated 20 degrees making their signature pose and their complete body is visible in the photo. The photo is taken with a Canon EOS 90D DSLR camera for a Vanity Fair cover profile with real-world natural lighting and real-world natural uniform depth of field (DOF). Do not include any logos, text, or watermarks.

The person MUST have:
- [Physical attributes]
- [Clothing details]
- [Pose/expression]
```

### Complex Multi-Subject Composition

```
Create an image featuring [N] specific [subjects] in [N] specific positions.

All of the [subjects] MUST follow these descriptions EXACTLY:
- Position 1: [detailed description]
- Position 2: [detailed description]
- Position 3: [detailed description]

Aspects of the image composition that MUST be followed EXACTLY:
- All [subjects] MUST be positioned according to the "rule of thirds" both horizontally and vertically.
- [Additional compositional rules]
- The image is a [professional photography reference]
- NEVER include any text, watermarks, or line overlays.
```

### Editorial/News Photography

```
Create a [photo/image] featuring [subject].

Compositional requirements:
- [Rule of thirds/negative space/etc.]
- [Specific camera angle]
- [Lighting conditions]

The image is a Pulitzer Prize-winning cover photo for The New York Times with neutral diffuse lighting. Do not include any text or watermarks.
```

### Product/Object Photography

```
Create an image of [object] with the following specifications:
- [Material/texture details]
- [Color specifications with hex codes]
- [Size/proportion details]

Environment:
- Placed on/in [setting]
- Shot from [angle/perspective]
- Lighting: [type and quality]

The photo is taken with a Canon EOS 90D DSLR camera with real-world natural lighting. Do not include watermarks.
```

---

## Anti-Patterns & Limitations

### ❌ Don't: Style Transfer

**Problem:** Nano Banana is terrible at style transfers
**Why:** Autoregressive properties make it resistant to changing existing styles

**Instead:**
- Generate new image in target style
- Create new image with character from input using specified style
- Don't try to convert photo → illustration

### ❌ Don't: Expect Perfect Text Rendering

**Problem:** Text in images will have typos/imperfections
**Reality:** Text will be semantically appropriate but not pixel-perfect

**Mitigation:**
- Use for conceptual/mockup purposes
- Post-process text with traditional editing tools
- Don't rely on text-heavy image generations for final output

### ❌ Don't: Assume IP Protection

**Problem:** Nano Banana has essentially no IP restrictions
**Reality:** Can generate copyrighted characters, logos, brands

**Legal Note:**
- Can generate multiple IPs in single image
- Brand logos render accurately
- User responsible for copyright compliance
- Specifying "do not include watermarks" doesn't absolve IP issues

### ❌ Don't: Expect Strong NSFW Moderation

**Problem:** Nano Banana is surprisingly lenient
**Reality:** More lenient than ChatGPT/Midjourney

**Mitigation:**
- Implement your own content moderation
- Use Google's safety settings if building applications
- Moderate both prompts and generated images

---

## Configuration & API Usage

### Gemini API Setup

```python
# Using gemimg wrapper (recommended)
from gemimg import GemImg

g = GemImg(api_key="AI...")
g.generate("A kitten with prominent purple-and-green fur.")
```

### Direct API Call

```python
import google.generativeai as genai

genai.configure(api_key="AI...")
model = genai.GenerativeModel('gemini-2.5-flash-image')

response = model.generate_content([
    "Create an image of...",
    {
        "mime_type": "image/png",
        "data": base64_image_data  # Optional: for editing/reference
    }
])
```

### Generation Parameters

```python
generation_config = {
    "temperature": 1.0,  # Creativity (0.0-2.0)
    "top_p": 0.95,       # Nucleus sampling
    "top_k": 40,         # Top-k sampling
    "max_output_tokens": 8192,
}

# Aspect ratios
# Square: 1:1 (1024x1024)
# Landscape: 16:9, 4:3
# Portrait: 9:16, 3:4
```

### Safety Settings (for applications)

```python
safety_settings = [
    {
        "category": "HARM_CATEGORY_HARASSMENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    }
]
```

---

## Performance Characteristics

**Generation Speed:**
- ~30 seconds per image (autoregressive)
- Slower than diffusion models (FLUX: ~5-10s)
- Comparable to gpt-image-1

**Token Usage:**
- 1,290 tokens per image generated
- Context window: 32,768 tokens (plenty for complex prompts)
- Can include 2000+ token JSON specifications

**Cost Efficiency:**
- $0.04/image (1MP resolution)
- Cheaper than gpt-image-1 ($0.17/image)
- Comparable to FLUX.1-dev pricing

**Quality vs. Speed Tradeoff:**
- Autoregressive = slower but better prompt adherence
- Diffusion = faster but weaker prompt following
- Choose based on use case requirements

---

## Integration Recommendations for Imaginize

### Configuration Addition

```typescript
// Add to imaginize config
interface ImageConfig {
  provider: 'openai' | 'replicate' | 'gemini-nano-banana'
  model?: string
  endpoint?: string

  // Nano Banana specific
  nanoBanana?: {
    useMarkdownLists: boolean  // Default: true
    usePhotographyBuzzwords: boolean  // Default: true
    enforcePhysicality: boolean  // For photorealism, default: false
    jsonStructuredPrompts: boolean  // Default: false
  }
}
```

### Prompt Template for Scene Generation

```typescript
const scenePromptTemplate = `
Create a photorealistic image of the following scene from the book.

Scene Description:
- Setting: {{setting}}
- Characters present: {{characters}}
- Action: {{action}}
- Mood: {{mood}}

Compositional Requirements:
- The image MUST follow the rule of thirds composition
- Lighting: {{lighting}}
- Camera angle: {{cameraAngle}}

The image is a high-quality editorial photo taken with a Canon EOS 90D DSLR camera with real-world natural lighting and uniform depth of field. NEVER include any text, watermarks, or overlays.

Character Details:
{{#each characters}}
- {{name}}: {{description}}
{{/each}}
`
```

### Flag Implementation

```bash
# CLI flag
imaginize --images --provider gemini-nano-banana --file book.epub

# Or in config
{
  "imageGeneration": {
    "provider": "gemini-nano-banana",
    "endpoint": "gemini-2.5-flash-image"
  }
}
```

---

## Testing Checklist

When implementing Nano Banana, test with:

1. ✅ **Simple prompt** - Basic subject generation
2. ✅ **Complex multi-subject** - Multiple entities with specific attributes
3. ✅ **Hex colors** - Verify color accuracy
4. ✅ **Heterochromia test** - Cross-reference attributes
5. ✅ **Multi-image consistency** - Character consistency across scenes
6. ✅ **Editing** - Multiple simultaneous edits
7. ✅ **Photography buzzwords** - Verify composition improvements
8. ✅ **JSON structured prompts** - Granular control
9. ✅ **Markdown lists** - Requirement adherence
10. ✅ **MUST/NEVER caps** - Constraint enforcement

---

## Comparison with Other Models

| Feature | Nano Banana | gpt-image-1 | FLUX.1-dev | Stable Diffusion 3 |
|---------|-------------|-------------|------------|-------------------|
| Prompt Adherence | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Speed | ⭐⭐ (30s) | ⭐⭐ (30s) | ⭐⭐⭐⭐ (5-10s) | ⭐⭐⭐⭐⭐ (2-5s) |
| Cost | ⭐⭐⭐⭐ ($0.04) | ⭐⭐ ($0.17) | ⭐⭐⭐ (~$0.05) | ⭐⭐⭐⭐⭐ (free/cheap) |
| Context Window | ⭐⭐⭐⭐⭐ (32K) | ⭐⭐⭐⭐ (?) | ⭐⭐ (512) | ⭐ (77) |
| Multi-image Input | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ | ❌ |
| Style Transfer | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Subject Consistency | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ (needs LoRA) | ⭐⭐ (needs LoRA) |

**Use Nano Banana when:**
- Extreme prompt adherence is critical
- Need subject consistency without LoRA training
- Working with complex multi-entity scenes
- Need structured (JSON/Markdown) prompt support
- Can tolerate 30s generation time

**Use alternatives when:**
- Need very fast generation (FLUX, SD)
- Need style transfer (FLUX, SD)
- Need completely free tier (SD local)
- Building high-volume applications (cost matters)

---

## References

- [Nano Banana Blog Post](https://minimaxir.com/2025/11/nano-banana/) - Max Woolf
- [gemimg Python Package](https://github.com/minimaxir/gemimg)
- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)

---

**Last Updated:** 2025-11-20
**Document Version:** 1.0.0
