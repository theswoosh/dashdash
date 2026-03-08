import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateResetToken,
  hashResetToken,
} from '../services/password.service.js';

// ============================================================
// hashPassword + verifyPassword
// ============================================================

describe('hashPassword + verifyPassword', () => {
  it('verifies the correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const result = await verifyPassword('correct-horse-battery-staple', hash);
    expect(result).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('produces different hashes for the same password (bcrypt salts)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================
// generateResetToken
// ============================================================

describe('generateResetToken', () => {
  it('returns raw and hash as non-empty strings', () => {
    const { raw, hash } = generateResetToken();
    expect(raw.length).toBeGreaterThan(0);
    expect(hash.length).toBeGreaterThan(0);
  });

  it('raw is URL-safe base64 (no +, /, = characters)', () => {
    const { raw } = generateResetToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hash is a 64-character hex string (SHA-256)', () => {
    const { hash } = generateResetToken();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different tokens on successive calls', () => {
    const token1 = generateResetToken();
    const token2 = generateResetToken();
    expect(token1.raw).not.toBe(token2.raw);
    expect(token1.hash).not.toBe(token2.hash);
  });
});

// ============================================================
// hashResetToken
// ============================================================

describe('hashResetToken', () => {
  it('roundtrips with generateResetToken — hashing raw yields the same hash', () => {
    const { raw, hash } = generateResetToken();
    expect(hashResetToken(raw)).toBe(hash);
  });

  it('different inputs produce different hashes', () => {
    expect(hashResetToken('input-a')).not.toBe(hashResetToken('input-b'));
  });
});
