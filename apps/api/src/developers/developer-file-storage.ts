import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEVELOPER_FILE_STORAGE = Symbol('DEVELOPER_FILE_STORAGE');

export interface DeveloperFileStorage {
  put(storageKey: string, content: Buffer): Promise<void>;
  get(storageKey: string): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
}

@Injectable()
export class LocalDeveloperFileStorage implements DeveloperFileStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>('DEVELOPER_UPLOAD_DIR');
    this.root = resolve(
      configured ?? resolve(process.cwd(), 'var/developer-uploads'),
    );
  }

  async put(storageKey: string, content: Buffer): Promise<void> {
    const path = this.safePath(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, {
      flag: 'wx',
      mode: 0o600,
    });
  }

  async get(storageKey: string): Promise<Buffer> {
    return readFile(this.safePath(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(this.safePath(storageKey));
  }

  private safePath(key: string): string {
    const path = resolve(this.root, key);
    const rel = relative(this.root, path);
    if (!key || isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) {
      throw new BadRequestException('Invalid file path.');
    }
    return path;
  }
}
