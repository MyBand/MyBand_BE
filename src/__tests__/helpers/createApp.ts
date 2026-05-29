// Set required env vars before any module imports that call `required()`.
// This must happen before importing app or any service/repository.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 'test-google-client-id';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./test.db';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

// Re-export app for use in tests.
// The tsoa-generated routes and swagger.json must exist before running tests.
// Run `npm run tsoa` to generate them if they are missing.
export { app } from '../../app';
