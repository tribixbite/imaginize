#!/usr/bin/env node
/**
 * Test script for Dashboard Phase 1 backend
 * Verifies event flow from ProgressTracker to WebSocket clients
 */

import { ProgressTracker } from './dist/lib/progress-tracker.js';
import { DashboardServer } from './dist/lib/dashboard/server.js';
import { WebSocket } from 'ws';
import { mkdirSync, rmSync } from 'fs';

const TEST_DIR = './test-dashboard-backend-temp';
const PORT = 3001;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('🧪 Testing Dashboard Backend (Phase 1)\n');

  // Setup test directory
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch (e) {}
  mkdirSync(TEST_DIR, { recursive: true });

  console.log('1. Creating ProgressTracker...');
  const progressTracker = new ProgressTracker(TEST_DIR);
  await progressTracker.initialize('Test Book', 5);
  console.log('   ✅ ProgressTracker created\n');

  console.log('2. Starting DashboardServer...');
  const dashboardServer = new DashboardServer(progressTracker, {
    port: PORT,
    host: 'localhost',
  });
  await dashboardServer.start();
  console.log(`   ✅ Server started on http://localhost:${PORT}\n`);

  // Give server time to start
  await sleep(500);

  console.log('3. Connecting WebSocket client...');
  const ws = new WebSocket(`ws://localhost:${PORT}`);

  const receivedEvents = [];

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    receivedEvents.push(message);
    console.log(`   📨 Received: ${message.type}`);
  });

  await new Promise((resolve) => {
    ws.on('open', () => {
      console.log('   ✅ WebSocket connected\n');
      resolve();
    });
  });

  // Wait for initial-state message
  await sleep(500);

  console.log('4. Emitting test events...');

  // Test chapter start
  await progressTracker.startChapter(1, 'Chapter One');
  await sleep(200);

  // Test progress log
  await progressTracker.log('Processing chapter 1...', 'info');
  await sleep(200);

  // Test chapter complete
  await progressTracker.completeChapter(1, 'Chapter One', 3);
  await sleep(200);

  // Test element extraction
  await progressTracker.startElementExtraction();
  await sleep(200);

  await progressTracker.completeElementExtraction(10);
  await sleep(200);

  // Test image generation
  await progressTracker.logImageGeneration('Hero Character', true);
  await sleep(200);

  console.log('   ✅ Events emitted\n');

  console.log('5. Verifying events received...');

  const expectedTypes = [
    'initial-state',
    'chapter-start',
    'progress',
    'chapter-complete',
    'stats',
    'phase-start',
    'progress',
    'stats',
    'image-complete',
    'stats',
    'progress'
  ];

  const receivedTypes = receivedEvents.map(e => e.type);

  console.log(`   Expected: ${expectedTypes.length} events`);
  console.log(`   Received: ${receivedTypes.length} events\n`);

  // Check key event types are present
  const hasInitialState = receivedTypes.includes('initial-state');
  const hasProgress = receivedTypes.includes('progress');
  const hasStatsEvents = receivedTypes.includes('stats');
  const hasChapterStart = receivedTypes.includes('chapter-start');
  const hasChapterComplete = receivedTypes.includes('chapter-complete');
  const hasPhaseStart = receivedTypes.includes('phase-start');
  const hasImageComplete = receivedTypes.includes('image-complete');

  console.log('   Event Type Coverage:');
  console.log(`   ${hasInitialState ? '✅' : '❌'} initial-state`);
  console.log(`   ${hasProgress ? '✅' : '❌'} progress`);
  console.log(`   ${hasStatsEvents ? '✅' : '❌'} stats`);
  console.log(`   ${hasChapterStart ? '✅' : '❌'} chapter-start`);
  console.log(`   ${hasChapterComplete ? '✅' : '❌'} chapter-complete`);
  console.log(`   ${hasPhaseStart ? '✅' : '❌'} phase-start`);
  console.log(`   ${hasImageComplete ? '✅' : '❌'} image-complete\n`);

  const allEventTypesPresent = hasInitialState && hasProgress && hasStatsEvents &&
    hasChapterStart && hasChapterComplete && hasPhaseStart && hasImageComplete;

  console.log('6. Testing REST API endpoints...');

  // Test /api/state
  const stateResponse = await fetch(`http://localhost:${PORT}/api/state`);
  const stateData = await stateResponse.json();
  const hasBookTitle = stateData.bookTitle === 'Test Book';
  const hasStats = stateData.stats && stateData.stats.totalChapters === 5;

  console.log(`   ${stateResponse.ok ? '✅' : '❌'} GET /api/state (${stateResponse.status})`);
  console.log(`   ${hasBookTitle ? '✅' : '❌'} State has bookTitle`);
  console.log(`   ${hasStats ? '✅' : '❌'} State has stats\n`);

  // Test /api/health
  const healthResponse = await fetch(`http://localhost:${PORT}/api/health`);
  const healthData = await healthResponse.json();
  const isHealthy = healthData.status === 'healthy';
  const hasConnections = typeof healthData.connections === 'number';

  console.log(`   ${healthResponse.ok ? '✅' : '❌'} GET /api/health (${healthResponse.status})`);
  console.log(`   ${isHealthy ? '✅' : '❌'} Health status OK`);
  console.log(`   ${hasConnections ? '✅' : '❌'} Connection count reported\n`);

  // Cleanup
  console.log('7. Cleaning up...');
  ws.close();
  await dashboardServer.stop();
  rmSync(TEST_DIR, { recursive: true, force: true });
  console.log('   ✅ Cleanup complete\n');

  // Final result
  const apiTestsPassed = stateResponse.ok && healthResponse.ok && hasBookTitle && hasStats && isHealthy;
  const testsPassed = allEventTypesPresent && apiTestsPassed;

  console.log('═══════════════════════════════════════════════════════');
  if (testsPassed) {
    console.log('✅ ALL TESTS PASSED - Dashboard backend is functional!');
  } else {
    console.log('❌ SOME TESTS FAILED - Review results above');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(testsPassed ? 0 : 1);
}

runTest().catch((error) => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
