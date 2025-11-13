/**
 * Interactive Style Wizard
 *
 * CLI wizard for creating and customizing visual style guides
 * Accepts plain text descriptions and/or reference images
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import readline from 'readline';
import type OpenAI from 'openai';
import type { VisualStyleGuide } from './types.js';
import { analyzeStyleFromImages } from './style-analyzer.js';
import { saveStyleGuide, loadStyleGuide, formatStyleGuideForPrompt } from './style-guide.js';
import chalk from 'chalk';

/**
 * Style wizard options
 */
export interface StyleWizardOptions {
  outputDir: string;
  openai: OpenAI;
  bookGenre?: string;
}

/**
 * Style wizard result
 */
export interface StyleWizardResult {
  styleGuide: VisualStyleGuide;
  method: 'text-description' | 'reference-images' | 'hybrid';
  saved: boolean;
}

/**
 * Run interactive style wizard
 */
export async function runStyleWizard(options: StyleWizardOptions): Promise<StyleWizardResult> {
  const { outputDir, openai, bookGenre } = options;

  console.log(chalk.cyan('\n🎨 Visual Style Wizard\n'));
  console.log('Create a custom visual style guide for your book illustrations.\n');

  // Check for existing style guide
  const existing = await loadStyleGuide(outputDir);
  if (existing) {
    console.log(chalk.yellow('⚠️  Existing style guide found.'));
    console.log(chalk.gray(`Created: ${existing.createdAt}`));
    console.log(chalk.gray(`Consistency: ${(existing.consistencyScore * 100).toFixed(0)}%\n`));

    const overwrite = await promptYesNo('Overwrite existing style guide?', false);
    if (!overwrite) {
      console.log(chalk.gray('Cancelled.'));
      return {
        styleGuide: existing,
        method: 'text-description',
        saved: false,
      };
    }
  }

  // Ask for input method
  console.log('How would you like to define the visual style?\n');
  console.log('  1. Plain text description (e.g., "watercolor, soft edges, pastel colors")');
  console.log('  2. Reference image(s) - analyze existing images');
  console.log('  3. Both - description + reference images\n');

  const method = await promptChoice('Select method:', ['1', '2', '3'], '1');

  let styleGuide: VisualStyleGuide;
  let usedMethod: StyleWizardResult['method'] = 'text-description';

  if (method === '2') {
    // Reference images only
    styleGuide = await createStyleGuideFromImages(openai, bookGenre);
    usedMethod = 'reference-images';
  } else if (method === '3') {
    // Hybrid: description + images
    styleGuide = await createHybridStyleGuide(openai, bookGenre);
    usedMethod = 'hybrid';
  } else {
    // Text description only
    styleGuide = await createStyleGuideFromText(openai, bookGenre);
    usedMethod = 'text-description';
  }

  // Preview
  console.log(chalk.cyan('\n📋 Style Guide Preview:\n'));
  displayStyleGuide(styleGuide);

  // Confirm and save
  const confirm = await promptYesNo('\nSave this style guide?', true);
  if (!confirm) {
    console.log(chalk.gray('Cancelled.'));
    return {
      styleGuide,
      method: usedMethod,
      saved: false,
    };
  }

  await saveStyleGuide(outputDir, styleGuide);
  console.log(chalk.green('\n✅ Style guide saved successfully!'));
  console.log(chalk.gray(`Location: ${outputDir}/data/style-guide.json\n`));

  return {
    styleGuide,
    method: usedMethod,
    saved: true,
  };
}

/**
 * Create style guide from text description
 */
