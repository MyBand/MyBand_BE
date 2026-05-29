import path from 'path';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { RegisterRoutes } from './routes/routes';
import swaggerDocument from './routes/swagger.json';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { imageUpload, fileUpload, verifyImageMime, verifyFileMime } from './middlewares/uploads';
import { requestLogger } from './middlewares/requestLogger';
import { expressAuthentication } from './middlewares/auth';
import cors from 'cors';

export const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      imgSrc:     ["'self'", 'data:'],
      objectSrc:  ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

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
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

function requireJwt(req: express.Request, res: express.Response, next: express.NextFunction): void {
  expressAuthentication(req, 'jwt')
    .then((user) => {
      req.user = user as import('./middlewares/auth').RequestUser;
      next();
    })
    .catch(() => {
      res.status(401).json({ message: 'Unauthorized' });
    });
}

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

app.post('/attachments/images', requireJwt, imageUpload.single('file'), verifyImageMime);
app.post('/attachments/files',  requireJwt, fileUpload.single('file'),  verifyFileMime);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

RegisterRoutes(app);

app.use(notFoundHandler);
app.use(errorHandler);
