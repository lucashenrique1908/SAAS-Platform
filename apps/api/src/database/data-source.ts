import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

const envPath = resolve(process.cwd(), '../../.env');
if (existsSync(envPath)) {
  loadEnv({ path: envPath });
}

const port = Number(process.env.POSTGRES_PORT ?? '5432');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('POSTGRES_PORT deve ser um número de porta válido.');
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`A variável de ambiente ${name} é obrigatória.`);
  }
  return value;
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? '127.0.0.1',
  port,
  username: requiredEnv('POSTGRES_USER'),
  password: requiredEnv('POSTGRES_PASSWORD'),
  database: requiredEnv('POSTGRES_DB'),
  entities: [],
  migrations: [resolve(process.cwd(), 'src/database/migrations/*.ts')],
  synchronize: false,
});

export default dataSource;
