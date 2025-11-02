/**
 * Multi-file selection UI for choosing which book to process
 */

import { readdir, stat } from 'fs/promises';
import { extname, basename } from 'path';
import readline from 'readline';

export interface BookFile {
  path: string;
  name: string;
  size: number;
  modified: Date;
  extension: string;
}

/**
 * Find all book files in current directory
 */
export async function findBookFiles(): Promise<BookFile[]> {
  const files = await readdir('.');
  const bookFiles: BookFile[] = [];

  for (const file of files) {
    const ext = extname(file).toLowerCase();

    if (ext === '.epub' || ext === '.pdf') {
      try {
        const stats = await stat(file);

        bookFiles.push({
          path: file,
          name: basename(file),
          size: stats.size,
          modified: stats.mtime,
          extension: ext,
        });
      } catch (error) {
        // Skip files we can't read
        continue;
      }
    }
  }

  // Sort by modification time (newest first)
  bookFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());

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
 */
export async function selectBookFile(files: BookFile[]): Promise<BookFile | null> {
  if (files.length === 0) {
    return null;
  }

  if (files.length === 1) {
    return files[0];
  }

  console.log('\nMultiple book files found:\n');

  files.forEach((file, index) => {
    console.log(
      `${index + 1}. ${file.name} (${formatFileSize(file.size)}, modified: ${formatDate(file.modified)})`
    );
  });

  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`Select a file to process (1-${files.length}): `, (answer) => {
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
