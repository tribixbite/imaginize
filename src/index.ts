/**
 * illustrate v2.0 - AI-powered book illustration guide generator
 * Main entry point with phase-based orchestration
 */

import { mkdir } from 'fs/promises';
import { extname, basename } from 'path';
import { existsSync } from 'fs';
import OpenAI from 'openai';
import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';
import readline from 'readline';

import { loadConfig, getSampleConfig } from './lib/config.js';
import { parseEpub, sanitizeFilename } from './lib/epub-parser.js';
import { parsePdf } from './lib/pdf-parser.js';
import { StateManager } from './lib/state-manager.js';
import { ProgressTracker } from './lib/progress-tracker.js';
import { findBookFiles, selectBookFile } from './lib/file-selector.js';
import { prepareConfiguration, parseChapterSelection, parseElementSelection } from './lib/provider-utils.js';
import { AnalyzePhase } from './lib/phases/analyze-phase.js';
import { ExtractPhase } from './lib/phases/extract-phase.js';
import { IllustratePhase } from './lib/phases/illustrate-phase.js';
import type { CommandOptions, ChapterContent } from './types/config.js';

/**
 * Prompt user to continue from saved state
 */
async function promptToContinue(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Continue from saved progress? (y/n): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  const program = new Command();

  program
    .name('illustrate')
    .version('2.0.0')
    .description('AI-powered book illustration guide generator v2.0')
    // Phase selection
    .option('--text', 'Generate Contents.md with visual concepts (analyze phase)')
    .option('--elements', 'Generate Elements.md with story elements (extract phase)')
    .option('--images', 'Generate images for concepts/elements (illustrate phase)')
    // Filtering
    .option('--chapters <range>', 'Process specific chapters (e.g., "1-5,10")')
    .option('--elements-filter <filter>', 'Filter elements (e.g., "character:*,place:castle")')
    .option('--limit <n>', 'Limit number of items processed (for testing)', parseInt)
    // Control
    .option('--continue', 'Continue from saved progress')
    .option('--force', 'Force regeneration even if exists')
    .option('--migrate', 'Migrate old state to new schema')
    // Config override
    .option('--model <name>', 'Override model (e.g., "gpt-4o")')
    .option('--api-key <key>', 'Override API key')
    .option('--image-key <key>', 'Separate image API key')
    // Output
    .option('--output-dir <dir>', 'Override output directory')
    .option('--verbose', 'Verbose logging')
    .option('--quiet', 'Minimal output')
    // Utilities
    .option('--init-config', 'Generate sample .illustrate.config file')
    .option('--estimate', 'Estimate costs without executing')
    .option('-f, --file <path>', 'Specific book file to process');

  program.parse();
  const options = program.opts<CommandOptions>();

  try {
    // Handle --init-config
    if (options.initConfig) {
      const { writeFile } = await import('fs/promises');
      await writeFile('.illustrate.config', getSampleConfig());
      console.log(chalk.green('✅ Created .illustrate.config file'));
      console.log(chalk.yellow('⚠️  Remember to add your API keys!'));
      return;
    }

    const spinner = ora();

    // Load configuration
    spinner.start('Loading configuration...');
    const config = await loadConfig();

    // Override with CLI options if provided
    if (options.model) config.model = options.model;
    if (options.apiKey) config.apiKey = options.apiKey;
    if (options.imageKey && config.imageEndpoint) {
      config.imageEndpoint.apiKey = options.imageKey;
    }

    spinner.succeed('Configuration loaded');

    // Find or select book file
    let bookFile: string;

    if (options.file) {
      bookFile = options.file;
      if (!existsSync(bookFile)) {
        throw new Error(`Book file not found: ${bookFile}`);
      }
    } else {
      spinner.start('Searching for book files...');
      const bookFiles = await findBookFiles();

      if (bookFiles.length === 0) {
        spinner.fail('No book files found');
        console.error(chalk.red('\n❌ No EPUB or PDF files found in current directory'));
        console.log(chalk.yellow('\n💡 Tip: Run with --file <path> to specify a book file'));
        process.exit(1);
      }

      spinner.stop();
      const selected = await selectBookFile(bookFiles);

      if (!selected) {
        console.log(chalk.yellow('No file selected. Exiting.'));
        process.exit(0);
      }

      bookFile = selected.path;
    }

    console.log(chalk.cyan(`\n📖 Processing: ${chalk.white(bookFile)}\n`));

    // Parse the book
    spinner.start('Parsing book file...');
    const ext = extname(bookFile).toLowerCase();
    const { metadata, chapters, fullText } =
      ext === '.epub' ? await parseEpub(bookFile) : await parsePdf(bookFile);

    spinner.succeed(
      `Parsed "${metadata.title}" - ${chapters.length} chapters, ${metadata.totalPages || '?'} pages`
    );

    // Determine output directory
    const sanitizedName = sanitizeFilename(basename(bookFile));
    const outputDir = options.outputDir || config.outputPattern.replace('{name}', sanitizedName);

    // Check for existing state
    let stateManager: StateManager;
    let progressTracker: ProgressTracker;
    let shouldContinue = false;

    if (existsSync(outputDir)) {
      // Try to load existing state
      stateManager = new StateManager(outputDir, bookFile, metadata.title, metadata.totalPages || 0);
      const hasState = await stateManager.load();

      if (hasState && !options.force) {
        const current = stateManager.getCurrentPhase();

        if (current) {
          console.log(chalk.yellow(`\n⚠️  Found partial progress:\n`));
          console.log(stateManager.getSummary());
          console.log('');

          if (options.continue) {
            shouldContinue = true;
          } else {
            shouldContinue = await promptToContinue();

            if (!shouldContinue) {
              console.log(chalk.yellow('\n💡 Use --continue to resume or --force to restart'));
              console.log(chalk.yellow('   Use --force --chapters <range> to regenerate specific chapters\n'));
              process.exit(0);
            }
          }
        }
      }

      if (options.force && !shouldContinue) {
        console.log(chalk.yellow('⚠️  Force mode: Will regenerate content'));
        // Reset state
        stateManager = new StateManager(outputDir, bookFile, metadata.title, metadata.totalPages || 0);
      }

      progressTracker = new ProgressTracker(outputDir);
    } else {
      // Create new output directory and state
      await mkdir(outputDir, { recursive: true });
      stateManager = new StateManager(outputDir, bookFile, metadata.title, metadata.totalPages || 0);
      progressTracker = new ProgressTracker(outputDir);
      await progressTracker.initialize(metadata.title, chapters.length);
    }

    // Update TOC in state
    stateManager.updateTOC(
      chapters.map((c) => ({
        number: c.chapterNumber,
        title: c.chapterTitle,
        pages: c.pageRange,
        tokenCount: c.tokenCount,
      }))
    );
    await stateManager.save();

    // Determine which phases to run
    const needsText = options.text || (!options.elements && !options.images);
    const needsElements = !!options.elements;
    const needsImages = !!options.images;

    // Filter chapters if requested
    let chaptersToProcess = chapters;
    if (options.chapters) {
      const selectedNums = parseChapterSelection(options.chapters);
      chaptersToProcess = chapters.filter((c) => selectedNums.includes(c.chapterNumber));

      if (chaptersToProcess.length === 0) {
        throw new Error(`No chapters found matching: ${options.chapters}`);
      }

      console.log(chalk.cyan(`📋 Processing ${chaptersToProcess.length} selected chapters\n`));
    }

    // Prepare API configuration
    spinner.start('Preparing API configuration...');
    const { textConfig, imageConfig, warnings } = await prepareConfiguration(config, needsImages);

    for (const warning of warnings) {
      spinner.warn(warning);
    }

    spinner.succeed('API configuration ready');

    // Initialize OpenAI clients
    const openai = new OpenAI({
      apiKey: textConfig.apiKey,
      baseURL: textConfig.baseUrl,
    });

    let imageOpenai: OpenAI | undefined;
    if (imageConfig) {
      imageOpenai = new OpenAI({
        apiKey: imageConfig.apiKey,
        baseURL: imageConfig.baseUrl,
      });
    }

    // Create phase context
    const context = {
      config,
      openai,
      imageOpenai,
      stateManager,
      progressTracker,
      chapters: chaptersToProcess,
      outputDir,
    };

    // Execute requested phases
    console.log(chalk.cyan.bold('\n🚀 Starting processing...\n'));

    try {
      if (needsText) {
        console.log(chalk.cyan('📝 Phase: Analyze (--text)\n'));
        const analyzePhase = new AnalyzePhase(context);
        await analyzePhase.execute();
        console.log('');
      }

      if (needsElements) {
        console.log(chalk.cyan('🔍 Phase: Extract (--elements)\n'));
        const extractPhase = new ExtractPhase(context);
        await extractPhase.execute();
        console.log('');
      }

      if (needsImages) {
        console.log(chalk.cyan('🎨 Phase: Illustrate (--images)\n'));
        const illustratePhase = new IllustratePhase(context);
        await illustratePhase.execute();
        console.log('');
      }

      // Success summary
      console.log(chalk.green.bold('✨ Processing complete!\n'));
      console.log(chalk.white(`Output directory: ${chalk.cyan(outputDir)}`));
      console.log(chalk.white(`- progress.md: Processing log`));
      console.log(chalk.white(`- .illustrate.state.json: Machine state`));

      if (needsText) {
        console.log(chalk.white(`- Contents.md: Visual concepts by chapter`));
      }
      if (needsElements) {
        console.log(chalk.white(`- Elements.md: Story elements catalog`));
      }

      console.log('');
      console.log(stateManager.getSummary());
      console.log('');

    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error during processing:\n`));
      console.error(error.message);
      console.log(chalk.yellow(`\n💡 Check ${outputDir}/progress.md for details`));
      console.log(chalk.yellow(`   State saved - use --continue to resume\n`));
      process.exit(1);
    }

  } catch (error: any) {
    console.error(chalk.red('\n❌ Error:'), error.message);

    if (error.message.includes('API key')) {
      console.log(chalk.yellow('\n💡 Tip: Run "illustrate --init-config" to create a configuration file'));
      console.log(chalk.yellow('   Or set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable\n'));
    }

    process.exit(1);
  }
}
