/**
 * Responsabilidade: definir o módulo principal da API NestJS.
 *
 * Funcionamento: registra o controller e o serviço que compõem a aplicação inicial.
 *
 * Arquitetura: funciona como módulo raiz e ponto de organização para módulos futuros.
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}