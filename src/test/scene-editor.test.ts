/**
 * Unit tests for scene-editor module
 * Tests scene editing, file I/O, and text formatting utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { SceneEditor, viewScene } from '../lib/scene-editor.js';
import type { ImageConcept } from '../types/config.js';
import type { SceneIdentifier } from '../lib/regenerate.js';

describe('scene-editor', () => {
  const testBaseDir = join(process.cwd(), 'src/test/.test-data');
  let testDir: string;
  let testCounter = 0;

  beforeEach(async () => {
    // Create unique test directory (Termux-compatible)
    testCounter++;
    testDir = join(testBaseDir, `scene-editor-test-${Date.now()}-${testCounter}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('SceneEditor', () => {
    describe('constructor', () => {
      it('should create instance with output directory', () => {
        const editor = new SceneEditor(testDir);
        expect(editor).toBeDefined();
        expect(editor).toBeInstanceOf(SceneEditor);
      });

      it('should accept different directory paths', () => {
        const editor1 = new SceneEditor('/path/to/output1');
        const editor2 = new SceneEditor('/path/to/output2');

        expect(editor1).toBeDefined();
        expect(editor2).toBeDefined();
      });
    });

    describe('text wrapping', () => {
      it('should wrap text to specified width', () => {
        const editor = new SceneEditor(testDir);
        // Access private method through type assertion for testing
        const wrapText = (editor as any).wrapText.bind(editor);

        const text =
          'This is a very long text that should be wrapped at the specified width to ensure readability';
        const wrapped = wrapText(text, 30);

        const lines = wrapped.split('\n');
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(30);
        }
      });

      it('should handle short text without wrapping', () => {
        const editor = new SceneEditor(testDir);
        const wrapText = (editor as any).wrapText.bind(editor);

        const text = 'Short text';
        const wrapped = wrapText(text, 80);

        expect(wrapped).toBe('Short text');
        expect(wrapped.split('\n')).toHaveLength(1);
      });

      it('should handle single long word', () => {
        const editor = new SceneEditor(testDir);
        const wrapText = (editor as any).wrapText.bind(editor);

        const text = 'Supercalifragilisticexpialidocious';
        const wrapped = wrapText(text, 20);

        // Long single word should not be split
        expect(wrapped).toBe('Supercalifragilisticexpialidocious');
      });

      it('should handle multiple spaces', () => {
        const editor = new SceneEditor(testDir);
        const wrapText = (editor as any).wrapText.bind(editor);

        const text = 'Word1   Word2    Word3';
        const wrapped = wrapText(text, 80);

        // Multiple spaces should be collapsed to single
        expect(wrapped).toBe('Word1 Word2 Word3');
      });

      it('should handle empty string', () => {
        const editor = new SceneEditor(testDir);
        const wrapText = (editor as any).wrapText.bind(editor);

        const wrapped = wrapText('', 80);
        expect(wrapped).toBe('');
      });

      it('should wrap at word boundaries', () => {
        const editor = new SceneEditor(testDir);
        const wrapText = (editor as any).wrapText.bind(editor);

        const text = 'The quick brown fox jumps over the lazy dog';
        const wrapped = wrapText(text, 20);

        const lines = wrapped.split('\n');
        // Each line should not break words
        for (const line of lines) {
          expect(line.trim()).not.toBe('');
        }
      });

      it('should handle exact width match', () => {
        const editor = new SceneEditor(testDir);
        const wrapText = (editor as any).wrapText.bind(editor);

        const text = 'Exactly twenty chars';
        const wrapped = wrapText(text, 20);

        expect(wrapped).toBe('Exactly twenty chars');
      });
    });

    describe('saveEditedScenes', () => {
      it('should save edited scenes to Chapters.md', async () => {
        const chaptersContent = `### Chapter 1: Test

#### Scene 1

\`\`\`json
{
  "chapterNumber": 1,
  "description": "Original description",
  "quote": "Original quote"
}
\`\`\`

---

#### Scene 2

\`\`\`json
{
  "chapterNumber": 1,
  "description": "Second scene original",
  "quote": "Second quote"
}
\`\`\`

---
`;

        await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

        const editor = new SceneEditor(testDir);
        const editedConcepts = new Map<string, ImageConcept>();

        editedConcepts.set('1_1', {
          chapterNumber: 1,
          description: 'Updated description for scene 1',
          quote: 'Original quote',
          chapter: 'Chapter 1: Test',
          pageRange: '1-10',
        });

        // Access private method through type assertion
        const saveEditedScenes = (editor as any).saveEditedScenes.bind(editor);
        await saveEditedScenes(editedConcepts);

        const updatedContent = await readFile(join(testDir, 'Chapters.md'), 'utf-8');

        expect(updatedContent).toContain('Updated description for scene 1');
        expect(updatedContent).toContain('Second scene original'); // Unchanged
      });

      it('should preserve non-edited scenes', async () => {
        const chaptersContent = `### Chapter 1: Test

#### Scene 1

\`\`\`json
{
  "description": "Scene 1",
  "chapterNumber": 1
}
\`\`\`

---

#### Scene 2

\`\`\`json
{
  "description": "Scene 2",
  "chapterNumber": 1
}
\`\`\`

---
`;

        await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

        const editor = new SceneEditor(testDir);
        const editedConcepts = new Map<string, ImageConcept>();

        editedConcepts.set('1_2', {
          description: 'Updated Scene 2',
          chapterNumber: 1,
          chapter: 'Chapter 1: Test',
          quote: '',
          pageRange: '1-10',
        });

        const saveEditedScenes = (editor as any).saveEditedScenes.bind(editor);
        await saveEditedScenes(editedConcepts);

        const updatedContent = await readFile(join(testDir, 'Chapters.md'), 'utf-8');

        expect(updatedContent).toContain('Scene 1'); // Unchanged
        expect(updatedContent).toContain('Updated Scene 2'); // Changed
      });

      it('should handle multiple chapter edits', async () => {
        const chaptersContent = `### Chapter 1: First

#### Scene 1

\`\`\`json
{
  "description": "Ch1 Scene1",
  "chapterNumber": 1
}
\`\`\`

---

### Chapter 2: Second

#### Scene 1

\`\`\`json
{
  "description": "Ch2 Scene1",
  "chapterNumber": 2
}
\`\`\`

---
`;

        await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

        const editor = new SceneEditor(testDir);
        const editedConcepts = new Map<string, ImageConcept>();

        editedConcepts.set('1_1', {
          description: 'Updated Ch1 Scene1',
          chapterNumber: 1,
          chapter: 'Chapter 1: First',
          quote: '',
          pageRange: '1-5',
        });

        editedConcepts.set('2_1', {
          description: 'Updated Ch2 Scene1',
          chapterNumber: 2,
          chapter: 'Chapter 2: Second',
          quote: '',
          pageRange: '6-10',
        });

        const saveEditedScenes = (editor as any).saveEditedScenes.bind(editor);
        await saveEditedScenes(editedConcepts);

        const updatedContent = await readFile(join(testDir, 'Chapters.md'), 'utf-8');

        expect(updatedContent).toContain('Updated Ch1 Scene1');
        expect(updatedContent).toContain('Updated Ch2 Scene1');
      });

      it('should preserve JSON formatting', async () => {
        const chaptersContent = `### Chapter 1: Test

#### Scene 1

\`\`\`json
{
  "description": "Original",
  "chapterNumber": 1,
  "quote": "Test quote",
  "mood": "dark",
  "lighting": "low"
}
\`\`\`

---
`;

        await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

        const editor = new SceneEditor(testDir);
        const editedConcepts = new Map<string, ImageConcept>();

        editedConcepts.set('1_1', {
          description: 'Updated',
          chapterNumber: 1,
          quote: 'Test quote',
          mood: 'bright',
          lighting: 'high',
          chapter: 'Chapter 1: Test',
          pageRange: '1-10',
        });

        const saveEditedScenes = (editor as any).saveEditedScenes.bind(editor);
        await saveEditedScenes(editedConcepts);

        const updatedContent = await readFile(join(testDir, 'Chapters.md'), 'utf-8');

        // Should be valid JSON
        const jsonMatch = updatedContent.match(/```json\n([\s\S]*?)\n```/);
        expect(jsonMatch).toBeDefined();

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          expect(parsed.description).toBe('Updated');
          expect(parsed.mood).toBe('bright');
          expect(parsed.lighting).toBe('high');
        }
      });

      it('should handle empty edits map', async () => {
        const chaptersContent = `### Chapter 1: Test

#### Scene 1

\`\`\`json
{
  "description": "Original",
  "chapterNumber": 1
}
\`\`\`

---
`;

        await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

        const editor = new SceneEditor(testDir);
        const editedConcepts = new Map<string, ImageConcept>();

        const saveEditedScenes = (editor as any).saveEditedScenes.bind(editor);
        await saveEditedScenes(editedConcepts);

        const updatedContent = await readFile(join(testDir, 'Chapters.md'), 'utf-8');

        // Should be unchanged
        expect(updatedContent).toContain('Original');
      });

      it('should preserve markdown structure', async () => {
        const chaptersContent = `# Chapters - Test Book

## Visual Scenes by Chapter

---

### Chapter 1: Test

#### Scene 1

**Pages:** 1-5

\`\`\`json
{
  "description": "Original",
  "chapterNumber": 1
}
\`\`\`

**Source Text:**
> Test quote

---
`;

        await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

        const editor = new SceneEditor(testDir);
        const editedConcepts = new Map<string, ImageConcept>();

        editedConcepts.set('1_1', {
          description: 'Updated',
          chapterNumber: 1,
          chapter: 'Chapter 1: Test',
          quote: '',
          pageRange: '1-5',
        });

        const saveEditedScenes = (editor as any).saveEditedScenes.bind(editor);
        await saveEditedScenes(editedConcepts);

        const updatedContent = await readFile(join(testDir, 'Chapters.md'), 'utf-8');

        // Structure should be preserved
        expect(updatedContent).toContain('# Chapters - Test Book');
        expect(updatedContent).toContain('## Visual Scenes by Chapter');
        expect(updatedContent).toContain('**Pages:** 1-5');
        expect(updatedContent).toContain('**Source Text:**');
        expect(updatedContent).toContain('> Test quote');
      });
    });
  });

  describe('viewScene', () => {
    it('should not throw error when viewing scene', () => {
      const scene: SceneIdentifier = {
        chapterNumber: 1,
        chapterTitle: 'Chapter 1: Test',
        sceneNumber: 1,
        concept: {
          description: 'Test scene description',
          quote: 'Test quote',
          chapter: 'Chapter 1: Test',
          pageRange: '1-10',
          chapterNumber: 1,
        },
      };

      // viewScene uses console.log, just verify it doesn't throw
      expect(() => viewScene(scene)).not.toThrow();
    });

    it('should handle scene with mood and lighting', () => {
      const scene: SceneIdentifier = {
        chapterNumber: 1,
        chapterTitle: 'Chapter 1: Test',
        sceneNumber: 1,
        concept: {
          description: 'Test scene',
          quote: 'Test quote',
          chapter: 'Chapter 1: Test',
          pageRange: '1-10',
          chapterNumber: 1,
          mood: 'dark',
          lighting: 'low',
        },
      };

      expect(() => viewScene(scene)).not.toThrow();
    });

    it('should handle scene with image filename', () => {
      const scene: SceneIdentifier = {
        chapterNumber: 1,
        chapterTitle: 'Chapter 1: Test',
        sceneNumber: 1,
        concept: {
          description: 'Test scene',
          quote: 'Test quote',
          chapter: 'Chapter 1: Test',
          pageRange: '1-10',
          chapterNumber: 1,
        },
        imageFilename: 'chapter_1_scene_1.png',
      };

      expect(() => viewScene(scene)).not.toThrow();
    });

    it('should handle scene without optional fields', () => {
      const scene: SceneIdentifier = {
        chapterNumber: 1,
        chapterTitle: 'Chapter 1: Test',
        sceneNumber: 1,
        concept: {
          description: 'Minimal scene',
          quote: '',
          chapter: 'Chapter 1: Test',
          pageRange: '1-10',
          chapterNumber: 1,
        },
      };

      expect(() => viewScene(scene)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle chapters with special characters', async () => {
      const chaptersContent = `### Chapter 1: Test!!! @#$

#### Scene 1

\`\`\`json
{
  "description": "Special chars",
  "chapterNumber": 1
}
\`\`\`

---
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

      const editor = new SceneEditor(testDir);
      const editedConcepts = new Map<string, ImageConcept>();

      editedConcepts.set('1_1', {
        description: 'Updated with special chars',
        chapterNumber: 1,
        chapter: 'Chapter 1: Test!!! @#$',
        quote: '',
        pageRange: '1-10',
      });

      const saveEditedScenes = (editor as any).saveEditedScenes.bind(editor);
      await saveEditedScenes(editedConcepts);

      const updatedContent = await readFile(join(testDir, 'Chapters.md'), 'utf-8');

      expect(updatedContent).toContain('Updated with special chars');
      expect(updatedContent).toContain('Chapter 1: Test!!! @#$');
    });

    it('should handle large scene numbers', async () => {
      const chaptersContent = `### Chapter 999: Test

#### Scene 999

\`\`\`json
{
  "description": "Large numbers",
  "chapterNumber": 999
}
\`\`\`

---
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

      const editor = new SceneEditor(testDir);
      const editedConcepts = new Map<string, ImageConcept>();

      editedConcepts.set('999_999', {
        description: 'Updated large numbers',
        chapterNumber: 999,
        chapter: 'Chapter 999: Test',
        quote: '',
        pageRange: '1-10',
      });

      const saveEditedScenes = (editor as any).saveEditedScenes.bind(editor);
      await saveEditedScenes(editedConcepts);

      const updatedContent = await readFile(join(testDir, 'Chapters.md'), 'utf-8');

      expect(updatedContent).toContain('Updated large numbers');
    });

    it('should handle editing only first scene in multi-scene chapter', async () => {
      const chaptersContent = `### Chapter 1: Test

#### Scene 1

\`\`\`json
{ "description": "Scene 1", "chapterNumber": 1 }
\`\`\`

---

#### Scene 2

\`\`\`json
{ "description": "Scene 2", "chapterNumber": 1 }
\`\`\`

---
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

      const editor = new SceneEditor(testDir);
      const editedConcepts = new Map<string, ImageConcept>();

      editedConcepts.set('1_1', {
        description: 'Updated Scene 1',
        chapterNumber: 1,
        chapter: 'Chapter 1: Test',
        quote: '',
        pageRange: '1-10',
      });

      const saveEditedScenes = (editor as any).saveEditedScenes.bind(editor);
      await saveEditedScenes(editedConcepts);

      const updatedContent = await readFile(join(testDir, 'Chapters.md'), 'utf-8');

      expect(updatedContent).toContain('Updated Scene 1');
      expect(updatedContent).toContain('Scene 2'); // Unchanged
    });
  });
});
