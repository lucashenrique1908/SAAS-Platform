/**
 * Responsabilidade: servir como ponto de entrada da API NestJS.
 *
 * Funcionamento: cria a aplicação e inicia o servidor HTTP na porta definida por PORT
 * ou, quando ela não está configurada, na porta 3001.
 *
 * Arquitetura: carrega o AppModule como módulo raiz da aplicação.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
}

await bootstrap();