#!/usr/bin/env node

/**
 * Dashboard Integration Test (Phase 3)
 *
 * Tests the complete dashboard system with a real book processing run:
 * 1. Start imaginize with --dashboard flag
 * 2. Connect WebSocket client
 * 3. Verify all events received
 * 4. Monitor progress updates
 * 5. Validate dashboard state
 */

import { spawn } from 'child_process';
import WebSocket from 'ws';
import http from 'http';

const TEST_PORT = 3001;
const TEST_CHAPTERS = '1-2'; // Small test
const TEST_FILE = 'ImpossibleCreatures.epub';

let imaginizeProcess = null;
let wsClient = null;
let httpReq = null;

const eventCounts = {
  'initial-state': 0,
  'progress': 0,
  'stats': 0,
  'chapter-start': 0,
  'chapter-complete': 0,
  'phase-start': 0,
  'image-complete': 0,
};

const receivedEvents = [];
let testPassed = true;
let testTimeout = null;

// Cleanup function
async function cleanup() {
  console.log('\n[Test] Cleaning up...');

  if (wsClient) {
    try {
      wsClient.close();
    } catch (e) {
      // Ignore
    }
  }

  if (httpReq) {
    try {
      httpReq.destroy();
    } catch (e) {
      // Ignore
    }
  }

  if (imaginizeProcess) {
    console.log('[Test] Stopping imaginize process...');
    imaginizeProcess.kill('SIGTERM');

    // Wait for process to exit
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (imaginizeProcess.killed || !imaginizeProcess.pid) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Force kill after 2 seconds
      setTimeout(() => {
        if (imaginizeProcess && !imaginizeProcess.killed) {
          imaginizeProcess.kill('SIGKILL');
        }
        clearInterval(checkInterval);
        resolve();
      }, 2000);
    });
  }

  if (testTimeout) {
    clearTimeout(testTimeout);
  }
}

// Test timeout (2 minutes)
testTimeout = setTimeout(async () => {
  console.log('\n❌ TEST TIMEOUT - Test took longer than 2 minutes');
  testPassed = false;
  await cleanup();
  process.exit(1);
}, 120000);

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n[Test] Received SIGINT, cleaning up...');
  await cleanup();
  process.exit(testPassed ? 0 : 1);
});

process.on('SIGTERM', async () => {
  console.log('\n[Test] Received SIGTERM, cleaning up...');
  await cleanup();
  process.exit(testPassed ? 0 : 1);
});

