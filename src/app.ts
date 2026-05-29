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

app.set('trust proxy', 1);

const corsOrigins = new Set(
  [
    'http://localhost:5000',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_URLS ?? '').split(','),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin)),
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Keep preflight requests from falling through to 404 routes.
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
