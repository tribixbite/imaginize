/**
 * Dashboard server for real-time progress monitoring
 * Provides WebSocket-based updates and REST API for dashboard UI
 */

import express, { type Application } from 'express';
import { createServer, type Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ProgressTracker } from '../progress-tracker.js';
import type {
  DashboardServerOptions,
  WebSocketMessage,
  ChapterStartEvent,
  ChapterCompleteEvent,
  PhaseStartEvent,
  ImageCompleteEvent,
  InitializedEvent,
} from './types.js';

/**
 * Dashboard server with Express + WebSocket for real-time updates
 */
export class DashboardServer {
  private app: Application;
  private server: HTTPServer;
  private wss: WebSocketServer;
  private progressTracker: ProgressTracker;
  private port: number;
  private host: string;

  constructor(progressTracker: ProgressTracker, options: DashboardServerOptions = {}) {
    this.progressTracker = progressTracker;
    this.port = options.port || 3000;
    this.host = options.host || 'localhost';

    // Create Express app
    this.app = express();

    // Create HTTP server
    this.server = createServer(this.app);

    // Create WebSocket server
    this.wss = new WebSocketServer({ server: this.server });

    // Setup routes and WebSocket
    this.setupRoutes();
    this.setupWebSocket();
    this.subscribeToProgress();
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Enable JSON parsing
    this.app.use(express.json());

    // Serve static React app (when built)
    this.app.use(express.static('dist/dashboard'));

    // API: Get current state
    this.app.get('/api/state', (req, res) => {
      try {
        const state = this.progressTracker.getState();
        res.json(state);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        connections: this.wss.clients.size,
        uptime: process.uptime(),
      });
    });
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[Dashboard] Client connected');

      // Send initial state on connection
      try {
        const initialState = this.progressTracker.getState();
        this.sendToClient(ws, {
          type: 'initial-state',
          data: initialState,
        });
      } catch (error: any) {
        console.error('[Dashboard] Error sending initial state:', error.message);
      }

      // Handle client disconnect
      ws.on('close', () => {
        console.log('[Dashboard] Client disconnected');
      });

      // Handle client errors
      ws.on('error', (error) => {
        console.error('[Dashboard] WebSocket error:', error);
      });
    });
  }

  /**
   * Subscribe to progress tracker events and forward to dashboard
   */
  private subscribeToProgress(): void {
    // Forward initialization event
    this.progressTracker.on('initialized', (data: InitializedEvent) => {
      this.broadcast({
        type: 'initial-state',
        data,
      });
    });

    // Forward progress events
    this.progressTracker.on('progress', (data) => {
      this.broadcast({
        type: 'progress',
        data,
      });
    });

    // Forward stats updates
    this.progressTracker.on('stats', (data) => {
      this.broadcast({
        type: 'stats',
        data,
      });
    });

    // Forward chapter events
    this.progressTracker.on('chapter-start', (data: ChapterStartEvent) => {
      this.broadcast({
        type: 'chapter-start',
        data,
      });
    });

    this.progressTracker.on('chapter-complete', (data: ChapterCompleteEvent) => {
      this.broadcast({
        type: 'chapter-complete',
        data,
      });
    });

    // Forward phase events
    this.progressTracker.on('phase-start', (data: PhaseStartEvent) => {
      this.broadcast({
        type: 'phase-start',
        data,
      });
    });

    // Forward image events
    this.progressTracker.on('image-complete', (data: ImageCompleteEvent) => {
      this.broadcast({
        type: 'image-complete',
        data,
      });
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WebSocketMessage): void {
    const payload = JSON.stringify(message);

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (error: any) {
          console.error('[Dashboard] Error broadcasting:', error.message);
        }
      }
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WebSocket, message: WebSocketMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        const payload = JSON.stringify(message);
        client.send(payload);
      } catch (error: any) {
        console.error('[Dashboard] Error sending to client:', error.message);
      }
    }
  }

  /**
   * Start dashboard server
   */
  async start(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.server.listen(this.port, this.host, () => {
        console.log(`\n📊 Dashboard: http://${this.host}:${this.port}\n`);
        resolve();
      });
    });
  }

  /**
   * Stop dashboard server
   */
  async stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Close WebSocket connections
      this.wss.clients.forEach((client) => {
        client.close();
      });

      // Close WebSocket server
      this.wss.close((err) => {
        if (err) {
          console.error('[Dashboard] Error closing WebSocket server:', err);
        }
      });

      // Close HTTP server
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('[Dashboard] Server stopped');
          resolve();
        }
      });
    });
  }
}
