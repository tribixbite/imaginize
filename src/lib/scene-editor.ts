/**
 * Scene Editor - Interactive editing of scene prompts in Chapters.md
 *
 * Allows viewing and editing scene descriptions before regeneration
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import readline from 'readline';
import chalk from 'chalk';
import type { ImageConcept } from '../types/config.js';
import type { SceneIdentifier } from './regenerate.js';

/**
 * Interactive prompt editor
 */
export class SceneEditor {
  private outputDir: string;
  private chaptersPath: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    this.chaptersPath = join(outputDir, 'Chapters.md');
  }

  /**
   * Edit scene prompts interactively
   */
  async editScenes(scenes: SceneIdentifier[]): Promise<Map<string, ImageConcept>> {
    if (!existsSync(this.chaptersPath)) {
      throw new Error('Chapters.md not found. Run analyze phase first.');
    }

    console.log(chalk.cyan('\n✏️  Interactive Scene Editor\n'));
    console.log(`Editing ${scenes.length} scene(s). Press Ctrl+C to cancel.\n`);

    const editedConcepts = new Map<string, ImageConcept>();

    for (const scene of scenes) {
      const sceneKey = `${scene.chapterNumber}_${scene.sceneNumber}`;

      console.log(
        chalk.yellow(`\n📍 Chapter ${scene.chapterNumber}: ${scene.chapterTitle}`)
      );
      console.log(chalk.yellow(`   Scene ${scene.sceneNumber}\n`));

      // Show current description
      console.log(chalk.gray('Current description:'));
      console.log(chalk.white(this.wrapText(scene.concept.description, 80)));
      console.log();

      // Ask if user wants to edit
      const shouldEdit = await this.promptYesNo('Edit this scene?', true);

      if (!shouldEdit) {
        console.log(chalk.gray('Skipped.\n'));
        continue;
      }

      // Edit the description
      const newDescription = await this.promptMultilineText(
        'Enter new description (press Ctrl+D or type "END" on new line to finish):',
        scene.concept.description
      );

      if (newDescription.trim() === scene.concept.description.trim()) {
        console.log(chalk.gray('No changes made.\n'));
        continue;
      }

      // Create updated concept
      const updatedConcept: ImageConcept = {
        ...scene.concept,
        description: newDescription.trim(),
      };

      editedConcepts.set(sceneKey, updatedConcept);
      console.log(chalk.green('✓ Scene updated\n'));
    }

    if (editedConcepts.size === 0) {
      console.log(chalk.gray('No scenes were edited.'));
      return editedConcepts;
    }

    // Save changes to Chapters.md
    console.log(chalk.cyan(`\n💾 Saving ${editedConcepts.size} edited scene(s)...`));
    await this.saveEditedScenes(editedConcepts);
    console.log(chalk.green('✅ Changes saved to Chapters.md\n'));

    return editedConcepts;
  }

  /**
   * Save edited scenes back to Chapters.md
   */
  private async saveEditedScenes(
    editedConcepts: Map<string, ImageConcept>
  ): Promise<void> {
    const content = await readFile(this.chaptersPath, 'utf-8');
    const lines = content.split('\n');

    let output = '';
    let currentChapter = 0;
    let currentScene = 0;
    let inJsonBlock = false;
    let jsonBuffer = '';
    let skipNextLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (skipNextLines > 0) {
        skipNextLines--;
        continue;
      }

      // Detect chapter
      if (line.startsWith('### Chapter ')) {
        const match = line.match(/### Chapter (\d+)/);
        if (match) {
          currentChapter = parseInt(match[1]);
          currentScene = 0;
        }
        output += line + '\n';
        continue;
      }

      // Detect scene
      if (line.startsWith('#### Scene ')) {
        const match = line.match(/#### Scene (\d+)/);
        if (match) {
          currentScene = parseInt(match[1]);
        }
        output += line + '\n';
        continue;
      }

      // Handle JSON blocks
      if (line.startsWith('```json')) {
        inJsonBlock = true;
        jsonBuffer = '';
        continue;
      }

      if (line.startsWith('```') && inJsonBlock) {
        inJsonBlock = false;

        // Check if this scene was edited
        const sceneKey = `${currentChapter}_${currentScene}`;
        const editedConcept = editedConcepts.get(sceneKey);

        if (editedConcept) {
          // Write updated JSON
          output += '```json\n';
          output += JSON.stringify(editedConcept, null, 2) + '\n';
          output += '```\n';
        } else {
          // Write original JSON
          output += '```json\n';
          output += jsonBuffer;
          output += '```\n';
        }

        continue;
      }

      if (inJsonBlock) {
        jsonBuffer += line + '\n';
        continue;
      }

      // Regular line
      output += line + '\n';
    }

    await writeFile(this.chaptersPath, output.trimEnd() + '\n');
  }

  /**
   * Prompt for yes/no input
   */
  private async promptYesNo(
    question: string,
    defaultYes: boolean = true
  ): Promise<boolean> {
    const hint = defaultYes ? '[Y/n]' : '[y/N]';
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(chalk.cyan(`${question} ${hint} `), (answer) => {
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
   * Prompt for multiline text input
   */
  private async promptMultilineText(
    prompt: string,
    defaultValue: string
  ): Promise<string> {
    console.log(chalk.cyan(prompt));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const lines: string[] = [];

    return new Promise((resolve) => {
      rl.on('line', (line) => {
        if (line.trim() === 'END') {
          rl.close();
        } else {
          lines.push(line);
        }
      });

      rl.on('close', () => {
        if (lines.length === 0) {
          resolve(defaultValue);
        } else {
          resolve(lines.join('\n'));
        }
      });

      // Handle Ctrl+D (EOF)
      rl.on('SIGINT', () => {
        rl.close();
      });
    });
  }

  /**
   * Wrap text to specified width
   */
  private wrapText(text: string, width: number): string {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 > width) {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      } else {
        currentLine += (currentLine ? ' ' : '') + word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }
}

/**
 * View scene details without editing
 */
export async function viewScene(scene: SceneIdentifier): Promise<void> {
  console.log(chalk.cyan('\n📍 Scene Details\n'));
  console.log(chalk.yellow(`Chapter ${scene.chapterNumber}: ${scene.chapterTitle}`));
  console.log(chalk.yellow(`Scene ${scene.sceneNumber}\n`));

  console.log(chalk.gray('Description:'));
  console.log(chalk.white(scene.concept.description));
  console.log();

  if (scene.concept.mood) {
    console.log(chalk.gray(`Mood: ${scene.concept.mood}`));
  }

  if (scene.concept.lighting) {
    console.log(chalk.gray(`Lighting: ${scene.concept.lighting}`));
  }

  if (scene.imageFilename) {
    console.log(chalk.gray(`\nCurrent image: ${scene.imageFilename}`));
  } else {
    console.log(chalk.gray('\nNo image generated yet'));
  }

  console.log();
}
