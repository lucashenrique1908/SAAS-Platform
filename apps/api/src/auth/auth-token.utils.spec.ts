import { describe, expect, it } from 'vitest';
import { createOpaqueToken, hashOpaqueToken } from './auth-token.utils.js';

describe('opaque authentication tokens', () => {
  it('creates high-entropy, URL-safe tokens and stores only irreversible hashes', () => {
    const token = createOpaqueToken();
    const hash = hashOpaqueToken(token);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashOpaqueToken(token)).toBe(hash);
    expect(hashOpaqueToken(createOpaqueToken())).not.toBe(hash);
  });
});
