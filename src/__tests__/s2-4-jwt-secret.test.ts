describe('S2-4: JWT_SECRET validation at startup', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('throws at startup if JWT_SECRET is shorter than 32 characters', () => {
    process.env = { ...originalEnv, JWT_SECRET: 'short-secret' };
    expect(() => {
      jest.isolateModules(() => {
        require('../utils/env');
      });
    }).toThrow('JWT_SECRET');
  });

  it('throws at startup if JWT_SECRET is exactly 31 characters', () => {
    process.env = { ...originalEnv, JWT_SECRET: 'a'.repeat(31) };
    expect(() => {
      jest.isolateModules(() => {
        require('../utils/env');
      });
    }).toThrow('JWT_SECRET');
  });

  it('does not throw if JWT_SECRET is exactly 32 characters', () => {
    process.env = { ...originalEnv, JWT_SECRET: 'a'.repeat(32) };
    expect(() => {
      jest.isolateModules(() => {
        require('../utils/env');
      });
    }).not.toThrow();
  });

  it('does not throw if JWT_SECRET is longer than 32 characters', () => {
    process.env = { ...originalEnv, JWT_SECRET: 'a'.repeat(64) };
    expect(() => {
      jest.isolateModules(() => {
        require('../utils/env');
      });
    }).not.toThrow();
  });
});

describe('S2-4: JWT token TTL default', () => {
  it('default JWT_EXPIRES_IN is not the original insecure 7d', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '../utils/env.ts'), 'utf8');
    expect(source).toContain("'1h'");
    expect(source).not.toMatch(/JWT_EXPIRES_IN.*\?\?.*'7d'/);
  });
});
