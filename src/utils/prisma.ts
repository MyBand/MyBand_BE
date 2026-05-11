import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import { env } from './env';

function resolveSqliteUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const raw = url.slice('file:'.length);
  if (path.isAbsolute(raw)) return `file:${raw}`;
  const absolute = path.resolve(process.cwd(), 'prisma', raw);
  return `file:${absolute}`;
}

const adapter = new PrismaBetterSQLite3({ url: resolveSqliteUrl(env.DATABASE_URL) });

export const prisma = new PrismaClient({ adapter });