async function testDashboard() {
  console.log('='.repeat(60));
  console.log('Dashboard Integration Test (Phase 3)');
  console.log('='.repeat(60));
  console.log();

  // Step 1: Start imaginize with dashboard
  console.log(`[Step 1] Starting imaginize with --dashboard on port ${TEST_PORT}...`);
  console.log(`[Step 1] Processing chapters ${TEST_CHAPTERS} from ${TEST_FILE}`);
  console.log();

  imaginizeProcess = spawn('npx', [
    '.',
    '--dashboard',
    '--dashboard-port', TEST_PORT.toString(),
    '--text',
    '--chapters', TEST_CHAPTERS,
    '--file', TEST_FILE,
    '--force',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let dashboardStarted = false;
  let processingStarted = false;

  imaginizeProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    if (output.includes('Dashboard:')) {
      dashboardStarted = true;
      console.log('✅ Dashboard server started');
    }

    if (output.includes('Processing chapters') || output.includes('Analyzing')) {
      processingStarted = true;
    }
  });

  imaginizeProcess.stderr.on('data', (data) => {
    const output = data.toString();
    // Only show errors, not verbose logs
    if (output.includes('Error') || output.includes('error')) {
      process.stderr.write(`[stderr] ${output}`);
    }
  });

  imaginizeProcess.on('close', (code) => {
    console.log(`\n[Process] imaginize exited with code ${code}`);
  });

  // Wait for dashboard to start
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (dashboardStarted) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!dashboardStarted) {
        clearInterval(checkInterval);
        console.log('❌ Dashboard failed to start within 10 seconds');
        testPassed = false;
      }
      resolve();
    }, 10000);
  });

  if (!testPassed) {
    await cleanup();
    process.exit(1);
  }

  // Give server a moment to fully initialize
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: Test REST API
  console.log('\n[Step 2] Testing REST API endpoints...');

  // Test /api/health
  try {
    const healthData = await new Promise((resolve, reject) => {
      httpReq = http.get(`http://localhost:${TEST_PORT}/api/health`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Health check failed: ${res.statusCode}`));
          }
        });
      });
      httpReq.on('error', reject);
    });

    console.log('✅ GET /api/health:', healthData.status);
    console.log('   Connections:', healthData.connections);
    console.log('   Uptime:', healthData.uptime.toFixed(2), 's');
  } catch (error) {
    console.log('❌ GET /api/health failed:', error.message);
    testPassed = false;
  }

  // Test /api/state
  try {
    const stateData = await new Promise((resolve, reject) => {
      httpReq = http.get(`http://localhost:${TEST_PORT}/api/state`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`State request failed: ${res.statusCode}`));
          }
        });
      });
      httpReq.on('error', reject);
    });

    console.log('✅ GET /api/state');
    console.log('   Book:', stateData.bookTitle);
    console.log('   Phase:', stateData.currentPhase);
    console.log('   Total Chapters:', stateData.stats.totalChapters);
  } catch (error) {
    console.log('❌ GET /api/state failed:', error.message);
    testPassed = false;
  }

  // Step 3: Connect WebSocket
  console.log('\n[Step 3] Connecting to WebSocket server...');

  wsClient = new WebSocket(`ws://localhost:${TEST_PORT}`);

  wsClient.on('open', () => {
    console.log('✅ WebSocket connection established');
  });

  wsClient.on('message', (data) => {
    const message = JSON.parse(data.toString());
    receivedEvents.push(message);

    if (eventCounts.hasOwnProperty(message.type)) {
      eventCounts[message.type]++;
    }

    // Log important events
    if (message.type === 'initial-state') {
      console.log(`   📊 Received initial-state: ${message.data.bookTitle}`);
    } else if (message.type === 'chapter-start') {
      console.log(`   📖 Chapter ${message.data.number} started`);
    } else if (message.type === 'chapter-complete') {
      console.log(`   ✅ Chapter ${message.data.number} completed`);
    } else if (message.type === 'phase-start') {
      console.log(`   🔄 Phase: ${message.data.phase}`);
    }
  });

  wsClient.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
    testPassed = false;
  });

  wsClient.on('close', () => {
    console.log('   WebSocket connection closed');
  });

  // Wait for processing to complete or timeout
  console.log('\n[Step 4] Monitoring progress updates...');
  console.log(`           (Processing ${TEST_CHAPTERS} chapters with text extraction only)`);
  console.log();

  await new Promise(resolve => {
    imaginizeProcess.on('close', () => {
      // Give a moment for final WebSocket messages
      setTimeout(resolve, 1000);
    });
  });

  // Step 5: Validate results
  console.log('\n[Step 5] Validating test results...');
  console.log('='.repeat(60));

  console.log('\nEvent Type Coverage:');
  for (const [eventType, count] of Object.entries(eventCounts)) {
    const status = count > 0 ? '✅' : '❌';
    console.log(`${status} ${eventType.padEnd(20)} ${count} events`);
    if (eventType === 'initial-state' && count === 0) {
      testPassed = false;
    }
  }

  console.log(`\nTotal WebSocket Messages: ${receivedEvents.length}`);

  // Check minimum expected events
  const expectedMinimum = 5; // At least initial-state + some progress
  if (receivedEvents.length < expectedMinimum) {
    console.log(`❌ Expected at least ${expectedMinimum} events, got ${receivedEvents.length}`);
    testPassed = false;
  } else {
    console.log(`✅ Received sufficient events (${receivedEvents.length} >= ${expectedMinimum})`);
  }

  // Validate initial-state structure
  const initialState = receivedEvents.find(e => e.type === 'initial-state');
  if (initialState) {
    const { bookTitle, currentPhase, stats } = initialState.data;
    console.log('\nInitial State Validation:');
    console.log(bookTitle ? '✅' : '❌', 'bookTitle:', bookTitle);
    console.log(currentPhase ? '✅' : '❌', 'currentPhase:', currentPhase);
    console.log(stats ? '✅' : '❌', 'stats:', JSON.stringify(stats, null, 2));

    if (!bookTitle || !currentPhase || !stats) {
      testPassed = false;
    }
  } else {
    console.log('\n❌ No initial-state event received');
    testPassed = false;
  }

  console.log('\n' + '='.repeat(60));
  if (testPassed) {
    console.log('✅ ALL TESTS PASSED - Dashboard integration is functional!');
    console.log('='.repeat(60));
  } else {
    console.log('❌ SOME TESTS FAILED - See errors above');
    console.log('='.repeat(60));
  }

  await cleanup();
  process.exit(testPassed ? 0 : 1);
}

// Run test
testDashboard().catch(async (error) => {
  console.error('\n❌ Test failed with error:', error);
  testPassed = false;
  await cleanup();
  process.exit(1);
});
