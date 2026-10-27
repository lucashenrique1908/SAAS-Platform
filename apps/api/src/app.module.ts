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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const port = Number(config.get('POSTGRES_PORT', '5432'));
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error('POSTGRES_PORT deve ser um número de porta válido.');
        }

        const isProduction = process.env.NODE_ENV === 'production';
        const migrationsPath = isProduction
          ? resolve(process.cwd(), 'dist/database/migrations/*.js')
          : resolve(process.cwd(), 'src/database/migrations/*.ts');

        return {
          type: 'postgres' as const,
          host: config.get<string>('POSTGRES_HOST', '127.0.0.1'),
          port,
          username: config.getOrThrow<string>('POSTGRES_USER'),
          password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
          database: config.getOrThrow<string>('POSTGRES_DB'),
          autoLoadEntities: true,
          migrations: [migrationsPath],
          synchronize: false,
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}