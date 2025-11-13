/**
 * Multi-file selection UI for choosing which book to process
 */

import { readdir, stat } from 'fs/promises';
import { extname, basename } from 'path';
import { existsSync, readFileSync } from 'fs';
import readline from 'readline';
import { sanitizeFilename } from './epub-parser.js';

export interface BookFile {
  path: string;
  name: string;
  size: number;
  modified: Date;
  extension: string;
  processed: boolean;
}

/**
 * Check if a book file has been processed
 */
function isProcessed(file: string, outputPattern: string = 'imaginize_{name}'): boolean {
  const sanitizedName = sanitizeFilename(basename(file));
  const outputDir = outputPattern.replace('{name}', sanitizedName);

  if (!existsSync(outputDir)) {
    return false;
  }

  // Check if state file exists and has completed status
  const stateFile = `${outputDir}/.imaginize.state.json`;
  if (!existsSync(stateFile)) {
    return false;
  }

  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    // Consider processed if analyze phase is completed
    return state.phases?.analyze?.status === 'completed';
  } catch {
    return false;
  }
}

/**
 * Find all book files in current directory
 */
export async function findBookFiles(outputPattern?: string): Promise<BookFile[]> {
  const files = await readdir('.');
  const bookFiles: BookFile[] = [];

  for (const file of files) {
    const ext = extname(file).toLowerCase();

    if (ext === '.epub' || ext === '.pdf') {
      try {
        const stats = await stat(file);
        const processed = isProcessed(file, outputPattern);

        bookFiles.push({
          path: file,
          name: basename(file),
          size: stats.size,
          modified: stats.mtime,
          extension: ext,
          processed,
        });
      } catch (error) {
        // Skip files we can't read
        continue;
      }
    }
  }

  // Sort: unprocessed first, then by modification time (newest first)
  bookFiles.sort((a, b) => {
    if (a.processed !== b.processed) {
      return a.processed ? 1 : -1;
    }
    return b.modified.getTime() - a.modified.getTime();
  });

  return bookFiles;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Display file selection UI and get user's choice
 * Automatically selects the first unprocessed file if available
 */
export async function selectBookFile(files: BookFile[]): Promise<BookFile | null> {
  if (files.length === 0) {
    return null;
  }

  // Find first unprocessed file
  const unprocessed = files.find((f) => !f.processed);

  if (unprocessed) {
    // Auto-select first unprocessed file
    console.log(`\n📚 Auto-selected next unprocessed book: ${unprocessed.name}\n`);
    return unprocessed;
  }

  // All files processed - let user choose
  if (files.length === 1) {
    console.log(`\n⚠️  Book already processed: ${files[0].name}`);
    console.log('Use --force to regenerate\n');
    return files[0];
  }

  console.log('\n⚠️  All book files have been processed:\n');

  files.forEach((file, index) => {
    const status = file.processed ? '✓ processed' : '';
    console.log(
      `${index + 1}. ${file.name} (${formatFileSize(file.size)}, modified: ${formatDate(file.modified)}) ${status}`
    );
  });

  console.log('\n💡 Use --force to regenerate any book\n');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`Select a file to reprocess (1-${files.length}): `, (answer) => {
      rl.close();

      const selection = parseInt(answer.trim(), 10);

      if (isNaN(selection) || selection < 1 || selection > files.length) {
        console.log('Invalid selection. Exiting.');
        resolve(null);
      } else {
        resolve(files[selection - 1]);
      }
    });
  });
}