async function createStyleGuideFromText(
  openai: OpenAI,
  bookGenre?: string
): Promise<VisualStyleGuide> {
  console.log(chalk.cyan('\n📝 Text Description Mode\n'));
  console.log('Describe the desired visual style for your book illustrations.');
  console.log(chalk.gray('Examples:'));
  console.log(chalk.gray('  - "Watercolor painting, soft edges, pastel colors, dreamy atmosphere"'));
  console.log(chalk.gray('  - "Digital art, vibrant colors, anime-style characters, dynamic composition"'));
  console.log(chalk.gray('  - "Realistic oil painting, dark tones, dramatic lighting, detailed textures"\n'));

  const description = await promptText('Style description:', true);

  console.log(chalk.gray('\nGenerating style guide from description...'));

  // Use AI to expand the description into a full style guide
  const prompt = buildStyleGenerationPrompt(description, bookGenre);

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert art director. Convert user style descriptions into detailed visual style guides. Return JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const parsed = parseStyleGuideResponse(content);
    return {
      ...parsed,
      consistencyScore: 1.0, // User-defined, assumed perfect consistency
      createdAt: new Date().toISOString(),
      bootstrapCount: 0, // Created from description, not images
    };
  } catch (error) {
    console.error(chalk.red('Failed to parse AI response'));
    throw new Error('Style guide generation failed');
  }
}

/**
 * Create style guide from reference images
 */
async function createStyleGuideFromImages(
  openai: OpenAI,
  bookGenre?: string
): Promise<VisualStyleGuide> {
  console.log(chalk.cyan('\n🖼️  Reference Image Mode\n'));
  console.log('Provide paths to 1-5 reference images that represent your desired style.');
  console.log(chalk.gray('Supported formats: PNG, JPG, JPEG\n'));

  const imagePaths: string[] = [];

  while (imagePaths.length < 5) {
    const path = await promptText(
      `Reference image ${imagePaths.length + 1} (or press Enter to finish):`,
      imagePaths.length === 0 // First image is required
    );

    if (!path && imagePaths.length > 0) {
      break; // User finished entering paths
    }

    if (!path) {
      continue; // Empty input, prompt again
    }

    // Validate file exists
    if (!existsSync(path)) {
      console.log(chalk.red(`File not found: ${path}`));
      continue;
    }

    // Validate file extension
    if (!/\.(png|jpe?g)$/i.test(path)) {
      console.log(chalk.red('Unsupported format. Use PNG or JPG.'));
      continue;
    }

    imagePaths.push(path);
    console.log(chalk.green(`✓ Added: ${path}`));
  }

  if (imagePaths.length === 0) {
    throw new Error('At least one reference image is required');
  }

  console.log(chalk.gray(`\nAnalyzing ${imagePaths.length} image(s)...`));

  return await analyzeStyleFromImages(imagePaths, openai, async (msg) => {
    console.log(chalk.gray(msg));
  });
}

/**
 * Create hybrid style guide (text + images)
 */
async function createHybridStyleGuide(
  openai: OpenAI,
  bookGenre?: string
): Promise<VisualStyleGuide> {
  console.log(chalk.cyan('\n🎨 Hybrid Mode (Text + Images)\n'));

  // Get text description first
  const textGuide = await createStyleGuideFromText(openai, bookGenre);

  // Then get images
  console.log(chalk.cyan('\nNow add reference images to refine the style:\n'));
  const imageGuide = await createStyleGuideFromImages(openai, bookGenre);

  // Merge the two guides (prioritize image analysis for visual characteristics)
  return {
    artStyle: imageGuide.artStyle, // Prefer visual analysis
    colorPalette: imageGuide.colorPalette, // Prefer visual analysis
    lighting: imageGuide.lighting || textGuide.lighting,
    mood: textGuide.mood, // Prefer text description for mood
    composition: imageGuide.composition, // Prefer visual analysis
    consistencyScore: (textGuide.consistencyScore + imageGuide.consistencyScore) / 2,
    createdAt: new Date().toISOString(),
    bootstrapCount: imageGuide.bootstrapCount,
  };
}

/**
 * Build prompt for generating style guide from text description
 */
