/**
 * Responsabilidade: receber requisições HTTP da API.
 *
 * Funcionamento: mapeia a rota raiz e encaminha a operação para o AppService.
 *
 * Arquitetura: conecta as requisições externas à lógica fornecida pelos serviços.
 */
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/decorators/public.decorator.js';

@Controller()
@Public()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
