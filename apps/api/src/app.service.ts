/**
 * Responsabilidade: fornecer a lógica utilizada pelo controller inicial.
 *
 * Funcionamento: retorna a resposta da rota raiz neste estágio da aplicação.
 *
 * Arquitetura: a lógica de negócio futura deve ser organizada em serviços e módulos específicos.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
