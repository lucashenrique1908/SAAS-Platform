import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { LocalDeveloperFileStorage } from './developer-file-storage.js';

describe('local developer file storage', () => {
  it('writes, reads and removes private files with generated keys', async () => {
    const root = await mkdtemp(join(tmpdir(), 'saas-developer-files-'));
    const storage = new LocalDeveloperFileStorage({
      get: () => root,
    } as never);
    const content = Buffer.from('private file contents');

    try {
      await storage.put('profile/photo.png', content);
      await expect(storage.get('profile/photo.png')).resolves.toEqual(content);
      await storage.remove('profile/photo.png');
      await expect(storage.get('profile/photo.png')).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects path traversal keys', async () => {
    const root = await mkdtemp(join(tmpdir(), 'saas-developer-files-'));
    const storage = new LocalDeveloperFileStorage({
      get: () => root,
    } as never);

    try {
      await expect(
        storage.put('../outside.txt', Buffer.from('x')),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(storage.get('../outside.txt')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
