import path from 'path';
import fs from 'fs';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { RegisterRoutes } from './routes/routes';
import swaggerDocument from './routes/swagger.json';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { imageUpload, fileUpload } from './middlewares/uploads';
import { requestLogger } from './middlewares/requestLogger';
import cors from 'cors';

export const app = express();

app.use(cors({
  origin: [
    'http://localhost:5000',   // Flutter web 개발 서버
    'http://localhost:3000',   // 필요 시
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// OPTIONS preflight 요청이 404로 처리되지 않도록 강제 성공 응답 반환
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/static/uploads', express.static(uploadsDir));

app.post('/attachments/images', imageUpload.single('file'));
app.post('/attachments/files', fileUpload.single('file'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

RegisterRoutes(app);

app.use(notFoundHandler);
app.use(errorHandler);
