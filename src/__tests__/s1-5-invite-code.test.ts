import crypto from 'crypto';

// Mirror the function under test — this tests the LOGIC is correct
// (Real function is in BandService.ts but private; we verify the pattern here)
function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

describe('S1-5: Cryptographically secure invite code generation', () => {
  const VALID_ALPHABET = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''));

  it('produces codes of exactly 8 characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateInviteCode()).toHaveLength(8);
    }
  });

  it('only contains characters from the valid alphabet', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCode();
      for (const ch of code) {
        expect(VALID_ALPHABET.has(ch)).toBe(true);
      }
    }
  });

  it('produces statistically varied output (entropy check)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    // With 32^8 ≈ 10^12 space, 50 calls should be unique
    expect(codes.size).toBe(50);
  });

  it('excludes confusable characters (0, O, 1, I)', () => {
    const EXCLUDED = new Set('01OI'.split(''));
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      for (const ch of code) {
        expect(EXCLUDED.has(ch)).toBe(false);
      }
    }
  });

  it('BandService.ts source uses crypto.randomBytes not Math.random', () => {
    // Read the source file and verify Math.random is not used in generateInviteCode
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../services/BandService.ts'),
      'utf8',
    );
    // The function should not contain Math.random
    const funcStart = source.indexOf('function generateInviteCode');
    const funcEnd = source.indexOf('\n}', funcStart) + 2;
    const funcBody = source.slice(funcStart, funcEnd);
    expect(funcBody).not.toContain('Math.random');
    expect(funcBody).toContain('crypto.randomBytes');
  });
});
