# Qualidade e segurança automatizadas

## Ferramentas e comandos

Execute os comandos na raiz do monorepo:

| Comando                | Verificações                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `npm run lint`         | ESLint no frontend e na API; Oxlint com análise de tipos na API                         |
| `npm run format`       | Formata os ficheiros TypeScript, TSX e CSS do frontend e os ficheiros TypeScript da API |
| `npm run format:check` | Verifica a formatação sem modificar ficheiros                                           |
| `npm run typecheck`    | Verifica os tipos TypeScript de ambos os workspaces sem emitir ficheiros                |
| `npm test`             | Executa os testes unitários Vitest da API                                               |
| `npm run build`        | Compila a API e cria a build de produção do frontend                                    |
| `npm run audit`        | Analisa as dependências do lockfile com `npm audit --audit-level=high`                  |

O ESLint do frontend mantém a configuração existente do Next.js. A API usa as regras recomendadas do typescript-eslint e mantém o Oxlint existente como verificação complementar. O Prettier usa a configuração local da API e as opções padrão no frontend.

O Husky executa lint-staged antes dos commits: aplica ESLint e Prettier aos ficheiros de aplicação preparados e Prettier aos ficheiros JSON, Markdown, YAML e CSS preparados. O hook é local, não requer PostgreSQL nem serviços externos e pode ser executado no Windows através do npm e do Git for Windows.

## CI

O workflow `.github/workflows/ci.yml` é executado em Pull Requests e em pushes para `develop` e `main`. O job estável `Quality checks` usa Node.js 24 LTS, instala dependências com `npm ci` e executa lint, verificação de formatação, typecheck, testes unitários, build e auditoria de dependências. O job `Secret scan` executa Gitleaks sobre o histórico completo do repositório, sem credenciais personalizadas.

As verificações automáticas obrigatórias serão configuradas após a Tarefa 6. Embora as rulesets estejam configuradas no repositório privado, estão desativadas devido às limitações do plano atual. Por isso, enquanto essa restrição existir, o GitHub não garante o bloqueio automático de merges quando o CI falha; a equipa deve continuar a verificar os resultados antes de integrar alterações.

## Interpretação de falhas e política de segurança

- **ESLint/Oxlint:** corrigir os erros reportados na branch do PR. Não desativar regras apenas para obter uma execução bem-sucedida.
- **Prettier:** executar `npm run format` e rever as alterações antes de atualizar o PR.
- **TypeScript:** corrigir os erros de tipos sem enfraquecer as opções dos `tsconfig`.
- **Testes/build:** investigar a causa e corrigir ou documentar a falha antes da revisão e integração.
- **Auditoria npm:** vulnerabilidades High e Critical bloqueiam o job; Medium e Low são reportadas pelo `npm audit`, mas não bloqueiam esta verificação inicial. Avaliar atualizações compatíveis e correções antes de aceitar uma exceção. O resultado depende da base de avisos e da disponibilidade do registry npm; a auditoria não prova a ausência de vulnerabilidades.
- **Gitleaks:** qualquer segredo detetado deve ser tratado como exposto: remover do código e histórico quando apropriado, revogar ou rodar a credencial e seguir o processo de resposta da equipa. A configuração permite apenas valores-placeholder exatos do `.env.example` e o token demonstrativo do README padrão do NestJS; os restantes conteúdos de documentação e ficheiros continuam a ser analisados. Não adicionar credenciais reais a exemplos nem alargar exclusões para silenciar alertas.

## Limitações iniciais

Os testes executados pelo comando `npm test` são testes unitários da API e não exigem PostgreSQL nem credenciais reais. O teste end-to-end existente não está incluído no comando padrão porque inicializa o módulo da aplicação e pode depender da configuração do banco de dados. Não existe ainda cobertura de testes automatizados para o frontend.

O audit cobre dependências conhecidas pelo registry no momento da execução; não substitui análise de código, atualização regular de dependências ou revisão de segurança. Gitleaks deteta padrões de segredos conhecidos no histórico, mas não garante a deteção de todos os formatos possíveis. O CI também não consegue impor merges bloqueados enquanto as rulesets permanecerem desativadas pelo plano do repositório.
