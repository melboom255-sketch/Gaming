import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_SALT = 'abyssinia-financial-vault-v1';

function deriveAesKey(secretSeed: string): Buffer {
  const effectiveSeed =
    process.env.FINANCIAL_ENCRYPTION_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    secretSeed ||
    'abyssinia-fallback-vault-seed';
  return crypto.scryptSync(effectiveSeed, KEY_SALT, 32);
}

export function encryptSensitiveText(plainText: string, secretSeed: string): string {
  const clean = plainText.trim();
  if (!clean) return '';
  const key = deriveAesKey(secretSeed);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSensitiveText(cipherPayload: string | undefined, secretSeed: string): string {
  if (!cipherPayload) return '';
  if (!cipherPayload.startsWith('v1:')) {
    return cipherPayload;
  }
  const parts = cipherPayload.split(':');
  if (parts.length !== 4) return '';
  try {
    const [, ivB64, tagB64, dataB64] = parts;
    const key = deriveAesKey(secretSeed);
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function maskAccountValue(value: string): string {
  const clean = value.trim();
  if (!clean) return 'Not set';
  if (clean.length <= 4) return '*'.repeat(clean.length);
  if (clean.length <= 8) {
    return `${clean.slice(0, 2)}${'*'.repeat(clean.length - 4)}${clean.slice(-2)}`;
  }
  return `${clean.slice(0, 3)}${'*'.repeat(Math.min(10, clean.length - 7))}${clean.slice(-4)}`;
}
