import http from 'http';
import { app } from './app';
import { env } from './utils/env';
import { logger } from './utils/logger';
import { attachChatServer } from './ws/chatServer';

const httpServer = http.createServer(app);
attachChatServer(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`MyBand BE listening on http://localhost:${env.PORT}`);
  logger.info(`Swagger UI at http://localhost:${env.PORT}/docs`);
  logger.info(
    `Chat WebSocket at ws://localhost:${env.PORT}/api/bands/{bandId}/chat?token=...`,
  );
});
