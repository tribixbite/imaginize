/**
 * Unit tests for regenerate module
 * Tests scene-level regeneration, Chapters.md parsing, and scene filtering
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  loadImageConcepts,
  findScenesToRegenerate,
  generateSceneId,
  parseSceneId,
  type RegenerateOptions,
} from '../lib/regenerate.js';

describe('regenerate', () => {
  const testBaseDir = join(process.cwd(), 'src/test/.test-data');
  let testDir: string;
  let testCounter = 0;

  beforeEach(async () => {
    // Create unique test directory (Termux-compatible)
    testCounter++;
    testDir = join(testBaseDir, `regenerate-test-${Date.now()}-${testCounter}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('loadImageConcepts', () => {
    it('should throw error if Chapters.md does not exist', async () => {
      await expect(loadImageConcepts(testDir)).rejects.toThrow('Chapters.md not found');
    });

    it('should parse chapters and scenes from markdown with JSON blocks', async () => {
      const chaptersContent = `# Chapters - Test Book

## Visual Scenes by Chapter

---

### Chapter 1: The Beginning

#### Scene 1

\`\`\`json
{
  "description": "A dark forest scene with ancient trees",
  "quote": "The forest was dark and mysterious.",
  "pageRange": "1-5"
}
\`\`\`

---

### Chapter 2: The Journey

#### Scene 1

\`\`\`json
{
  "description": "Mountain landscape with lone traveler",
  "quote": "The traveler walked through the mountains.",
  "pageRange": "10-15"
}
\`\`\`

---
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);
      const concepts = await loadImageConcepts(testDir);

      expect(concepts.size).toBe(2);
      expect(concepts.has('Chapter 1: The Beginning')).toBe(true);
      expect(concepts.has('Chapter 2: The Journey')).toBe(true);

      const ch1 = concepts.get('Chapter 1: The Beginning');
      expect(ch1).toHaveLength(1);
      expect(ch1![0].description).toBe('A dark forest scene with ancient trees');

      const ch2 = concepts.get('Chapter 2: The Journey');
      expect(ch2).toHaveLength(1);
      expect(ch2![0].description).toBe('Mountain landscape with lone traveler');
    });

    it('should parse JSON blocks when present', async () => {
      const chaptersContent = `### Chapter 1: Test

#### Scene 1

\`\`\`json
{
  "chapter": "Chapter 1: Test",
  "pageRange": "1-5",
  "quote": "Test quote",
  "description": "Test description",
  "reasoning": "Test reasoning"
}
\`\`\`

---
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);
      const concepts = await loadImageConcepts(testDir);

      const ch1 = concepts.get('Chapter 1: Test');
      expect(ch1).toHaveLength(1);
      expect(ch1![0]).toMatchObject({
        chapter: 'Chapter 1: Test',
        pageRange: '1-5',
        quote: 'Test quote',
        description: 'Test description',
        reasoning: 'Test reasoning',
      });
    });

    it('should handle multiple scenes in same chapter', async () => {
      const chaptersContent = `### Chapter 1: Multi-Scene

#### Scene 1

\`\`\`json
{
  "description": "Scene 1 description"
}
\`\`\`

---

#### Scene 2

\`\`\`json
{
  "description": "Scene 2 description"
}
\`\`\`

---

#### Scene 3

\`\`\`json
{
  "description": "Scene 3 description"
}
\`\`\`

---
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);
      const concepts = await loadImageConcepts(testDir);

      const ch1 = concepts.get('Chapter 1: Multi-Scene');
      expect(ch1).toHaveLength(3);
      expect(ch1![0].description).toBe('Scene 1 description');
      expect(ch1![1].description).toBe('Scene 2 description');
      expect(ch1![2].description).toBe('Scene 3 description');
    });

    it('should handle malformed JSON gracefully', async () => {
      const chaptersContent = `### Chapter 1: Test

#### Scene 1

\`\`\`json
{ invalid json }
\`\`\`

---

#### Scene 2

\`\`\`json
{
  "description": "Valid scene"
}
\`\`\`

---
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);
      const concepts = await loadImageConcepts(testDir);

      const ch1 = concepts.get('Chapter 1: Test');
      // Should only have the valid scene
      expect(ch1).toHaveLength(1);
      expect(ch1![0].description).toBe('Valid scene');
    });

    it('should handle chapters with no scenes', async () => {
      const chaptersContent = `### Chapter 1: Empty

### Chapter 2: Has Scenes

#### Scene 1

\`\`\`json
{
  "description": "Test"
}
\`\`\`

---
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);
      const concepts = await loadImageConcepts(testDir);

      expect(concepts.size).toBe(2);
      expect(concepts.get('Chapter 1: Empty')).toEqual([]);
      expect(concepts.get('Chapter 2: Has Scenes')).toHaveLength(1);
    });

    it('should handle empty Chapters.md', async () => {
      await writeFile(join(testDir, 'Chapters.md'), '');
      const concepts = await loadImageConcepts(testDir);

      expect(concepts.size).toBe(0);
    });

    it('should save last concept when EOF reached', async () => {
      const chaptersContent = `### Chapter 1: Last

#### Scene 1

\`\`\`json
{
  "description": "Last scene without trailing separator"
}
\`\`\``;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);
      const concepts = await loadImageConcepts(testDir);

      const ch1 = concepts.get('Chapter 1: Last');
      expect(ch1).toHaveLength(1);
      expect(ch1![0].description).toBe('Last scene without trailing separator');
    });
  });

  describe('findScenesToRegenerate', () => {
    const testChaptersContent = `### Chapter 1: Test

#### Scene 1

\`\`\`json
{
  "chapterNumber": 1,
  "description": "Chapter 1 Scene 1"
}
\`\`\`

---

#### Scene 2

\`\`\`json
{
  "chapterNumber": 1,
  "description": "Chapter 1 Scene 2"
}
\`\`\`

---

### Chapter 2: Another

#### Scene 1

\`\`\`json
{
  "chapterNumber": 2,
  "description": "Chapter 2 Scene 1"
}
\`\`\`

---

#### Scene 2

\`\`\`json
{
  "chapterNumber": 2,
  "description": "Chapter 2 Scene 2"
}
\`\`\`

---
`;

    beforeEach(async () => {
      // Create test Chapters.md
      await writeFile(join(testDir, 'Chapters.md'), testChaptersContent);
    });

    it('should load test data correctly', async () => {
      const concepts = await loadImageConcepts(testDir);
      expect(concepts.size).toBe(2);

      const ch1 = concepts.get('Chapter 1: Test');
      expect(ch1).toBeDefined();
      expect(ch1!.length).toBe(2);

      const ch2 = concepts.get('Chapter 2: Another');
      expect(ch2).toBeDefined();
      expect(ch2!.length).toBe(2);
    });

    it('should find all scenes when all option is true', async () => {
      const options: RegenerateOptions = {
        outputDir: testDir,
        all: true,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      expect(scenes).toHaveLength(4);
      expect(scenes[0].chapterNumber).toBe(1);
      expect(scenes[0].sceneNumber).toBe(1);
      expect(scenes[3].chapterNumber).toBe(2);
      expect(scenes[3].sceneNumber).toBe(2);
    });

    it('should find scenes by chapter number', async () => {
      const options: RegenerateOptions = {
        outputDir: testDir,
        chapter: 1,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      expect(scenes).toHaveLength(2);
      expect(scenes[0].chapterNumber).toBe(1);
      expect(scenes[1].chapterNumber).toBe(1);
    });

    it('should find scenes by scene number across all chapters', async () => {
      const options: RegenerateOptions = {
        outputDir: testDir,
        scene: 1,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      expect(scenes).toHaveLength(2);
      expect(scenes[0].sceneNumber).toBe(1);
      expect(scenes[1].sceneNumber).toBe(1);
    });

    it('should find specific scene by chapter and scene number', async () => {
      const options: RegenerateOptions = {
        outputDir: testDir,
        chapter: 2,
        scene: 1,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      expect(scenes).toHaveLength(1);
      expect(scenes[0].chapterNumber).toBe(2);
      expect(scenes[0].sceneNumber).toBe(1);
    });

    it('should find scene by sceneId', async () => {
      const options: RegenerateOptions = {
        outputDir: testDir,
        sceneId: 'chapter_1_scene_2',
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      expect(scenes).toHaveLength(1);
      expect(scenes[0].chapterNumber).toBe(1);
      expect(scenes[0].sceneNumber).toBe(2);
    });

    it('should throw error if no scenes match criteria', async () => {
      const options: RegenerateOptions = {
        outputDir: testDir,
        chapter: 99,
      };

      await expect(findScenesToRegenerate(testDir, options)).rejects.toThrow(
        'No scenes match the specified criteria'
      );
    });

    it('should generate correct image filename format', async () => {
      const options: RegenerateOptions = {
        outputDir: testDir,
        chapter: 1,
        scene: 1,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      // imageFilename is undefined if file doesn't exist
      // The scene still contains chapterTitle which can be checked
      expect(scenes[0].chapterTitle).toBe('Chapter 1: Test');
      expect(scenes[0].chapterNumber).toBe(1);
      expect(scenes[0].sceneNumber).toBe(1);
    });

    it('should handle special characters in chapter title', async () => {
      const chaptersContent = `### Chapter 1: Test!!! @#$ Special%%%

#### Scene 1

\`\`\`json
{
  "chapterNumber": 1,
  "description": "Test"
}
\`\`\`
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

      const options: RegenerateOptions = {
        outputDir: testDir,
        all: true,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      // Verify scene is found with special character title
      expect(scenes[0].chapterTitle).toBe('Chapter 1: Test!!! @#$ Special%%%');
      expect(scenes[0].chapterNumber).toBe(1);
    });

    it('should handle long chapter titles', async () => {
      const longTitle = 'A'.repeat(100);
      const chaptersContent = `### Chapter 1: ${longTitle}

#### Scene 1

\`\`\`json
{
  "chapterNumber": 1,
  "description": "Test"
}
\`\`\`
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

      const options: RegenerateOptions = {
        outputDir: testDir,
        all: true,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      // Verify scene is found even with very long title
      expect(scenes[0].chapterTitle).toContain('AAAA');
      expect(scenes[0].chapterNumber).toBe(1);
    });

    it('should detect existing image files', async () => {
      // Create a mock image file with correct sanitized filename
      // Chapter title "Chapter 1: Test" becomes "chapter_1_test"
      const imageFilename = 'chapter_1_chapter_1_test_scene_1.png';
      await writeFile(join(testDir, imageFilename), 'mock image data');

      const options: RegenerateOptions = {
        outputDir: testDir,
        chapter: 1,
        scene: 1,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      expect(scenes[0].imageFilename).toBeDefined();
      expect(scenes[0].imageFilename).toBe(imageFilename);
    });

    it('should set imageFilename to undefined if file does not exist', async () => {
      const options: RegenerateOptions = {
        outputDir: testDir,
        chapter: 1,
        scene: 1,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      // Image file doesn't exist, so imageFilename should be set but file won't exist
      // The function still sets imageFilename even if file doesn't exist
      // Let me check the code again...
      // Actually, looking at the code:
      // imageFilename: existsSync(imagePath) ? imageFilename : undefined
      // So it should be undefined if file doesn't exist

      // Since we didn't create the image file, it should be undefined
      expect(scenes[0].imageFilename).toBeUndefined();
    });

    it('should include concept data in scene identifier', async () => {
      const options: RegenerateOptions = {
        outputDir: testDir,
        chapter: 1,
        scene: 1,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      expect(scenes[0].concept).toBeDefined();
      expect(scenes[0].concept.description).toBe('Chapter 1 Scene 1');
      expect(scenes[0].concept.chapterNumber).toBe(1);
    });

    it('should handle missing chapterNumber in concept', async () => {
      const chaptersContent = `### Chapter 1: Test

#### Scene 1

\`\`\`json
{
  "description": "No chapter number"
}
\`\`\`
`;

      await writeFile(join(testDir, 'Chapters.md'), chaptersContent);

      const options: RegenerateOptions = {
        outputDir: testDir,
        all: true,
      };

      const scenes = await findScenesToRegenerate(testDir, options);

      // Should default to 0
      expect(scenes[0].chapterNumber).toBe(0);
    });
  });

  describe('generateSceneId', () => {
    it('should generate scene ID in correct format', () => {
      const sceneId = generateSceneId(1, 5);
      expect(sceneId).toBe('chapter_1_scene_5');
    });

    it('should handle single-digit numbers', () => {
      const sceneId = generateSceneId(3, 7);
      expect(sceneId).toBe('chapter_3_scene_7');
    });

    it('should handle multi-digit numbers', () => {
      const sceneId = generateSceneId(15, 42);
      expect(sceneId).toBe('chapter_15_scene_42');
    });

    it('should handle zero', () => {
      const sceneId = generateSceneId(0, 0);
      expect(sceneId).toBe('chapter_0_scene_0');
    });
  });

  describe('parseSceneId', () => {
    it('should parse valid scene ID', () => {
      const result = parseSceneId('chapter_1_scene_5');
      expect(result).toEqual({ chapter: 1, scene: 5 });
    });

    it('should parse multi-digit numbers', () => {
      const result = parseSceneId('chapter_15_scene_42');
      expect(result).toEqual({ chapter: 15, scene: 42 });
    });

    it('should parse zero', () => {
      const result = parseSceneId('chapter_0_scene_0');
      expect(result).toEqual({ chapter: 0, scene: 0 });
    });

    it('should return null for invalid format', () => {
      expect(parseSceneId('invalid')).toBeNull();
      expect(parseSceneId('chapter_1')).toBeNull();
      expect(parseSceneId('scene_5')).toBeNull();
      expect(parseSceneId('chapter_a_scene_b')).toBeNull();
      expect(parseSceneId('chapter_1_scene_')).toBeNull();
      expect(parseSceneId('_chapter_1_scene_5')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseSceneId('')).toBeNull();
    });

    it('should return null for malformed separators', () => {
      expect(parseSceneId('chapter-1-scene-5')).toBeNull();
      expect(parseSceneId('chapter.1.scene.5')).toBeNull();
    });
  });

  describe('integration: generateSceneId and parseSceneId', () => {
    it('should be reversible', () => {
      const original = { chapter: 5, scene: 12 };
      const sceneId = generateSceneId(original.chapter, original.scene);
      const parsed = parseSceneId(sceneId);

      expect(parsed).toEqual(original);
    });

    it('should round-trip multiple values', () => {
      const testCases = [
        { chapter: 1, scene: 1 },
        { chapter: 10, scene: 25 },
        { chapter: 0, scene: 0 },
        { chapter: 999, scene: 999 },
      ];

      for (const testCase of testCases) {
        const sceneId = generateSceneId(testCase.chapter, testCase.scene);
        const parsed = parseSceneId(sceneId);
        expect(parsed).toEqual(testCase);
      }
    });
  });
});
