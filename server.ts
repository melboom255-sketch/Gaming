import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createApiApp,
  getActiveRoundSeed,
  setLiveRoundBroadcastHook,
} from './server/app.ts';
import {
  getLiveRoundsSnapshot,
  setLiveRoomPresence,
} from './server/liveRounds.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

interface TrackedSocket extends WebSocket {
  room?: 'keno' | 'bingo' | 'lobby';
  isAlive?: boolean;
}

async function startServer() {
  const app = createApiApp();
  const httpServer = http.createServer(app);

  // Real-time WebSocket server for synchronized Keno & Bingo rounds on port 3000
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<TrackedSocket>();

  const updatePresenceCounts = () => {
    let keno = 0;
    let bingo = 0;
    for (const client of clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (client.room === 'keno') keno += 1;
      else if (client.room === 'bingo') bingo += 1;
    }
    setLiveRoomPresence({ keno, bingo });
  };

  let lastSignature = '';

  const broadcastRounds = async (force = false) => {
    if (clients.size === 0) return;
    try {
      const seed = await getActiveRoundSeed();
      const snapshot = getLiveRoundsSnapshot(seed);
      const signature = [
        snapshot.keno.roundId,
        snapshot.keno.phase,
        snapshot.keno.secondsRemaining,
        snapshot.keno.drawnBalls.length,
        snapshot.keno.lockedTicketsCount,
        snapshot.keno.winners.length,
        snapshot.keno.activePlayers,
        snapshot.bingo.roundId,
        snapshot.bingo.phase,
        snapshot.bingo.secondsRemaining,
        snapshot.bingo.calledNumbers.length,
        snapshot.bingo.lockedCardsCount,
        snapshot.bingo.winners.length,
        snapshot.bingo.activePlayers,
      ].join(':');

      if (!force && signature === lastSignature) return;
      lastSignature = signature;

      const message = JSON.stringify({ type: 'rounds:sync', data: snapshot });
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    } catch {
      // Ignore transient broadcast error; next tick will retry
    }
  };

  setLiveRoundBroadcastHook(() => {
    void broadcastRounds(true);
  });

  wss.on('connection', (ws: TrackedSocket) => {
    ws.room = 'lobby';
    ws.isAlive = true;
    clients.add(ws);
    updatePresenceCounts();

    void getActiveRoundSeed().then((seed) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'rounds:sync',
            data: getLiveRoundsSnapshot(seed),
          })
        );
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString('utf8')) as {
          type?: string;
          room?: 'keno' | 'bingo' | 'lobby';
        };
        if (msg.type === 'presence:join' && msg.room) {
          ws.room = msg.room;
          updatePresenceCounts();
          void broadcastRounds(true);
        }
      } catch {
        // Ignore malformed client message
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      updatePresenceCounts();
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '';
    const pathname = reqUrl.split('?')[0];
    if (pathname === '/ws/live-rounds') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Authoritative 300ms ticker checks round state transitions and broadcasts exact second/ball changes
  setInterval(() => {
    void broadcastRounds(false);
  }, 300);

  // Heartbeat to prune dead sockets cleanly
  setInterval(() => {
    for (const client of clients) {
      if (client.isAlive === false) {
        clients.delete(client);
        client.terminate();
        updatePresenceCounts();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 25_000);

  // Mount built dist/ in production when available; otherwise mount Vite middleware so frontend never 404s
  const distDir = path.join(__dirname, 'dist');
  const distIndexPath = path.join(distDir, 'index.html');
  const useProdStatic = process.env.NODE_ENV === 'production' && fs.existsSync(distIndexPath);

  if (!useProdStatic) {
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
        res.setHeader('Cache-Control', 'no-store');
      }
      next();
    });
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(distIndexPath);
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Abyssinia Games server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Abyssinia Games server:', err);
  process.exit(1);
});
