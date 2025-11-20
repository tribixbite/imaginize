/**
 * Nano Banana PRO (Gemini 3 Pro Image) Prompt Enhancer
 * Optimizes prompts for studio-quality image generation with Gemini 3
 *
 * Released: November 20, 2025
 * Features: Text rendering, 2K/4K resolution, multi-object blending,
 *          professional controls (lighting, camera, focus, color grading)
 *
 * @see docs/NANO-BANANA-PRO-GUIDE.md
 */

export interface NanoBananaConfig {
  /** Use markdown bullet lists for requirements (recommended) */
  useMarkdownLists?: boolean;

  /** Add professional photography buzzwords for quality enhancement */
  usePhotographyBuzzwords?: boolean;

  /** Enforce physical realism constraints (for photorealistic scenes) */
  enforcePhysicality?: boolean;

  /** Convert prompts to JSON structure (experimental) */
  useJsonPrompts?: boolean;

  /** Specify exact hex colors for color control */
  useHexColors?: boolean;
}

/**
 * Enhance a scene description for Nano Banana optimization
 */
export function enhanceForNanoBanana(
  description: string,
  config: NanoBananaConfig = {}
): string {
  const {
    useMarkdownLists = true,
    usePhotographyBuzzwords = true,
    enforcePhysicality = false,
    useJsonPrompts = false,
    useHexColors = false,
  } = config;

  let enhanced = description;

  // Convert to markdown list format
  if (useMarkdownLists && !description.includes('- ')) {
    enhanced = convertToMarkdownList(description);
  }

  // Add photography buzzwords for quality
  if (usePhotographyBuzzwords) {
    enhanced = addPhotographyContext(enhanced);
  }

  // Add physicality constraints
  if (enforcePhysicality) {
    enhanced = addPhysicalityConstraints(enhanced);
  }

  // Convert to JSON structure (experimental)
  if (useJsonPrompts) {
    return convertToJsonPrompt(enhanced);
  }

  return enhanced;
}

/**
 * Convert prose description to markdown bullet list
 * Nano Banana's text encoder is optimized for structured data
 */
function convertToMarkdownList(description: string): string {
  // Split into sentences/clauses
  const parts = description
    .split(/[.;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (parts.length <= 1) {
    return description; // Too short to benefit from list format
  }

  // Build markdown list
  const header = 'Create an image with the following elements:\n\n';
  const listItems = parts.map((part) => `- ${part}`).join('\n');

  return header + listItems;
}

/**
 * Add professional photography buzzwords
 * These trigger quality enhancement in Nano Banana
 */
function addPhotographyContext(description: string): string {
  // Photography context options (rotate for variety)
  const contexts = [
    'Shot with a Canon EOS 90D DSLR camera with a shallow depth of field',
    'Professional photography, award-winning composition',
    'Pulitzer Prize-winning cover photo quality',
    'Vanity Fair cover profile photography style',
    'National Geographic quality, expertly composed',
  ];

  // Choose context based on description content
  let context = contexts[0]; // Default

  if (description.toLowerCase().includes('portrait')) {
    context = contexts[3]; // Vanity Fair style for portraits
  } else if (description.toLowerCase().includes('nature') || description.toLowerCase().includes('landscape')) {
    context = contexts[4]; // National Geographic for nature
  } else if (description.toLowerCase().includes('dramatic') || description.toLowerCase().includes('intense')) {
    context = contexts[2]; // Pulitzer Prize for dramatic scenes
  }

  // Add at the end to preserve main description
  return `${description}\n\n${context}.`;
}

/**
 * Add physicality constraints to prevent impossible features
 */
function addPhysicalityConstraints(description: string): string {
  const constraints = [
    'The image MUST follow physical laws and anatomical correctness',
    'NEVER include impossible body proportions or physics-defying elements',
    'Maintain realistic lighting and shadow physics',
  ];

  const constraintText = constraints.map((c) => `- ${c}`).join('\n');

  return `${description}\n\nConstraints:\n${constraintText}`;
}

/**
 * Convert prompt to JSON structure (experimental)
 * Nano Banana's text encoder is trained on JSON data
 */
function convertToJsonPrompt(description: string): string {
  // Parse key elements from description
  const elements = description
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const promptObj = {
    type: 'image_generation',
    style: 'photorealistic',
    elements: elements,
    quality: 'high',
    format: '1024x1024',
  };

  // Return JSON-stringified version
  // Note: This is experimental - standard markdown may work better
  return JSON.stringify(promptObj, null, 2);
}

/**
 * Extract color palette and convert to hex codes
 * Useful for precise color control in Nano Banana
 */
export function addHexColors(description: string, colorMap: Record<string, string>): string {
  let enhanced = description;

  // Replace color names with hex codes
  for (const [colorName, hexCode] of Object.entries(colorMap)) {
    const regex = new RegExp(`\\b${colorName}\\b`, 'gi');
    enhanced = enhanced.replace(regex, `${colorName} (${hexCode})`);
  }

  return enhanced;
}

/**
 * Emphasize critical constraints with ALL CAPS
 * Nano Banana pays special attention to capitalized requirements
 */
export function emphasizeConstraints(prompt: string): string {
  // Common constraint keywords to emphasize
  const keywords = ['must', 'never', 'always', 'required', 'essential', 'critical'];

  let emphasized = prompt;

  for (const keyword of keywords) {
    // Replace "must not" → "MUST NOT", "never include" → "NEVER include", etc.
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    emphasized = emphasized.replace(regex, keyword.toUpperCase());
  }

  return emphasized;
}

/**
 * Build a complete Nano Banana-optimized prompt from scene components
 */
export function buildNanoBananaPrompt(options: {
  sceneDescription: string;
  mood?: string;
  lighting?: string;
  characters?: string[];
  setting?: string;
  style?: 'photorealistic' | 'artistic' | 'illustration';
  config?: NanoBananaConfig;
}): string {
  const {
    sceneDescription,
    mood,
    lighting,
    characters = [],
    setting,
    style = 'photorealistic',
    config = {},
  } = options;

  // Build markdown list
  const elements: string[] = [];

  if (setting) {
    elements.push(`Setting: ${setting}`);
  }

  if (characters.length > 0) {
    elements.push(`Characters: ${characters.join(', ')}`);
  }

  elements.push(`Scene: ${sceneDescription}`);

  if (mood) {
    elements.push(`Mood: ${mood}`);
  }

  if (lighting) {
    elements.push(`Lighting: ${lighting}`);
  }

  elements.push(`Style: ${style}`);

  // Build base prompt
  let prompt = 'Create an image with the following elements:\n\n';
  prompt += elements.map((e) => `- ${e}`).join('\n');

  // Apply Nano Banana optimizations
  return enhanceForNanoBanana(prompt, config);
}
