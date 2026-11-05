/**
 * Responsabilidade: definir o módulo principal da API NestJS.
 *
 * Funcionamento: registra o controller e o serviço que compõem a aplicação inicial.
 *
 * Arquitetura: funciona como módulo raiz e ponto de organização para módulos futuros.
 */
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'node:path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import {
  shouldLoadLocalEnvFile,
  validatePostgresEnvironment,
} from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      // Mantém o arquivo local apenas no desenvolvimento; ambientes gerenciados usam variáveis injetadas.
      ignoreEnvFile: !shouldLoadLocalEnvFile(process.env.NODE_ENV),
      // Valida as configurações antes de disponibilizá-las aos módulos da aplicação.
      validate: validatePostgresEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Usa migrations TypeScript no ambiente local/teste e JavaScript compilado em Staging/Production.
        const migrationsPath = shouldLoadLocalEnvFile(process.env.NODE_ENV)
          ? resolve(process.cwd(), 'src/database/migrations/*.ts')
          : resolve(process.cwd(), 'dist/database/migrations/*.js');

        return {
          type: 'postgres' as const,
          host: config.getOrThrow<string>('POSTGRES_HOST'),
          port: config.getOrThrow<number>('POSTGRES_PORT'),
          username: config.getOrThrow<string>('POSTGRES_USER'),
          password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
          database: config.getOrThrow<string>('POSTGRES_DB'),
          autoLoadEntities: true,
          migrations: [migrationsPath],
          // O esquema do banco é alterado por migrations explícitas, nunca por sincronização automática.
          synchronize: false,
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
