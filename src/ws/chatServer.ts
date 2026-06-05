import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { AuthService } from '../services/AuthService';
import { BandMemberService } from '../services/BandMemberService';
import { chatHub } from './chatHub';
import { logger } from '../utils/logger';

const CHAT_PATH = /^\/api\/bands\/([^/]+)\/chat\/?$/;

interface ChatContext {
  bandId: string;
  userId: string;
}

export function attachChatServer(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const authService = new AuthService();
  const memberService = new BandMemberService();

  httpServer.on('upgrade', (request, socket, head) => {
    void handleUpgrade(request, socket, head);
  });

  async function handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const match = url.pathname.match(CHAT_PATH);
      if (!match) return reject(socket, 404, 'Not Found');

      const bandId = decodeURIComponent(match[1]);

      const protocols = (request.headers['sec-websocket-protocol'] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const bearerIdx = protocols.indexOf('bearer');
      const token =
        (bearerIdx >= 0 ? protocols[bearerIdx + 1] : null) ??
        url.searchParams.get('token');
      if (!token) return reject(socket, 401, 'Unauthorized');

      let userId: string;
      try {
        const verified = await authService.verifyAccessToken(token);
        userId = verified.id;
      } catch {
        return reject(socket, 401, 'Unauthorized');
      }

      try {
        await memberService.assertMember(bandId, userId);
      } catch {
        return reject(socket, 403, 'Forbidden');
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, { bandId, userId });
      });
    } catch (err) {
      logger.error('WS upgrade error', err);
      reject(socket, 500, 'Internal Server Error');
    }
  }

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, ctx: ChatContext) => {
    const unsubscribe = chatHub.subscribe(ctx.bandId, (message) => {
      if (ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ type: 'message', data: message }));
    });
    ws.on('close', unsubscribe);
    ws.on('error', (err) => {
      logger.warn(`WS error for band=${ctx.bandId} user=${ctx.userId}`, err);
    });
  });
}

function reject(socket: Duplex, status: number, reason: string): void {
  try {
    socket.write(`HTTP/1.1 ${status} ${reason}\r\n\r\n`);
  } catch {
    /* socket may already be destroyed */
  }
  socket.destroy();
}
