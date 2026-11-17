/**
 * Responsabilidade: fornecer ao TypeORM CLI a configuração de conexão e as migrations da API.
 *
 * Funcionamento: carrega o arquivo local em ambientes locais/teste e valida as configurações antes da conexão.
 *
 * Arquitetura: reutiliza as regras de ambiente da API e mantém o esquema controlado por migrations explícitas.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  shouldLoadLocalEnvFile,
  validatePostgresEnvironment,
} from '../config/env.validation.js';

const envPath = resolve(process.cwd(), '../../.env');
if (shouldLoadLocalEnvFile(process.env.NODE_ENV) && existsSync(envPath)) {
  loadEnv({ path: envPath, quiet: true });
}

const databaseConfig = validatePostgresEnvironment(process.env);

const dataSource = new DataSource({
  type: 'postgres',
  host: databaseConfig.POSTGRES_HOST,
  port: databaseConfig.POSTGRES_PORT,
  username: databaseConfig.POSTGRES_USER,
  password: databaseConfig.POSTGRES_PASSWORD,
  database: databaseConfig.POSTGRES_DB,
  entities: [
    resolve(
      process.cwd(),
      shouldLoadLocalEnvFile(process.env.NODE_ENV)
        ? 'src/**/*.entity.ts'
        : 'dist/**/*.entity.js',
    ),
  ],
  migrations: [resolve(process.cwd(), 'src/database/migrations/*.ts')],
  synchronize: false,
});

export default dataSource;