function buildStyleGenerationPrompt(description: string, bookGenre?: string): string {
  const genreHint = bookGenre ? `\nBook genre: ${bookGenre}` : '';

  return `Convert this user's style description into a detailed visual style guide.${genreHint}

User description: "${description}"

Return JSON with this structure:
{
  "artStyle": "Detailed art style description",
  "colorPalette": ["#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB"],
  "lighting": "Lighting characteristics description",
  "mood": "Overall mood/atmosphere description",
  "composition": "Composition and framing patterns"
}

Be specific and detailed. Extract or infer:
- Art technique (watercolor, digital painting, pen and ink, etc.)
- Color temperature (warm, cool, neutral)
- Color saturation (muted, vibrant, etc.)
- Specific hex color codes that match the description
- Lighting quality (soft, hard, natural, dramatic)
- Mood/emotional tone
- Composition patterns (close-ups, wide shots, rule of thirds, etc.)`;
}

/**
 * Parse AI response into VisualStyleGuide format
 */
function parseStyleGuideResponse(content: string): Omit<
  VisualStyleGuide,
  'consistencyScore' | 'createdAt' | 'bootstrapCount'
> {
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(content);
    return {
      artStyle: parsed.artStyle || 'Contemporary digital illustration',
      colorPalette: parsed.colorPalette || [],
      lighting: parsed.lighting || 'Natural lighting',
      mood: parsed.mood || 'Neutral storytelling',
      composition: parsed.composition || 'Balanced composition',
    };
  } catch {
    // Try to extract JSON from markdown
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        artStyle: parsed.artStyle || 'Contemporary digital illustration',
        colorPalette: parsed.colorPalette || [],
        lighting: parsed.lighting || 'Natural lighting',
        mood: parsed.mood || 'Neutral storytelling',
        composition: parsed.composition || 'Balanced composition',
      };
    }

    throw new Error('Failed to parse AI response');
  }
}

/**
 * Display style guide in terminal
 */
function displayStyleGuide(styleGuide: VisualStyleGuide): void {
  console.log(chalk.yellow('Art Style:'));
  console.log(`  ${styleGuide.artStyle}\n`);

  console.log(chalk.yellow('Color Palette:'));
  for (const color of styleGuide.colorPalette) {
    console.log(`  ${color}`);
  }
  console.log();

  console.log(chalk.yellow('Lighting:'));
  console.log(`  ${styleGuide.lighting}\n`);

  console.log(chalk.yellow('Mood:'));
  console.log(`  ${styleGuide.mood}\n`);

  console.log(chalk.yellow('Composition:'));
  console.log(`  ${styleGuide.composition}\n`);

  if (styleGuide.bootstrapCount > 0) {
    console.log(chalk.gray(`Analyzed from ${styleGuide.bootstrapCount} images`));
  }
  console.log(chalk.gray(`Consistency Score: ${(styleGuide.consistencyScore * 100).toFixed(0)}%`));
}

/**
 * Prompt user for text input
 */
async function promptText(question: string, required: boolean = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(chalk.cyan(question) + ' ', (answer) => {
        const trimmed = answer.trim();
        if (required && !trimmed) {
          console.log(chalk.red('This field is required.'));
          ask();
        } else {
          rl.close();
          resolve(trimmed);
        }
      });
    };
    ask();
  });
}

/**
 * Prompt user for yes/no
 */
async function promptYesNo(question: string, defaultYes: boolean = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.cyan(`${question} ${hint}`) + ' ', (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (!normalized) {
        resolve(defaultYes);
      } else {
        resolve(normalized === 'y' || normalized === 'yes');
      }
    });
  });
}

/**
 * Prompt user for choice from list
 */
async function promptChoice(
  question: string,
  choices: string[],
  defaultChoice: string
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(chalk.cyan(`${question} [${defaultChoice}]`) + ' ', (answer) => {
        const trimmed = answer.trim();
        const choice = trimmed || defaultChoice;

        if (!choices.includes(choice)) {
          console.log(chalk.red(`Invalid choice. Choose from: ${choices.join(', ')}`));
          ask();
        } else {
          rl.close();
          resolve(choice);
        }
      });
    };
    ask();
  });
}
