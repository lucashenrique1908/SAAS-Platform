import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';

function encryptionKey(value: string | undefined): Buffer {
  if (!value)
    throw new ServiceUnavailableException(
      'External integrations are not configured.',
    );
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new ServiceUnavailableException(
      'The integration encryption key must encode 32 bytes.',
    );
  }
  return key;
}

export function encryptDeveloperToken(
  value: string,
  keyValue: string | undefined,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(keyValue), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptDeveloperToken(
  value: string,
  keyValue: string | undefined,
): string {
  const [ivText, tagText, ciphertextText] = value.split('.');
  if (!ivText || !tagText || !ciphertextText) {
    throw new ServiceUnavailableException(
      'Stored integration credentials are invalid.',
    );
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(keyValue),
    Buffer.from(ivText, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new ServiceUnavailableException(
      'Stored integration credentials cannot be decrypted.',
    );
  }
}
