/**
 * Responsabilidade: definir o módulo principal da API NestJS.
 *
 * Funcionamento: registra o controller e o serviço que compõem a aplicação inicial.
 *
 * Arquitetura: funciona como módulo raiz e ponto de organização para módulos futuros.
 */
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'node:path';
import { AuthModule } from './auth/auth.module.js';
import { CsrfGuard } from './auth/guards/csrf.guard.js';
import { SessionAuthGuard } from './auth/guards/session-auth.guard.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { DevelopersModule } from './developers/developers.module.js';
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
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: process.env.NODE_ENV === 'test' ? 1_000 : 60,
      },
    ]),
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
    AuthModule,
    OrganizationsModule,
    DevelopersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
