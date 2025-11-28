/**
 * imaginize v2.5 - AI-powered book illustration guide generator
 * Main entry point with phase-based orchestration
 */

import { mkdir, readdir } from 'fs/promises';
import { extname, basename, join, dirname } from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get package directory for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import OpenAI from 'openai';
import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';
import readline from 'readline';
import { GoogleGeminiAdapter, isGoogleNativeEndpoint } from './lib/google-gemini-adapter.js';
import type { IAiClient } from './lib/ai-client.js';

import { loadConfig, getSampleConfig } from './lib/config.js';
import { parseEpub, sanitizeFilename } from './lib/epub-parser.js';
import { parsePdf } from './lib/pdf-parser.js';
import { parseMobi } from './lib/mobi-parser.js';
import { StateManager } from './lib/state-manager.js';
import { ProgressTracker } from './lib/progress-tracker.js';
import { DashboardServer } from './lib/dashboard/server.js';
import { findBookFiles, selectBookFile } from './lib/file-selector.js';
import type { IllustrateConfig, IllustrateState, AIProvider } from './types/config.js';
import {
  prepareConfiguration,
  parseChapterSelection,
  mapStoryChaptersToEpub,
  parseElementSelection,
} from './lib/provider-utils.js';
import { AnalyzePhase } from './lib/phases/analyze-phase.js';
import { ExtractPhase } from './lib/phases/extract-phase.js';
import { EnrichPhase } from './lib/phases/enrich-phase.js';
import { IllustratePhase } from './lib/phases/illustrate-phase.js';
import { AnalyzePhaseV2 } from './lib/phases/analyze-phase-v2.js';
import { IllustratePhaseV2 } from './lib/phases/illustrate-phase-v2.js';
import { generateContentsFile } from './lib/output-generator.js';
import type { CommandOptions, ChapterContent, BookMetadata } from './types/config.js';

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
    .name('imaginize')
    .version('2.6.0')
    .description(
      'AI-powered book illustration guide generator v2.6 with real-time dashboard'
    )
    // Phase selection
    .option('--text', 'Generate Chapters.md with visual scenes (analyze phase)')
    .option('--elements', 'Generate Elements.md with story elements (extract phase)')
    .option('--enrich', 'Enrich scene descriptions with element visual details (enrich phase)')
    .option(
      '--images',
      'Generate images with DALL-E and update Chapters.md (illustrate phase)'
    )
    .option('--pdf', 'Compile a graphic novel PDF after image generation')
    .option('--cbz', 'Compile a CBZ comic book archive after image generation')
    .option('--epub', 'Compile an EPUB eBook after image generation')
    .option('--html', 'Generate an HTML gallery after image generation')
    .option('--webp-album', 'Compile WebP album (smaller than PDF)')
    .option('--webp-strip', 'Create single vertical strip WebP image')
    .option('--all-formats', 'Generate all output formats (PDF, CBZ, EPUB, HTML, WebP)')
    // Filtering
    .option('--chapters <range>', 'Process specific chapters (e.g., "1-5,10")')
    .option(
      '--elements-filter <filter>',
      'Filter elements (e.g., "character:*,place:castle")'
    )
    .option('--limit <n>', 'Limit number of items processed (for testing)', parseInt)
    // Control
    .option('--continue', 'Continue from saved progress')
    .option('--force', 'Force regeneration even if exists')
    .option('--migrate', 'Migrate old state to new schema')
    .option('--concurrent', 'Use concurrent processing architecture (experimental)')
    // Retry control
    .option('--skip-failed', 'Skip failed chapters and continue processing')
    .option('--retry-failed', 'Only retry chapters that previously failed')
    .option('--clear-errors', 'Clear error status for all chapters before processing')
    // Config override
    .option('--model <name>', 'Override model (e.g., "gpt-4o")')
    .option('--api-key <key>', 'Override API key')
    .option('--image-key <key>', 'Separate image API key')
    .option('--provider <provider>', 'Override AI provider (openai, openrouter, gemini, custom)')
    // Output
    .option('--output-dir <dir>', 'Override output directory')
    .option('--verbose', 'Verbose logging')
    .option('--quiet', 'Minimal output')
    // Utilities
    .option('--init-config', 'Generate sample .imaginize.config file')
    .option('--estimate', 'Estimate costs without executing')
    .option('-f, --file <path>', 'Specific book file to process')
    // Dashboard
    .option('--dashboard', 'Start web dashboard for real-time progress monitoring')
    .option('--dashboard-port <port>', 'Dashboard server port (default: 3000)', parseInt)
    .option('--dashboard-host <host>', 'Dashboard server host (default: localhost)')
    .action(async () => {
      // Main command action - actual logic runs after program.parse()
      // This action handler ensures Commander doesn't show help when no subcommand is provided
    });

  // Compile command - generate graphic novel PDF
  program
    .command('compile')
    .description('Compile images into graphic novel PDF')
    .option('--input <dir>', 'Input directory (default: ./output)', './output')
    .option(
      '--output <file>',
      'Output PDF path (default: graphic-novel.pdf)',
      'graphic-novel.pdf'
    )
    .option(
      '--layout <layout>',
      'Images per page: 4x1, 2x2, 1x1, 6x2 (default: 4x1)',
      '4x1'
    )
    .option(
      '--caption-style <style>',
      'Caption style: modern, classic, minimal, none (default: modern)',
      'modern'
    )
    .option('--no-toc', 'Exclude table of contents')
    .option('--no-glossary', 'Exclude elements glossary')
    .option('--no-page-numbers', 'Hide page numbers')
    .option('--title <title>', 'Book title for cover page')
    .action(async (cmdOptions) => {
      const { GraphicNovelCompiler } = await import('./lib/compiler/pdf-generator.js');

      const compiler = new GraphicNovelCompiler({
        inputDir: cmdOptions.input,
        outputPath: cmdOptions.output,
        layout: cmdOptions.layout as '4x1' | '2x2' | '1x1' | '6x2',
        captionStyle: cmdOptions.captionStyle as
          | 'modern'
          | 'classic'
          | 'minimal'
          | 'none',
        includeToc: cmdOptions.toc !== false,
        includeGlossary: cmdOptions.glossary !== false,
        pageNumbers: cmdOptions.pageNumbers !== false,
        bookTitle: cmdOptions.title,
      });

      try {
        await compiler.compile();
        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  // Regenerate command - regenerate specific scenes without re-analysis
  program
    .command('regenerate')
    .description('Regenerate specific scenes without re-running analysis')
    .option(
      '--output-dir <dir>',
      'Output directory (default: ./imaginize_output)',
      './imaginize_output'
    )
    .option('--chapter <n>', 'Regenerate all scenes in chapter N', parseInt)
    .option('--scene <n>', 'Regenerate scene N (within chapter or globally)', parseInt)
    .option('--scene-id <id>', 'Regenerate scene by ID (e.g., "chapter_3_scene_2")')
    .option('--all', 'Regenerate all scenes')
    .option('--list', 'List all available scenes without regenerating')
    .option('--dry-run', 'Show what would be regenerated without generating')
    .option('--edit', 'Edit scene descriptions interactively before regenerating')
    .option('--view', 'View scene details without regenerating')
    .action(async (cmdOptions) => {
      try {
        const { findScenesToRegenerate, loadImageConcepts } = await import(
          './lib/regenerate.js'
        );

        // List mode
        if (cmdOptions.list) {
          const conceptsByChapter = await loadImageConcepts(cmdOptions.outputDir);

          console.log(chalk.cyan('\n📋 Available scenes:\n'));

          for (const [chapterTitle, concepts] of conceptsByChapter.entries()) {
            console.log(chalk.yellow(`\n  ${chapterTitle}`));

            for (let i = 0; i < concepts.length; i++) {
              const concept = concepts[i];
              const chapterNum = concept.chapterNumber || 0;
              const sceneNum = i + 1;
              const sceneId = `chapter_${chapterNum}_scene_${sceneNum}`;

              console.log(chalk.gray(`    Scene ${sceneNum} (${sceneId}):`));
              console.log(chalk.gray(`      ${concept.description.substring(0, 80)}...`));
            }
          }

          console.log();
          process.exit(0);
        }

        // Find scenes to regenerate
        const scenes = await findScenesToRegenerate(cmdOptions.outputDir, {
          outputDir: cmdOptions.outputDir,
          chapter: cmdOptions.chapter,
          scene: cmdOptions.scene,
          sceneId: cmdOptions.sceneId,
          all: cmdOptions.all,
        });

        // View mode
        if (cmdOptions.view) {
          const { viewScene } = await import('./lib/scene-editor.js');

          for (const scene of scenes) {
            await viewScene(scene);
          }

          process.exit(0);
        }

        // Edit mode
        if (cmdOptions.edit) {
          const { SceneEditor } = await import('./lib/scene-editor.js');
          const editor = new SceneEditor(cmdOptions.outputDir);

          const editedConcepts = await editor.editScenes(scenes);

          if (editedConcepts.size === 0) {
            console.log(chalk.gray('No edits made. Exiting.'));
            process.exit(0);
          }

          // Update scenes with edited concepts
          for (const scene of scenes) {
            const sceneKey = `${scene.chapterNumber}_${scene.sceneNumber}`;
            const editedConcept = editedConcepts.get(sceneKey);
            if (editedConcept) {
              scene.concept = editedConcept;
            }
          }

          console.log(chalk.cyan('Proceeding with regeneration of edited scenes...\n'));
        }

        // Dry run mode
        if (cmdOptions.dryRun) {
          console.log(chalk.cyan(`\n🔍 Would regenerate ${scenes.length} scene(s):\n`));

          for (const scene of scenes) {
            console.log(
              chalk.yellow(`  Chapter ${scene.chapterNumber}: ${scene.chapterTitle}`)
            );
            console.log(
              chalk.gray(
                `    Scene ${scene.sceneNumber}: ${scene.concept.description.substring(0, 60)}...`
              )
            );
            if (scene.imageFilename) {
              console.log(chalk.gray(`    Current image: ${scene.imageFilename}`));
            } else {
              console.log(chalk.gray(`    Current image: (not found)`));
            }
          }

          console.log();
          process.exit(0);
        }

        // Load configuration
        const config = await loadConfig();

        // Setup image generation client
        let imageOpenai: OpenAI | null = null;

        if (config.imageEndpoint) {
          imageOpenai = new OpenAI({
            apiKey: config.imageEndpoint.apiKey || config.apiKey,
            baseURL: config.imageEndpoint.baseUrl,
            timeout: 120000,
            maxRetries: config.maxRetries || 1,
          });
        } else {
          imageOpenai = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            timeout: 120000,
            maxRetries: config.maxRetries || 1,
          });
        }

        if (!imageOpenai) {
          console.error(chalk.red('\n❌ No image generation endpoint configured'));
          process.exit(1);
        }

        // Execute regeneration
        const { RegeneratePhase } = await import('./lib/phases/regenerate-phase.js');

        const regeneratePhase = new RegeneratePhase({
          outputDir: cmdOptions.outputDir,
          config,
          imageOpenai,
          scenes,
        });

        const result = await regeneratePhase.execute();

        console.log(chalk.cyan('\n📊 Regeneration Summary:'));
        console.log(chalk.green(`  ✅ Generated: ${result.generated}`));
        if (result.failed > 0) {
          console.log(chalk.red(`  ❌ Failed: ${result.failed}`));
        }
        console.log();

        process.exit(result.failed > 0 ? 1 : 0);
      } catch (error: any) {
        console.error(chalk.red(`\nError: ${error.message}`));
        process.exit(1);
      }
    });

  // Wizard command for interactive style creation
  program
    .command('wizard')
    .description('Interactive wizard for creating custom visual style guides')
    .option(
      '--output-dir <dir>',
      'Output directory (default: ./imaginize_output)',
      './imaginize_output'
    )
    .option('--genre <genre>', 'Book genre (helps guide style suggestions)')
    .action(async (cmdOptions) => {
      try {
        // Load configuration
        const config = await loadConfig();

        // Setup OpenAI client (or Google native adapter)
        let openai: IAiClient;
        if (isGoogleNativeEndpoint(config.baseUrl)) {
          console.log(chalk.cyan('Using Google Gemini native API (direct endpoint)'));
          openai = new GoogleGeminiAdapter({
            apiKey: config.apiKey,
            model: typeof config.model === 'string' ? config.model : config.model.name,
            baseUrl: config.baseUrl,
          });
        } else {
          openai = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            timeout: 120000,
            maxRetries: config.maxRetries || 1,
          });
        }

        // Run style wizard
        const { runStyleWizard } = await import('./lib/visual-style/style-wizard.js');

        const result = await runStyleWizard({
          outputDir: cmdOptions.outputDir,
          openai,
          bookGenre: cmdOptions.genre || config.genre,
        });

        if (result.saved) {
          console.log(
            chalk.gray(
              '\nYou can now run imaginize to generate images with this style guide.'
            )
          );
          console.log(
            chalk.gray('The style will be automatically applied to all generated images.')
          );
        }

        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red(`\nError: ${error.message}`));
        if (error.stack) {
          console.error(chalk.gray(error.stack));
        }
        process.exit(1);
      }
    });

  // Series management command
  const seriesCmd = program
    .command('series')
    .description('Multi-book series management');

  // series init - Initialize a new series
  seriesCmd
    .command('init')
    .description('Initialize a new multi-book series')
    .argument('[series-root]', 'Series root directory (default: current directory)')
    .option('--name <name>', 'Series name')
    .option('--shared-elements', 'Enable shared elements (default: true)', true)
    .option('--mode <mode>', 'Shared elements mode: progressive or manual (default: progressive)', 'progressive')
    .option('--merge-strategy <strategy>', 'Merge strategy: enrich, union, or override (default: enrich)', 'enrich')
    .action(async (seriesRoot, cmdOptions) => {
      try {
        const { createSeriesManager } = await import('./lib/series/series-manager.js');
        const resolvedRoot = seriesRoot || process.cwd();

        const manager = createSeriesManager(resolvedRoot);

        const config = await manager.initializeSeries({
          name: cmdOptions.name || basename(resolvedRoot),
        });

        console.log(chalk.green(`\n✅ Series "${config.name}" initialized`));
        console.log(chalk.gray(`   Location: ${resolvedRoot}`));
        console.log(chalk.gray(`   Shared elements: ${config.sharedElements.enabled ? 'enabled' : 'disabled'}`));
        console.log(chalk.gray(`   Mode: ${config.sharedElements.mode}`));
        console.log(chalk.gray(`   Merge strategy: ${config.sharedElements.mergeStrategy}`));
        console.log(chalk.cyan('\nNext steps:'));
        console.log(chalk.gray('  1. Add books using: imaginize series add-book <book-id> <title> <path>'));
        console.log(chalk.gray('  2. Process each book with series integration enabled'));

        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        process.exit(1);
      }
    });

  // series add-book - Add a book to the series
  seriesCmd
    .command('add-book')
    .description('Add a book to the series')
    .argument('<book-id>', 'Book ID (unique identifier)')
    .argument('<title>', 'Book title')
    .argument('<file-path>', 'Path to book file (EPUB/PDF)')
    .option('--series-root <dir>', 'Series root directory (default: current directory)')
    .option('--output-dir <dir>', 'Book output directory')
    .action(async (bookId, title, filePath, cmdOptions) => {
      try {
        const { createSeriesManager } = await import('./lib/series/series-manager.js');
        const resolvedRoot = cmdOptions.seriesRoot || process.cwd();

        const manager = createSeriesManager(resolvedRoot);

        await manager.addBook({
          id: bookId,
          title,
          path: filePath,
        });

        console.log(chalk.green(`\n✅ Book "${title}" added to series`));
        console.log(chalk.gray(`   ID: ${bookId}`));
        console.log(chalk.gray(`   File: ${filePath}`));
        console.log(chalk.gray(`   Status: pending`));
        console.log(chalk.cyan('\nNext steps:'));
        console.log(chalk.gray(`  Process this book with: imaginize --file "${filePath}"`));

        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        process.exit(1);
      }
    });

  // series stats - Show series statistics
  seriesCmd
    .command('stats')
    .description('Show series statistics')
    .option('--series-root <dir>', 'Series root directory (default: current directory)')
    .action(async (cmdOptions) => {
      try {
        const { createSeriesManager } = await import('./lib/series/series-manager.js');
        const resolvedRoot = cmdOptions.seriesRoot || process.cwd();

        const manager = createSeriesManager(resolvedRoot);
        const stats = await manager.getStats();

        if (!stats) {
          console.log(chalk.yellow('\n⚠️  No series configuration found'));
          console.log(chalk.gray('   Initialize a series with: imaginize series init'));
          process.exit(0);
        }

        console.log(chalk.cyan(`\n📚 Series: ${stats.name}`));
        console.log(chalk.gray(`   Total books: ${stats.totalBooks}`));
        console.log(chalk.gray(`   Completed: ${stats.completedBooks}`));
        console.log(chalk.gray(`   In Progress: ${stats.inProgressBooks}`));
        console.log(chalk.gray(`   Pending: ${stats.pendingBooks}`));

        console.log(chalk.cyan('\n🔗 Shared Elements:'));
        console.log(chalk.gray(`   Total entities: ${stats.totalEntities}`));
        console.log(chalk.gray(`   Total enrichments: ${stats.totalEnrichments}`));

        if (Object.keys(stats.entitiesByType).length > 0) {
          console.log(chalk.cyan('\n📊 Entities by type:'));
          for (const [type, count] of Object.entries(stats.entitiesByType)) {
            console.log(chalk.gray(`   ${type}: ${count}`));
          }
        }

        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        process.exit(1);
      }
    });

  // series catalog - Generate series-wide element catalog
  seriesCmd
    .command('catalog')
    .description('Generate series-wide element catalog')
    .option('--series-root <dir>', 'Series root directory (default: current directory)')
    .option('--output <file>', 'Output file path (default: ./SeriesCatalog.md)')
    .action(async (cmdOptions) => {
      try {
        const { createSeriesElementsManager } = await import('./lib/series/series-elements.js');
        const { createSeriesManager } = await import('./lib/series/series-manager.js');
        const resolvedRoot = cmdOptions.seriesRoot || process.cwd();

        const manager = createSeriesManager(resolvedRoot);
        const config = await manager.loadConfig();

        if (!config) {
          console.log(chalk.yellow('\n⚠️  No series configuration found'));
          console.log(chalk.gray('   Initialize a series with: imaginize series init'));
          process.exit(0);
        }

        const elementsManager = createSeriesElementsManager(resolvedRoot);
        await elementsManager.generateSeriesCatalog(config.name);

        const outputPath = cmdOptions.output || join(resolvedRoot, 'SeriesCatalog.md');
        console.log(chalk.green(`\n✅ Series catalog generated: ${outputPath}`));

        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        process.exit(1);
      }
    });

  program.parse();
  const options = program.opts<CommandOptions>();

  try {
    // Handle --init-config
    if (options.initConfig) {
      const { writeFile } = await import('fs/promises');
      await writeFile('.imaginize.config', getSampleConfig());
      console.log(chalk.green('✅ Created .imaginize.config file'));
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
    if (options.provider) {
      config.provider = options.provider as AIProvider;
    }

    // Validate API key after all overrides
    if (!config.apiKey) {
      spinner.fail('Configuration loaded');
      console.error(chalk.red('\n❌ Error: API key is required. Set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable, or add apiKey to .imaginize.config\n'));
      console.log(chalk.yellow('💡 Tip: Run "imaginize --init-config" to create a configuration file'));
      console.log(chalk.yellow('   Or set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable'));
      process.exit(1);
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
      const bookFiles = await findBookFiles(config.outputPattern);

      if (bookFiles.length === 0) {
        spinner.fail('No book files found');
        console.error(chalk.red('\n❌ No EPUB or PDF files found in current directory'));
        console.log(
          chalk.yellow('\n💡 Tip: Run with --file <path> to specify a book file')
        );
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
    let parseResult: { metadata: BookMetadata; chapters: ChapterContent[]; fullText: string };

    if (ext === '.epub') {
      parseResult = await parseEpub(bookFile);
    } else if (ext === '.mobi' || ext === '.azw3' || ext === '.azw') {
      parseResult = await parseMobi(bookFile);
    } else {
      parseResult = await parsePdf(bookFile);
    }

    const { metadata, chapters, fullText } = parseResult;

    spinner.succeed(
      `Parsed "${metadata.title}" - ${chapters.length} chapters, ${metadata.totalPages || '?'} pages`
    );

    // Determine output directory
    const sanitizedName = sanitizeFilename(basename(bookFile));
    const outputDir =
      options.outputDir || config.outputPattern.replace('{name}', sanitizedName);

    // Check for existing state
    let stateManager: StateManager;
    let progressTracker: ProgressTracker;
    let dashboardServer: DashboardServer | null = null;
    let shouldContinue = false;

    if (existsSync(outputDir)) {
      // Try to load existing state
      stateManager = new StateManager(
        outputDir,
        bookFile,
        metadata.title,
        metadata.totalPages || 0
      );
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
              console.log(
                chalk.yellow('\n💡 Use --continue to resume or --force to restart')
              );
              console.log(
                chalk.yellow(
                  '   Use --force --chapters <range> to regenerate specific chapters\n'
                )
              );
              process.exit(0);
            }
          }
        }
      }

      if (options.force && !shouldContinue) {
        console.log(chalk.yellow('⚠️  Force mode: Will regenerate content'));
        // Reset state
        stateManager = new StateManager(
          outputDir,
          bookFile,
          metadata.title,
          metadata.totalPages || 0
        );
      }

      progressTracker = new ProgressTracker(outputDir);
    } else {
      // Create new output directory and state
      await mkdir(outputDir, { recursive: true });
      stateManager = new StateManager(
        outputDir,
        bookFile,
        metadata.title,
        metadata.totalPages || 0
      );
      progressTracker = new ProgressTracker(outputDir);
    }

    // Always initialize progress tracker for dashboard support
    await progressTracker.initialize(metadata.title, chapters.length);

    // Start dashboard if requested
    if (options.dashboard) {
      dashboardServer = new DashboardServer(progressTracker, {
        port: options.dashboardPort || 3000,
        host: options.dashboardHost || 'localhost',
      });

      await dashboardServer.start();
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
    const needsText = options.text || (!options.elements && !options.enrich && !options.images);
    const needsElements = !!options.elements;
    const needsEnrich = !!options.enrich;
    const needsImages = !!options.images;

    // Filter chapters if requested
    let chaptersToProcess = chapters;
    if (options.chapters) {
      // Parse as story chapter numbers (1, 2, 3... = first story chapters)
      const storyChapterNums = parseChapterSelection(options.chapters);

      // Map story chapter numbers to EPUB chapter numbers
      const epubChapterNums = mapStoryChaptersToEpub(
        storyChapterNums,
        chapters.map((c) => ({
          chapterNumber: c.chapterNumber,
          chapterTitle: c.chapterTitle,
        }))
      );

      chaptersToProcess = chapters.filter((c) =>
        epubChapterNums.includes(c.chapterNumber)
      );

      if (chaptersToProcess.length === 0) {
        throw new Error(`No chapters found matching: ${options.chapters}`);
      }

      // Show mapping information
      console.log(
        chalk.cyan(`📋 Processing ${chaptersToProcess.length} story chapters:`)
      );
      chaptersToProcess.forEach((ch, idx) => {
        const storyNum = storyChapterNums[idx];
        console.log(
          chalk.gray(
            `   Story Ch ${storyNum} → EPUB Ch ${ch.chapterNumber}: ${ch.chapterTitle}`
          )
        );
      });
      console.log('');
    }

    // Prepare API configuration
    spinner.start('Preparing API configuration...');
    const { textConfig, imageConfig, warnings } = await prepareConfiguration(
      config,
      needsImages
    );

    for (const warning of warnings) {
      spinner.warn(warning);
    }

    spinner.succeed('API configuration ready');

    // Initialize OpenAI clients (or Google native adapter)
    let openai: IAiClient;
    if (isGoogleNativeEndpoint(textConfig.baseUrl)) {
      console.log(chalk.cyan('Using Google Gemini native API (direct endpoint)'));
      openai = new GoogleGeminiAdapter({
        apiKey: textConfig.apiKey,
        model: typeof textConfig.model === 'string' ? textConfig.model : textConfig.model.name,
        baseUrl: textConfig.baseUrl,
      });
    } else {
      openai = new OpenAI({
        apiKey: textConfig.apiKey,
        baseURL: textConfig.baseUrl,
      });
    }

    let imageOpenai: OpenAI | undefined;
    if (imageConfig) {
      imageOpenai = new OpenAI({
        apiKey: imageConfig.apiKey,
        baseURL: imageConfig.baseUrl,
      });
    }

    // Merge CLI options into config
    const runtimeConfig = {
      ...config,
      limit: options.limit, // Add limit from CLI options
      retryControl: {
        skipFailed: options.skipFailed || config.retryControl?.skipFailed || false,
        retryFailed: options.retryFailed || config.retryControl?.retryFailed || false,
        clearErrors: options.clearErrors || config.retryControl?.clearErrors || false,
      },
    } as Required<IllustrateConfig> & { limit?: number };

    // Create phase context
    const context = {
      config: runtimeConfig,
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
      // Handle retry control flags
      if (runtimeConfig.retryControl?.clearErrors) {
        const phases = ['analyze', 'extract', 'illustrate'] as const;
        let totalCleared = 0;
        for (const phase of phases) {
          const cleared = stateManager.clearChapterErrors(phase);
          totalCleared += cleared;
        }
        if (totalCleared > 0) {
          console.log(
            chalk.yellow(`🔄 Cleared ${totalCleared} failed chapter(s) for retry\n`)
          );
          await stateManager.save();
        }
      }

      if (runtimeConfig.retryControl?.skipFailed) {
        console.log(
          chalk.yellow(
            '⚠️  Skip-failed mode: Will continue processing even if chapters fail\n'
          )
        );
      }

      if (runtimeConfig.retryControl?.retryFailed) {
        console.log(
          chalk.yellow(
            '🔁 Retry-failed mode: Only processing chapters that previously failed\n'
          )
        );
      }

      // Use v2 phases if --concurrent flag is set
      const useConcurrent = options.concurrent || false;

      if (useConcurrent) {
        console.log(chalk.yellow('⚡ Concurrent processing enabled (experimental)\n'));
      }

      // CRITICAL: Analyze phase must execute BEFORE extract phase
      // This ensures unified analysis extracts both scenes AND elements
      // Extract phase can then reuse elements from analyze phase
      if (needsText) {
        console.log(chalk.cyan('📝 Phase: Analyze (--text)\n'));
        progressTracker.setPhase('analyze');
        const analyzePhase = useConcurrent
          ? new AnalyzePhaseV2(context)
          : new AnalyzePhase(context);
        await analyzePhase.execute();
        console.log('');
      }

      if (needsElements) {
        console.log(chalk.cyan('🔍 Phase: Extract (--elements)\n'));
        progressTracker.setPhase('extract');
        const extractPhase = new ExtractPhase(context);
        await extractPhase.execute();
        console.log('');
      }

      if (needsEnrich) {
        console.log(chalk.cyan('✨ Phase: Enrich (--enrich)\n'));
        progressTracker.setPhase('enrich');
        const enrichPhase = new EnrichPhase(context);
        await enrichPhase.execute();
        console.log('');
      }

      if (needsImages) {
        console.log(chalk.cyan('🎨 Phase: Illustrate (--images)\n'));
        progressTracker.setPhase('illustrate');
        const illustratePhase = useConcurrent
          ? new IllustratePhaseV2(context)
          : new IllustratePhase(context);
        await illustratePhase.execute();
        console.log('');
      }

      // Generate Contents.md TOC if we have any content
      const state = stateManager.getState();
      const hasChapters = state.phases.analyze.status === 'completed';
      const hasElements = state.phases.extract.status === 'completed';

      if (hasChapters || hasElements) {
        // Count chapters and elements
        const chaptersCount = Object.values(state.phases.analyze.chapters || {}).reduce(
          (sum, ch) => sum + (ch.concepts || 0),
          0
        );
        const elementsCount = state.elements?.length || 0;

        await generateContentsFile(
          outputDir,
          {
            title: metadata.title,
            author: metadata.author,
            totalPages: metadata.totalPages,
          },
          chaptersCount,
          elementsCount
        );
      }

      // Post-processing: PDF Compilation
      if (options.pdf) {
        spinner.start('Checking for images to compile...');
        const filesInOutputDir = await readdir(outputDir).catch(() => []);
        const imageFiles = filesInOutputDir.filter((f) => f.endsWith('.png'));

        if (imageFiles.length === 0) {
          spinner.warn('No images found to compile into a PDF. Skipping.');
        } else {
          spinner.succeed(
            `${imageFiles.length} images found. Starting PDF compilation...`
          );
          console.log(chalk.cyan('\n📦 Compiling graphic novel PDF...\n'));

          const pdfSanitizedName = sanitizeFilename(metadata.title || basename(bookFile));
          const pdfOutputPath = join(outputDir, '..', `${pdfSanitizedName}.pdf`);
          // Resolve script path relative to package directory (../ from dist to scripts)
          const scriptPath = join(__dirname, '..', 'scripts', 'compile_pdf.py');
          const title = metadata.title || 'Illustrated Book';
          const author = metadata.author || 'Unknown';

          try {
            const command = [
              'python3',
              `"${scriptPath}"`,
              `"${outputDir}"`,
              `"${pdfOutputPath}"`,
            ].join(' ');

            console.log(chalk.gray(`> ${command}\n`));
            execSync(command, { stdio: 'inherit' });
            console.log(chalk.green(`\n✅ PDF successfully generated at: ${pdfOutputPath}`));
          } catch (error: any) {
            console.error(chalk.red('\n❌ PDF compilation failed.'));
            console.error(chalk.yellow(`   ${error.message || error}`));
            console.error(
              chalk.yellow(
                '   Please ensure Python 3 and required packages (Pillow, reportlab, qrcode, openai) are installed.'
              )
            );
          }
          console.log('');
        }
      }

      // Post-processing: CBZ Compilation
      if (options.cbz || options.allFormats) {
        spinner.start('Checking for images to compile into CBZ...');
        const filesInOutputDir = await readdir(outputDir).catch(() => []);
        const imageFiles = filesInOutputDir.filter((f) => f.endsWith('.png'));

        if (imageFiles.length === 0) {
          spinner.warn('No images found to compile into a CBZ. Skipping.');
        } else {
          spinner.succeed(
            `${imageFiles.length} images found. Starting CBZ compilation...`
          );
          console.log(chalk.cyan('\n📦 Compiling CBZ archive...\n'));

          const cbzSanitizedName = sanitizeFilename(metadata.title || basename(bookFile));
          const cbzOutputPath = join(outputDir, '..', `${cbzSanitizedName}.cbz`);
          const scriptPath = join(__dirname, '..', 'scripts', 'compile_cbz.py');

          try {
            const command = [
              'python3',
              `"${scriptPath}"`,
              `"${outputDir}"`,
              `"${cbzOutputPath}"`,
              `--title="${metadata.title || 'Illustrated Book'}"`,
              `--author="${metadata.author || 'Unknown'}"`,
            ].join(' ');

            console.log(chalk.gray(`> ${command}\n`));
            execSync(command, { stdio: 'inherit' });
            console.log(chalk.green(`\n✅ CBZ successfully generated at: ${cbzOutputPath}`));
          } catch (error: any) {
            console.error(chalk.red('\n❌ CBZ compilation failed.'));
            console.error(chalk.yellow(`   ${error.message || error}`));
          }
          console.log('');
        }
      }

      // Post-processing: EPUB Compilation
      if (options.epub || options.allFormats) {
        spinner.start('Checking for images to compile into EPUB...');
        const filesInOutputDir = await readdir(outputDir).catch(() => []);
        const imageFiles = filesInOutputDir.filter((f) => f.endsWith('.png'));

        if (imageFiles.length === 0) {
          spinner.warn('No images found to compile into an EPUB. Skipping.');
        } else {
          spinner.succeed(
            `${imageFiles.length} images found. Starting EPUB compilation...`
          );
          console.log(chalk.cyan('\n📖 Compiling EPUB eBook...\n'));

          const epubSanitizedName = sanitizeFilename(metadata.title || basename(bookFile));
          const epubOutputPath = join(outputDir, '..', `${epubSanitizedName}.epub`);
          const scriptPath = join(__dirname, '..', 'scripts', 'compile_epub.py');

          try {
            const command = [
              'python3',
              `"${scriptPath}"`,
              `"${outputDir}"`,
              `"${epubOutputPath}"`,
              `--title="${metadata.title || 'Illustrated Book'}"`,
              `--author="${metadata.author || 'Unknown'}"`,
            ].join(' ');

            console.log(chalk.gray(`> ${command}\n`));
            execSync(command, { stdio: 'inherit' });
            console.log(chalk.green(`\n✅ EPUB successfully generated at: ${epubOutputPath}`));
          } catch (error: any) {
            console.error(chalk.red('\n❌ EPUB compilation failed.'));
            console.error(chalk.yellow(`   ${error.message || error}`));
          }
          console.log('');
        }
      }

      // Post-processing: HTML Gallery
      if (options.html || options.allFormats) {
        spinner.start('Checking for images to compile into HTML gallery...');
        const filesInOutputDir = await readdir(outputDir).catch(() => []);
        const imageFiles = filesInOutputDir.filter((f) => f.endsWith('.png'));

        if (imageFiles.length === 0) {
          spinner.warn('No images found to compile into HTML. Skipping.');
        } else {
          spinner.succeed(
            `${imageFiles.length} images found. Starting HTML gallery generation...`
          );
          console.log(chalk.cyan('\n🌐 Generating HTML gallery...\n'));

          const htmlSanitizedName = sanitizeFilename(metadata.title || basename(bookFile));
          const htmlOutputPath = join(outputDir, '..', `${htmlSanitizedName}.html`);
          const scriptPath = join(__dirname, '..', 'scripts', 'compile_html.py');

          try {
            const command = [
              'python3',
              `"${scriptPath}"`,
              `"${outputDir}"`,
              `"${htmlOutputPath}"`,
              `--title="${metadata.title || 'Illustrated Book'}"`,
              `--author="${metadata.author || 'Unknown'}"`,
            ].join(' ');

            console.log(chalk.gray(`> ${command}\n`));
            execSync(command, { stdio: 'inherit' });
            console.log(chalk.green(`\n✅ HTML gallery successfully generated at: ${htmlOutputPath}`));
          } catch (error: any) {
            console.error(chalk.red('\n❌ HTML gallery generation failed.'));
            console.error(chalk.yellow(`   ${error.message || error}`));
          }
          console.log('');
        }
      }

      // Post-processing: WebP Album
      if (options.webpAlbum || options.allFormats) {
        spinner.start('Checking for images to compile into WebP album...');
        const filesInOutputDir = await readdir(outputDir).catch(() => []);
        const imageFiles = filesInOutputDir.filter((f) => f.endsWith('.png'));

        if (imageFiles.length === 0) {
          spinner.warn('No images found to compile into WebP album. Skipping.');
        } else {
          spinner.succeed(
            `${imageFiles.length} images found. Starting WebP album compilation...`
          );
          console.log(chalk.cyan('\n🖼️ Compiling WebP album...\n'));

          const webpSanitizedName = sanitizeFilename(metadata.title || basename(bookFile));
          const webpOutputDir = join(outputDir, '..', `${webpSanitizedName}_webp`);
          const scriptPath = join(__dirname, '..', 'scripts', 'compile_webp_album.py');

          try {
            const command = [
              'python3',
              `"${scriptPath}"`,
              `"${outputDir}"`,
              `"${webpOutputDir}"`,
              `--title="${metadata.title || 'Illustrated Book'}"`,
              `--author="${metadata.author || 'Unknown'}"`,
            ].join(' ');

            console.log(chalk.gray(`> ${command}\n`));
            execSync(command, { stdio: 'inherit' });
            console.log(chalk.green(`\n✅ WebP album successfully generated at: ${webpOutputDir}`));
          } catch (error: any) {
            console.error(chalk.red('\n❌ WebP album compilation failed.'));
            console.error(chalk.yellow(`   ${error.message || error}`));
          }
          console.log('');
        }
      }

      // Post-processing: WebP Strip
      if (options.webpStrip || options.allFormats) {
        spinner.start('Checking for images to compile into WebP strip...');
        const filesInOutputDir = await readdir(outputDir).catch(() => []);
        const imageFiles = filesInOutputDir.filter((f) => f.endsWith('.png'));

        if (imageFiles.length === 0) {
          spinner.warn('No images found to compile into WebP strip. Skipping.');
        } else {
          spinner.succeed(
            `${imageFiles.length} images found. Starting WebP strip compilation...`
          );
          console.log(chalk.cyan('\n🎞️ Creating WebP strip...\n'));

          const stripSanitizedName = sanitizeFilename(metadata.title || basename(bookFile));
          const stripOutputPath = join(outputDir, '..', `${stripSanitizedName}_strip.webp`);
          const scriptPath = join(__dirname, '..', 'scripts', 'compile_webp_strip.py');

          try {
            const command = [
              'python3',
              `"${scriptPath}"`,
              `"${outputDir}"`,
              `"${stripOutputPath}"`,
              `--title="${metadata.title || 'Illustrated Book'}"`,
              `--author="${metadata.author || 'Unknown'}"`,
            ].join(' ');

            console.log(chalk.gray(`> ${command}\n`));
            execSync(command, { stdio: 'inherit' });
            console.log(chalk.green(`\n✅ WebP strip successfully generated at: ${stripOutputPath}`));
          } catch (error: any) {
            console.error(chalk.red('\n❌ WebP strip compilation failed.'));
            console.error(chalk.yellow(`   ${error.message || error}`));
          }
          console.log('');
        }
      }

      // Success summary
      progressTracker.setPhase('complete');
      console.log(chalk.green.bold('✨ Processing complete!\n'));
      console.log(chalk.white(`Output directory: ${chalk.cyan(outputDir)}`));
      console.log(chalk.white(`- progress.md: Processing log`));
      console.log(chalk.white(`- .imaginize.state.json: Machine state`));

      if (hasChapters || hasElements) {
        console.log(chalk.white(`- Contents.md: Table of contents`));
      }
      if (hasChapters) {
        console.log(chalk.white(`- Chapters.md: Visual scenes by chapter`));
      }
      if (hasElements) {
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
    } finally {
      // Stop dashboard server if it was started
      if (dashboardServer) {
        await dashboardServer.stop();
      }
    }
  } catch (error: any) {
    console.error(chalk.red('\n❌ Error:'), error.message);

    if (error.message.includes('API key')) {
      console.log(
        chalk.yellow(
          '\n💡 Tip: Run "imaginize --init-config" to create a configuration file'
        )
      );
      console.log(
        chalk.yellow(
          '   Or set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable\n'
        )
      );
    }

    process.exit(1);
  }
}
