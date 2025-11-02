/**
 * illustrate - AI-powered book illustration guide generator
 * Main entry point and orchestrator
 */

import { readdir, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { existsSync } from 'fs';
import OpenAI from 'openai';
import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';

import { loadConfig, getSampleConfig } from './lib/config.js';
import { parseEpub, sanitizeFilename } from './lib/epub-parser.js';
import { parsePdf } from './lib/pdf-parser.js';
import {
  analyzeChapter,
  extractElements,
  generateImage,
  processChaptersInBatches,
} from './lib/ai-analyzer.js';
import { generateContentsFile, generateElementsFile } from './lib/output-generator.js';
import { ProgressTracker } from './lib/progress-tracker.js';
import type { ImageConcept, BookElement } from './types/config.js';

/**
 * Find book files (EPUB or PDF) in current directory
 */
async function findBookFiles(): Promise<string[]> {
  const files = await readdir('.');
  return files.filter((f) => {
    const ext = extname(f).toLowerCase();
    return ext === '.epub' || ext === '.pdf';
  });
}

/**
 * Process a single book file
 */
async function processBook(filePath: string): Promise<void> {
  const spinner = ora('Loading configuration...').start();

  try {
    // Load configuration
    const config = await loadConfig();
    spinner.succeed('Configuration loaded');

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });

    // Parse the book
    spinner.start('Parsing book file...');
    const ext = extname(filePath).toLowerCase();
    const { metadata, chapters, fullText } =
      ext === '.epub' ? await parseEpub(filePath) : await parsePdf(filePath);

    spinner.succeed(
      `Parsed "${metadata.title}" - ${chapters.length} chapters, ${metadata.totalPages || '?'} pages`
    );

    // Create output directory
    const sanitizedName = sanitizeFilename(basename(filePath));
    const outputDir = config.outputPattern.replace('{name}', sanitizedName);

    if (existsSync(outputDir)) {
      spinner.warn(`Output directory ${outputDir} already exists, will overwrite`);
    } else {
      await mkdir(outputDir, { recursive: true });
    }

    // Initialize progress tracker
    const progress = new ProgressTracker(outputDir);
    await progress.initialize(metadata.title, chapters.length);
    await progress.log(`Processing: ${filePath}`, 'info');

    // Analyze chapters for visual concepts
    console.log(chalk.cyan('\n📚 Analyzing chapters for visual concepts...\n'));

    const conceptsByChapter = new Map<string, ImageConcept[]>();

    const chapterProcessor = async (chapter: any, index: number) => {
      spinner.start(
        `Analyzing chapter ${index + 1}/${chapters.length}: ${chapter.chapterTitle}`
      );
      await progress.startChapter(chapter.chapterNumber, chapter.chapterTitle);

      const concepts = await analyzeChapter(chapter, config, openai);
      conceptsByChapter.set(chapter.chapterTitle, concepts);

      await progress.completeChapter(
        chapter.chapterNumber,
        chapter.chapterTitle,
        concepts.length
      );
      spinner.succeed(
        `Chapter ${index + 1}/${chapters.length}: ${chapter.chapterTitle} - ${concepts.length} concepts`
      );
    };

    await processChaptersInBatches(
      chapters.map((c, i) => ({ ...c, index: i })),
      (c) => chapterProcessor(c, c.index),
      config.maxConcurrency
    );

    // Extract elements (characters, places, etc.)
    let elements: BookElement[] = [];
    if (config.extractElements) {
      console.log(chalk.cyan('\n🔍 Extracting story elements...\n'));
      spinner.start('Analyzing book for characters, places, items...');
      await progress.startElementExtraction();

      elements = await extractElements(fullText, config, openai);

      await progress.completeElementExtraction(elements.length);
      spinner.succeed(`Found ${elements.length} story elements`);

      // Generate images for elements if requested
      if (config.generateElementImages && elements.length > 0) {
        console.log(chalk.cyan('\n🎨 Generating images for elements...\n'));

        for (const element of elements) {
          spinner.start(`Generating image for: ${element.name}`);
          const imageUrl = await generateImage(
            element.description || element.name,
            config,
            openai
          );

          if (imageUrl) {
            element.imageUrl = imageUrl;
            await progress.logImageGeneration(element.name, true);
            spinner.succeed(`Generated image for: ${element.name}`);
          } else {
            await progress.logImageGeneration(element.name, false);
            spinner.fail(`Failed to generate image for: ${element.name}`);
          }
        }
      }
    }

    // Generate output files
    spinner.start('Generating Contents.md...');
    await generateContentsFile(outputDir, metadata, conceptsByChapter);
    spinner.succeed('Generated Contents.md');

    if (config.extractElements) {
      spinner.start('Generating Elements.md...');
      await generateElementsFile(outputDir, metadata, elements);
      spinner.succeed('Generated Elements.md');
    }

    // Finalize progress
    const totalConcepts = Array.from(conceptsByChapter.values()).reduce(
      (sum, concepts) => sum + concepts.length,
      0
    );
    const imagesGenerated = elements.filter((e) => e.imageUrl).length;

    await progress.finalize(totalConcepts, elements.length, imagesGenerated);

    // Success summary
    console.log(chalk.green.bold('\n✨ Processing complete!\n'));
    console.log(chalk.white(`Output directory: ${chalk.cyan(outputDir)}`));
    console.log(chalk.white(`- Contents.md: ${chalk.yellow(totalConcepts)} visual concepts`));
    if (config.extractElements) {
      console.log(chalk.white(`- Elements.md: ${chalk.yellow(elements.length)} story elements`));
    }
    console.log(chalk.white(`- progress.md: Full processing log\n`));
  } catch (error) {
    spinner.fail('Processing failed');
    throw error;
  }
}

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  const program = new Command();

  program
    .name('illustrate')
    .description('AI-powered book illustration guide generator')
    .version('1.0.0')
    .option('-f, --file <path>', 'Specific book file to process')
    .option('--init-config', 'Generate sample .illustrate.config file')
    .action(async (options) => {
      try {
        // Generate sample config if requested
        if (options.initConfig) {
          const configContent = getSampleConfig();
          const { writeFile } = await import('fs/promises');
          await writeFile('.illustrate.config', configContent);
          console.log(chalk.green('✅ Created .illustrate.config file'));
          console.log(
            chalk.yellow('⚠️  Remember to add your OpenAI API key to the file!')
          );
          return;
        }

        // Find book files
        const bookFiles = options.file
          ? [options.file]
          : await findBookFiles();

        if (bookFiles.length === 0) {
          console.error(
            chalk.red('❌ No book files found. Please provide an EPUB or PDF file.')
          );
          process.exit(1);
        }

        console.log(
          chalk.cyan.bold(
            `\n📖 illustrate - AI Book Illustration Guide Generator\n`
          )
        );

        // Process each book
        for (const bookFile of bookFiles) {
          console.log(chalk.white(`\nProcessing: ${chalk.cyan(bookFile)}\n`));
          await processBook(bookFile);
        }
      } catch (error: any) {
        console.error(chalk.red('\n❌ Error:'), error.message);
        if (error.message.includes('API key')) {
          console.log(
            chalk.yellow(
              '\n💡 Tip: Run "illustrate --init-config" to create a configuration file'
            )
          );
        }
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}
