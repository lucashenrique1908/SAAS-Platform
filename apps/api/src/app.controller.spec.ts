/**
 * Responsabilidade: verificar automaticamente o comportamento esperado do AppController.
 *
 * Funcionamento: cria o controller com seu serviço e confirma a resposta da rota raiz.
 *
 * Arquitetura: complementa a API com testes unitários executados pelo Vitest.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
