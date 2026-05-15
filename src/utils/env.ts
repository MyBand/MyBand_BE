import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalList(...keys: string[]): string[] {
  return keys
    .flatMap((key) => (process.env[key] ?? '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

const googleClientIds = [
  required('GOOGLE_CLIENT_ID'),
  ...optionalList(
    'GOOGLE_WEB_CLIENT_ID',
    'GOOGLE_ANDROID_CLIENT_ID',
    'GOOGLE_IOS_CLIENT_ID',
    'GOOGLE_CLIENT_IDS',
  ),
];

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  PORT: Number(process.env.PORT ?? 3000),
  GOOGLE_CLIENT_ID: googleClientIds[0],
  GOOGLE_CLIENT_IDS: [...new Set(googleClientIds)],
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
};
