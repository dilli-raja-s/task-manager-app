import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../server/auth/password-hasher.js';

describe('TC-UNIT-001 + TC-UNIT-002 password hashing', () => {
  it('hashes password before persistence', async () => {
    const plaintext = 'StrongPass!234';
    const hash = await hashPassword(plaintext);

    expect(hash).toBeTypeOf('string');
    expect(hash).not.toBe(plaintext);
  });

  it('rejects mismatched password verification', async () => {
    const hash = await hashPassword('AnotherStrong!123');
    const isMatch = await verifyPassword('WrongStrong!123', hash);

    expect(isMatch).toBe(false);
  });
});
