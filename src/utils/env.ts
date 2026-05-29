import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requiredSecret(key: string, minLength = 32): string {
  const value = required(key);
  if (value.length < minLength) {
    throw new Error(
      `Environment variable ${key} must be at least ${minLength} characters long ` +
      `(got ${value.length}). Use a strong random secret.`,
    );
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
  JWT_SECRET: requiredSecret('JWT_SECRET', 32),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1h',
};
