import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_BYTES = 32;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
