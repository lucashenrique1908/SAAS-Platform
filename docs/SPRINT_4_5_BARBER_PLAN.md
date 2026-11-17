# Plano das Sprints 4 e 5 — Barber Module

## 1. Objetivo e estado da auditoria

Este documento planeia a fundação e a operação do módulo Barber em duas sprints. É planeamento; não descreve funcionalidades já implementadas.

Auditoria realizada em 17-11-2026:

- Branch: `feature/sprint-4`, acompanhando `origin/feature/sprint-4`.
- Commit observado: `fedd230` (`Merge pull request #9 from lucashenrique1908/feature/sprint-3-finalization`).
- Estado Git: sem alterações rastreadas pendentes. Ficheiros não rastreados observados: `SPRINT-4-AUDIT-REPORT.txt` e `artifacts/`; ambos foram preservados.
- Barber já consta no catálogo de módulos e permissões e tem landing page genérica. A API ainda não tem módulo funcional, entidades, controllers, services, DTOs, guards Barber nem migrations Barber.
- Não foram executados testes ou comandos de validação nesta tarefa.

## 2. Arquitetura existente e reutilização

O repositório é um monorepo npm workspaces com `apps/api` (NestJS, TypeORM, PostgreSQL) e `apps/web` (Next.js App Router, React, Tailwind CSS 4). O backend usa migrations explícitas, `synchronize: false`, DTOs/validação e módulos por domínio. A aplicação web usa o shell do workspace e handlers BFF para encaminhar sessão; chamadas mutáveis já incluem proteção CSRF no padrão existente.

Auth, Organizations, memberships, roles e módulo habilitável por organização são infraestrutura existente. `OrganizationAccessGuard` resolve slug/UUID, valida organização ativa e membership; permissões declaradas são aplicadas no backend. Owner/Admin têm acesso amplo, enquanto Members dependem de permissões explícitas. O Developer acrescenta guard próprio para módulo ativo e implementa domínio dentro de `apps/api/src/developers/`; as suas entidades, services e páginas dão exemplos de convenções, mas a propriedade individual do perfil Developer não deve ser copiada como modelo dos dados partilhados de uma barbearia.

Reutilizar o shell, navegação, BFF, sessão, CSRF, componentes UI, organização de DTO/controller/service/entity, migrations explícitas, Vitest e testes Supertest. Não generalizar CRUD ou refatorar módulos antes de existir repetição concreta. A solução de ficheiros do Developer é local; não prova armazenamento durável de produção. Fotografias e uploads estão adiados.

Infraestrutura de testes confirmada: Vitest na API e web; teste E2E da API em `apps/api/test/app.e2e-spec.ts`; PostgreSQL de teste no Compose, porta 5433, com volume temporário e DB `saas_auth_test`. O E2E atual cobre principalmente autenticação/autorização. A suite de frontend existente é pequena (`apps/web/src/lib/auth-api.spec.ts`); há margem para criar cobertura dos fluxos Barber.

Documentação consultada: `docs/DEVELOPER_MODULE.md`, `docs/ORGANIZATION_WORKSPACE.md`, `docs/AUTHENTICATION.md` e `docs/QUALITY_AND_SECURITY.md`. A documentação funcional do Developer não será modificada por este plano.

## 3. Decisões aprovadas incorporadas

- Organização pode registar profissionais com conta e sem conta. O perfil profissional tem `userId` opcional; quando presente, a associação deve corresponder a membership da mesma organização.
- Existem perfil da barbearia e perfis profissionais individuais. Ambos são internos nas Sprints 4 e 5; descoberta e perfis públicos ficam adiados.
- Owner/Admin têm acesso organizacional amplo. Member pode ler dados operacionais da organização com `barber:read`; `barber:write` apenas permite escritas nos registos sob responsabilidade atribuída ao Member. As autorizações serão aplicadas na API.
- Cliente: nome e telefone obrigatórios; email opcional. Duplicados são permitidos; não se bloqueia por telefone, email ou nome. Nenhum outro dado pessoal é requisito inicial.
- Timezone configurado na organização, com `Europe/Lisbon` como valor inicial recomendado, configurável para outros países. Instantes persistidos sem ambiguidade; apresentação no timezone organizacional, incluindo DST.
- Estados de agendamento aprovados: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`. Cancelamento preserva histórico.
- Serviço tem preço em EUR e duração. Agendamento guarda snapshot do preço e duração vigentes na criação.
- Serviço só pode ser realizado pelos profissionais associados explicitamente.
- Uma localização por organização nesta fase. Não criar entidades de localizações, cadeiras ou recursos nesta entrega.
- Sem fotos/uploads Barber nas Sprints 4 e 5.

## 4. Arquitetura proposta

### API

```text
apps/api/src/barber/
  barber.module.ts
  barber.controller.ts
  barber.service.ts
  barber-scheduling.service.ts       # Sprint 5
  guards/barber-module-access.guard.ts
  dto/
  entities/
```

Controladores sob `/organizations/:slug/barber`. Usar `OrganizationAccessGuard`, guard Barber que confirma módulo habilitado e `@RequireModulePermissions` conforme operação. Services recebem `organizationId` validado e incluem-no nas consultas; IDs de entidades relacionadas devem ser procurados dentro da mesma organização. Quando o recurso for de propriedade individual, verificar ainda `professionalId`/responsável atribuído.

### Web

```text
apps/web/src/app/workspace/[slug]/barber/
  page.tsx
  profile/page.tsx
  professionals/page.tsx
  services/page.tsx
  clients/page.tsx
  schedule/page.tsx                 # Sprint 5
  appointments/page.tsx              # Sprint 5
apps/web/src/components/barber/
  business-profile-editor.tsx
  professional-editor.tsx
  service-editor.tsx
  client-editor.tsx
  weekly-schedule-editor.tsx        # Sprint 5
  appointment-editor.tsx            # Sprint 5
```

Manter chamadas pelo BFF/sessão/CSRF e componentes de UI existentes. Adaptar navegação ao padrão de páginas Developer. Sem abstrações CRUD genéricas preventivas.

### Modelo lógico indicativo

| Entidade                      | Relações e notas                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BarberBusinessProfile`       | Um por organização; perfil interno da barbearia. Não duplicar campos de organização sem esclarecer que informação de negócio adicional é necessária.            |
| `BarberProfessional`          | Pertence a organização; `userId` opcional; pode ter perfil profissional interno. Conta associada requer membership da organização.                              |
| `BarberService`               | Pertence a organização; nome, descrição, duração, preço EUR, estado ativo. Desativar em vez de apagar se referenciado historicamente.                           |
| `BarberProfessionalService`   | Relação muitos-para-muitos explícita entre profissional e serviço, com unicidade e ambos da mesma organização.                                                  |
| `BarberClient`                | Pertence à organização; nome, telefone, email opcional; duplicados permitidos.                                                                                  |
| `BarberWorkingHours`          | Sprint 5: períodos semanais por profissional e dia da semana, conforme regra de pausas a fechar.                                                                |
| `BarberAvailabilityException` | Sprint 5: indisponibilidade/folga com início e fim.                                                                                                             |
| `BarberAppointment`           | Sprint 5: organização, profissional, cliente, serviço, início/fim, estado e snapshots de preço/duração. Preservar relações históricas sem cascatas destrutivas. |

Todas as tabelas operacionais possuem `organizationId`, FKs, índices de consulta por tenant e constraints de integridade. Recomenda-se UUIDs como restante domínio. Definir política de deleção/retensão explicitamente em cada migration. Antes da Sprint 5, escolher mecanismo PostgreSQL para impedir sobreposição concorrente no nível transacional/DB; consulta prévia isolada não basta.

### API indicativa

Sprint 4:

- `GET/PUT profile`
- `GET/POST professionals`, `GET/PUT/DELETE professionals/:id` (preferir desativação quando referenciado)
- `GET/POST services`, `GET/PUT/DELETE services/:id`
- `PUT services/:id/professionals` ou rotas equivalentes para associação explícita
- `GET/POST clients`, `GET/PUT/DELETE clients/:id` (retenção a definir; evitar apagamento físico com histórico)

Sprint 5:

- `GET/PUT professionals/:id/schedule`
- `GET/POST/DELETE professionals/:id/availability-exceptions`
- `GET availability?professionalId=&serviceId=&from=&to=`
- `GET/POST appointments`, `GET/PUT appointments/:id`, ação de transição/cancelamento
- `GET dashboard/summary`

Os nomes finais de endpoints e métodos de transição devem ser fechados ao desenhar DTOs; toda rota requer tenant, permissão e propriedade aplicável.

## 5. Sprint 4 — Barber Foundation & Management

**Objetivo:** entregar fundação, perfil da barbearia, profissionais, catálogo/associações e clientes. Não inclui horários, indisponibilidades, agendamentos, calendário, dashboard operacional ou descoberta pública.

### BARBER-01 — Acesso e estrutura do módulo

- **Objetivo/descrição:** registar módulo NestJS e páginas iniciais, garantindo acesso por membership, módulo ativo e permissões já existentes.
- **Técnico:** novo guard Barber seguindo o Developer; todas as rotas protegidas. Sem alteração das permissões globais existentes salvo necessidade demonstrada.
- **Subtasks:** (1) registar Barber no módulo raiz e TypeORM; (2) criar guard de módulo ativo; (3) criar controller e rota base com acesso organizacional; (4) adicionar páginas e navegação; (5) testar módulo desligado e matriz base de autorização.
- **Aceitação:** utilizador sem membership não acede; módulo desligado bloqueia API e UI; Owner/Admin podem usar o módulo; Member precisa de leitura/escrita respetiva; escrita limitada pela política de propriedade nas Tasks de domínio.
- **Dependências:** nenhuma. **Prioridade:** P0. **Estimativa:** 3 pontos. **Áreas:** Backend, Frontend, Testing, Documentation.

### BARBER-02 — Modelo de dados e migrations

- **Objetivo/descrição:** persistir perfil de organização, profissionais, serviços, associações e clientes com isolamento tenant.
- **Técnico:** entities/constraints TypeORM, migration explícita e reversível; `organizationId` em cada registo operativo; user opcional no profissional.
- **Subtasks:** (1) detalhar relações e comportamento de deleção; (2) criar entidades e índices; (3) migration `up/down`; (4) registar entidades; (5) testes de migration e constraints; (6) definir timezone no perfil/organização sem migração nesta tarefa funcional se decisão técnica indicar coluna separada necessária para Sprint 5.
- **Aceitação:** entidades instanciam e constraints garantem referências válidas; uma associação cross-tenant falha; migration reverte; nenhum dado é removido por cascade de forma não aprovada.
- **Dependências:** BARBER-01. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Backend, Database, Testing, Documentation.

### BARBER-03 — Perfil da barbearia e profissionais

- **Objetivo/descrição:** gerir os dados internos da barbearia e vários profissionais, com ou sem conta.
- **Técnico:** profile por organização; `userId` opcional no profissional; associação com conta verifica membership. Fotografias e publicação pública fora do escopo.
- **Subtasks:** (1) fechar campos do perfil e regras de propriedade; (2) DTOs e validação; (3) service/endpoints tenant-aware; (4) interface de perfil e profissionais; (5) associar/desassociar membro sem aceitar utilizador de outro tenant; (6) testes de acesso de cada papel e casos com/sem conta.
- **Aceitação:** organização mantém no máximo o perfil acordado; pode criar profissional interno sem conta; conta associada pertence à organização; Member só edita perfil próprio/atribuições permitidas, nunca perfil de outro; Owner/Admin gerem todos.
- **Dependências:** BARBER-02 e decisão de campos/proprietário. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Frontend, Backend, Database, Testing.

### BARBER-04 — Serviços e associação a profissionais

- **Objetivo/descrição:** criar e manter serviços com preço EUR, duração e associação explícita a profissionais.
- **Técnico:** CRUD, estado ativo, relações tenant-safe; política de desativação para referências históricas.
- **Subtasks:** (1) DTOs com limites e formato monetário definido; (2) services/endpoints; (3) operações de associação explícita; (4) lista/editor UI; (5) regras de propriedade/responsável Member; (6) testes de preços/duração, serviço inativo e ligações cross-tenant.
- **Aceitação:** não se associa profissional externo; profissional só atende serviço associado; Owner/Admin gerem catálogo; Member só altera serviço se explicitamente responsável/atribuído; não apagar fisicamente registo histórico.
- **Dependências:** BARBER-02 e BARBER-03. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Frontend, Backend, Database, Testing.

### BARBER-05 — Gestão de clientes

- **Objetivo/descrição:** guardar e pesquisar dados mínimos dos clientes da organização.
- **Técnico:** nome e telefone obrigatórios, email opcional, duplicados aceites; acesso limitado por tenant e responsável.
- **Subtasks:** (1) DTO/validação; (2) CRUD e pesquisa; (3) formulário/lista; (4) política de responsabilidade de criação/edição; (5) testes de duplicado permitido, validação e isolamento.
- **Aceitação:** cliente pode ser criado com nome/telefone sem email; duplicado não é rejeitado; Member só altera clientes atribuídos segundo regra aprovada; outra organização nunca pode ler/alterar o registo por ID.
- **Dependências:** BARBER-02; decisão de atribuição/retensão. **Prioridade:** P0. **Estimativa:** 3 pontos. **Áreas:** Frontend, Backend, Database, Testing.

### BARBER-06 — Testes, segurança e documentação da Sprint 4

- **Objetivo/descrição:** fechar qualidade, atualizar documento funcional futuro separado e comprovar pré-requisito do ambiente E2E sem apontar a DB errada.
- **Técnico:** adicionar unit/integration/frontend; documentar configuração E2E e executar validação apenas na sprint autorizada.
- **Subtasks:** (1) testes de serviços/DTOs/guard; (2) testes tenant de entidades Barber; (3) testes frontend dos fluxos centrais; (4) validar configuração `NODE_ENV=test`, host loopback e `POSTGRES_DB` com sufixo `_test`; (5) corrigir configuração fora deste plano, se falhar na Sprint 4; (6) E2E do fluxo de acesso e CRUD principal com PostgreSQL de teste; (7) criar/atualizar docs de implementação Barber.
- **Aceitação:** E2E só é declarado funcional após execução comprovada na DB dedicada; host não loopback e DB sem `_test` são rejeitados; testes críticos e CI passam; docs refletem estado real.
- **Dependências:** BARBER-01 a 05. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Backend, Frontend, Database, Testing, Infrastructure, Documentation.

**Estimativa total inicial Sprint 4: 26 pontos**; validar com capacidade real da equipa e após decisões. BARBER-03/04/06 podem exigir divisão caso a capacidade da sprint seja limitada, mantendo o escopo de negócio aprovado.

## 6. Sprint 5 — Barber Scheduling & Operations

**Objetivo:** acrescentar agenda operacional sobre os modelos da Sprint 4; não recriar entidades de profissionais, serviços e clientes.

### BARBER-07 — Horários e disponibilidade

- **Objetivo/descrição:** definir períodos semanais de trabalho e consultar disponibilidade por profissional/serviço.
- **Técnico:** representar intervalos locais no timezone organizacional; suportar pausas através de vários intervalos por dia ou decisão equivalente.
- **Subtasks:** (1) fechar limites, pausas e timezone; (2) modelo/DTO de horários; (3) endpoints de leitura/escrita; (4) editor semanal; (5) cálculo de disponibilidade por profissional e serviço; (6) testes de limites e DST.
- **Aceitação:** intervalos inválidos não são gravados; serviço só aparece se ativo e associado ao profissional; disponibilidade usa timezone da organização e datas inequívocas.
- **Dependências:** Sprint 4 e BARBER-03/04. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Frontend, Backend, Database, Testing.

### BARBER-08 — Indisponibilidades e exceções

- **Objetivo/descrição:** registar folgas e indisponibilidades com intervalo temporal.
- **Técnico:** exceções pertencem à organização e profissional; não apagar agendamentos existentes quando o horário muda.
- **Subtasks:** (1) modelo e validação intervalar; (2) CRUD de exceções; (3) interface para datas/horas locais; (4) integrar exceções no cálculo de disponibilidade; (5) testes de interseção, DST e tenant.
- **Aceitação:** exceção bloqueia novas reservas no intervalo; não altera histórico; apenas responsáveis autorizados podem editar.
- **Dependências:** BARBER-07. **Prioridade:** P0. **Estimativa:** 3 pontos. **Áreas:** Frontend, Backend, Database, Testing.

### BARBER-09 — Agendamentos

- **Objetivo/descrição:** gerir agendamento interno com profissional, cliente, serviço e estado aprovado.
- **Técnico:** guardar instante inequívoco, timezone organizacional para apresentação, snapshot de preço/duração, transições controladas e relações do mesmo tenant.
- **Subtasks:** (1) fechar estados/transições e políticas; (2) entidade e migration; (3) DTOs/API de criar/listar/editar/cancelar; (4) validar profissional-serviço-cliente e estado ativo; (5) UI de agenda/lista; (6) snapshots de preço/duração; (7) testes de transição e histórico.
- **Aceitação:** aceita apenas `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` conforme transições aprovadas; guarda EUR e duração no momento; cancelar preserva registo; relações cross-tenant são rejeitadas.
- **Dependências:** BARBER-04 a 08. **Prioridade:** P0. **Estimativa:** 8 pontos. **Áreas:** Frontend, Backend, Database, Testing.

### BARBER-10 — Prevenção de conflitos e concorrência

- **Objetivo/descrição:** impedir sobreposição na agenda por regra de negócio e proteção transacional/DB.
- **Técnico:** testar interseções parciais, contidas e simultâneas; especificar a regra de conflito considerando estados cancelados e buffers aprovados.
- **Subtasks:** (1) decidir semântica de intervalos e conflito; (2) implementar estratégia de concorrência PostgreSQL; (3) transação para criar/editar; (4) mapear violações para resposta compreensível; (5) testes reais de concorrência no Postgres isolado.
- **Aceitação:** apenas uma requisição concorrente incompatível é aceite; cancelados deixam de ocupar disponibilidade conforme regra; editar também verifica conflitos; não depende de consulta prévia na UI.
- **Dependências:** BARBER-07 a 09. **Prioridade:** P0. **Estimativa:** 8 pontos. **Áreas:** Backend, Database, Testing.

### BARBER-11 — Dashboard operacional

- **Objetivo/descrição:** mostrar próximos atendimentos e indicadores básicos derivados de dados existentes.
- **Técnico:** endpoint agregado, filtros tenant e timezone; sem métricas financeiras não aprovadas.
- **Subtasks:** (1) fechar indicadores e período; (2) endpoint summary; (3) componente de resumo/próximos; (4) estados vazio/erro/loading; (5) testes tenant e fronteiras de data.
- **Aceitação:** dados reais e isolados; interpretação de “hoje” usa timezone organizacional; sem dados mostra vazio real.
- **Dependências:** BARBER-09. **Prioridade:** P1. **Estimativa:** 3 pontos. **Áreas:** Frontend, Backend, Testing.

### BARBER-12 — E2E, segurança e documentação da Sprint 5

- **Objetivo/descrição:** verificar o fluxo operacional ponta a ponta e documentar comportamento.
- **Técnico:** PostgreSQL isolado; executar E2E sem credenciais externas nem dados de produção.
- **Subtasks:** (1) E2E de horário, indisponibilidade, reserva e cancelamento; (2) E2E de conflito concorrente e tenant; (3) rever autorização/retensão; (4) verificar suite API/web, lint, types, build; (5) atualizar documentação Barber e limitações.
- **Aceitação:** fluxo completo passa em ambiente comprovado; suite não usa banco persistente; estado de integração e limitações está documentado.
- **Dependências:** BARBER-07 a 11. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Frontend, Backend, Database, Testing, Infrastructure, Documentation.

**Estimativa total inicial Sprint 5: 32 pontos**. Reavaliar especialmente BARBER-09/10 após fechar regras temporais e estratégia DB.

## 7. Matriz de permissões proposta

Todos os acessos ainda exigem membership, organização ativa e módulo Barber habilitado. A matriz operacional aplica-se no backend, independentemente da UI.

| Entidade            | Owner/Admin                  | Member com `barber:read` | Member com `barber:write`                                                                                                                 |
| ------------------- | ---------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil da barbearia | Ler/criar/editar             | Ler                      | Sem escrita por padrão; atribuição explícita de gestão é decisão pendente.                                                                |
| Perfil profissional | Ler/gerir todos              | Ler todos                | Editar apenas perfil próprio, identificado por profissional associado a `userId`; sem conta requer responsável atribuído.                 |
| Serviços            | Criar/editar/desativar todos | Ler todos                | Editar apenas serviços com `responsibleProfessionalId` atribuído ao profissional do Member; definir se Member pode criar serviço próprio. |
| Clientes            | Gerir todos                  | Ler todos                | Criar e editar apenas clientes atribuídos a si; Owner/Admin podem reatribuir.                                                             |
| Horários            | Gerir horários de todos      | Ler todos                | Editar apenas horário do próprio profissional.                                                                                            |
| Agendamentos        | Gerir todos                  | Ler todos                | Criar/editar/cancelar apenas os próprios agendamentos ou aqueles pelos quais é responsável.                                               |

Com `barber:read` apenas, todas as operações de escrita são recusadas. `barber:write` não substitui leitura; atribuições/propriedade precisam de validação explícita. Recomenda-se separar `createdByUserId` de `responsibleProfessionalId` nas entidades em que auditoria e propriedade não significam a mesma coisa.

## 8. Testes, qualidade e ambiente E2E

### Cobertura por sprint

- **Sprint 4 unit:** validações dos DTOs, serviços, guard Barber, regra de perfil/member, associações e normalização; migration reversível.
- **Sprint 4 integração:** CRUD com DB de teste, chaves estrangeiras, isolamento entre organizações, profissionais com/sem conta, duplicados de cliente permitidos, serviço-profissional explícito.
- **Sprint 4 frontend:** acesso/página, formulário válido/inválido, erro de API, estados de carregamento/vazio, submissão via BFF e controlo de ações por papel.
- **Sprint 4 E2E:** sessão/CSRF, módulo ativo, permissões, perfil, profissional, serviço, associação e cliente. Executar apenas após pré-requisito de ambiente ficar validado.
- **Sprint 5 unit/integration:** transições, timezone/DST, intervalos, exceções, snapshots, queries tenant-aware e conflitos, incluindo concorrência em PostgreSQL real.
- **Sprint 5 E2E:** cadeia completa até agendar e cancelar; tentativas cross-tenant; conflitos parciais/contidos; duas criações simultâneas; mudança de serviço sem mutação do histórico.

### Verificação E2E requerida antes da primeira execução

O código atual exige, em `NODE_ENV=test`, host loopback e `POSTGRES_DB` terminado em `_test`. O Compose documenta DB `saas_auth_test` e a documentação existente configura esse valor. O prompt informa que uma validação anterior falhou devido a `POSTGRES_DB` sem sufixo `_test`; a inspeção confirma que esse valor é rejeitado pelo validador. Não foi possível comprovar a execução funcional nem determinar, a partir do estado do código/documentação, qual variável concreta foi herdada no terminal que falhou. Assim, a Sprint 4 deve reproduzir a falha de forma segura, explicitar todas as variáveis no mesmo processo, verificar `NODE_ENV=test`, `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5433` e `POSTGRES_DB=saas_auth_test`, e só então executar. Se o comando documentado continuar a falhar, registar o erro real antes de corrigir a configuração; nesta tarefa não houve alteração nem validação.

Comandos disponíveis no repositório — **não executados nesta tarefa**:

```powershell
# Base de teste isolada
docker compose --profile test up -d postgres-test

# No terminal da API, definir os valores explicitamente no processo de teste:
$env:NODE_ENV = 'test'
$env:POSTGRES_HOST = '127.0.0.1'
$env:POSTGRES_PORT = '5433'
$env:POSTGRES_USER = 'saas_test'
$env:POSTGRES_PASSWORD = 'saas_test_password'
$env:POSTGRES_DB = 'saas_auth_test'
$env:FRONTEND_BASE_URL = 'http://localhost:3000'
$env:CORS_ORIGINS = 'http://localhost:3000'
$env:EMAIL_FROM = 'SaaS Platform <auth@example.test>'

npm.cmd run migration:run --workspace=apps/api
npm.cmd run test:e2e --workspace=apps/api

# Qualidade disponível na raiz
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
npm.cmd run audit
```

Antes de E2E, conferir que as variáveis no terminal apontam para a DB temporária, nunca `saas_db`/porta 5432. Migration de E2E é feita pelo próprio teste via `runMigrations`; o comando separado de migration só é necessário se a estratégia de validação o requerer e deve usar a mesma conexão isolada.

## 9. Plano de estudos associado às Tasks

Não é preciso estudar a stack inteira antes de começar. Ler código equivalente no repositório e estudar o assunto imediatamente antes da Task. Recursos em português recentes devem ser selecionados pelo tema e confirmados quanto à data/versão; as pesquisas públicas nesta auditoria não permitiram confirmar um conjunto de vídeos 2025/2026 que cobrisse fielmente estes fluxos. Evitar recomendar tutoriais desatualizados como referência de API. Complementar com documentação oficial e exemplos existentes no monorepo.

### Sprint 4

| Antes de  | Estudar                                                                                                                                    | Aplicação                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| BARBER-01 | TypeScript básico/intermédio: tipos de união, tipos de retorno, narrowing; NestJS Module/Controller/Guard; Next App Router e rota dinâmica | Ler guard Developer, decorators de autorização, módulos e landing page; adaptar a integração Barber.       |
| BARBER-02 | PostgreSQL: PK/FK, unique/check/index, `NULL`; TypeORM Entity/Relation e migrations `up/down`                                              | Modelar tenant, profissional opcional, relações e integridade; focar nos padrões já usados nas migrations. |
| BARBER-03 | React props/state/form events; formulários acessíveis; validação com DTOs; API REST e estados HTTP                                         | Editores do perfil/profissionais e erros de validação; entender o contrato API antes da UI.                |
| BARBER-04 | Relações muitos-para-muitos, transações básicas e validação de domínio; valores monetários como decimal/inteiro de cêntimos                | Catálogo e associação explícita; prevenir float monetário e ligações entre tenants.                        |
| BARBER-05 | formulários e pesquisa simples; minimização de PII e autorização de recurso                                                                | Nome/telefone/email opcional, duplicados aceites e filtros por organização.                                |
| BARBER-06 | Vitest, mocks vs integração, Supertest, testes de componentes e env vars no PowerShell                                                     | Completar qualidade; testar DB só na instância isolada.                                                    |

### Sprint 5

| Antes de     | Estudar                                                                                           | Aplicação                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| BARBER-07    | datas locais vs UTC, IANA timezone, PostgreSQL `timestamptz`, DST; React para inputs de data/hora | Horários recorrentes e interpretação no fuso organizacional.                                                                                     |
| BARBER-08    | intervalos temporais, limites inclusivos/exclusivos, validação de datas                           | Exceções e como intersetam horários/agendamentos.                                                                                                |
| BARBER-09    | Nest services/transações, DTOs e máquinas de estado simples; React formulários/listas             | Criar/editar/cancelar e validar transições sem perder snapshots.                                                                                 |
| BARBER-10    | isolamento/transações PostgreSQL, locks/constraints para intervalos, condições de corrida         | Escolher estratégia DB e demonstrar duas requisições concorrentes com uma só reserva válida. Não estudar otimização avançada até ser necessária. |
| BARBER-11/12 | componentes React de resumo, testes E2E com Supertest e leitura de logs de CI                     | Dashboard real e fluxo integral de testes.                                                                                                       |

Para vídeos em português recentes, pesquisar no YouTube pelo tema exato (por exemplo “React 19 TypeScript 2025”, “Next.js App Router 2025”, “NestJS TypeORM PostgreSQL 2025”, “PostgreSQL transações 2025”) e confirmar data, versão e conteúdo antes de seguir. Para conceitos sujeitos a mudança, a documentação oficial atual deve prevalecer sobre vídeo. A prioridade é português, mas não há recomendação de vídeo específico nesta versão porque os resultados verificados não confirmaram qualidade/atualidade suficiente para este projeto.

## 10. Decisões pendentes, recomendações e bloqueios

| Decisão/detalhe                                 | Recomendação                                                                                                                                                                                      | Bloqueia                                                                 | Tasks                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| Proprietário/responsável de serviços e clientes | Guardar criador e responsável profissional separadamente; permitir atribuição Owner/Admin; definir se Member cria serviço próprio                                                                 | Sim, antes das regras de escrita                                         | BARBER-03/04/05; BARBER-09     |
| Member gerir os próprios registos               | Relacionar user → membership → profissional. Profissional sem conta deve ter responsável explícito; sem responsável, só Owner/Admin edita                                                         | Sim, antes da autorização de escrita                                     | BARBER-03 a 05, BARBER-07 a 09 |
| Campos do perfil de barbearia/profissional      | Começar com nome de exibição, descrição curta/localização e contactos necessários; não duplicar campos de Organization sem motivo                                                                 | Não bloqueia modelo mínimo; fechar durante refinamento                   | BARBER-03                      |
| Retenção/exclusão de clientes                   | Soft-delete/arquivamento quando tiver histórico; definir prazo e direito de eliminação com responsável do produto antes de produção                                                               | Política final não bloqueia CRUD inicial; bloqueia eliminação definitiva | BARBER-05, BARBER-09           |
| Horas, pausas e fronteiras                      | Representar cada dia como zero ou mais intervalos; usar intervalos semiabertos `[início,fim)`; decidir limites de antecedência                                                                    | Não bloqueia S4; bloqueia disponibilidade                                | BARBER-07/08                   |
| Transições de estado                            | Recomendação: `PENDING→CONFIRMED/CANCELLED`; `CONFIRMED→COMPLETED/CANCELLED`; `COMPLETED` e `CANCELLED` terminais. Reabrir só por correção administrativa auditada, se necessário                 | Não bloqueia S4; bloqueia booking                                        | BARBER-09                      |
| Cancelamento/reagendamento e passado            | Sem reserva pública nesta fase; definir se operador pode cancelar a qualquer momento, motivo obrigatório e se permite agendar no passado para registo retroativo                                  | Não bloqueia S4; bloqueia critérios de booking                           | BARBER-09                      |
| Buffer entre serviços                           | Começar sem buffer, mas manter intervalos calculados extensíveis; só adicionar campo/regra quando aprovado                                                                                        | Não bloqueia S4; fecha antes da concorrência S5                          | BARBER-07/10                   |
| Estratégia DB de conflito                       | Avaliar exclusion constraint PostgreSQL para intervalos de um profissional vs lock/transação; escolher depois de definir intervalos e suporte/extensão operacional. Teste concorrente obrigatório | Não bloqueia S4; bloqueia S5 scheduling                                  | BARBER-10                      |
| Configuração E2E anterior                       | Repetir validação com env vars explícitas e DB isolada; causa reportada é valor de DB sem `_test`, mas origem do valor efetivo não foi provada                                                    | Pré-requisito de execução E2E S4                                         | BARBER-06/12                   |

Riscos principais: complexidade de concorrência e DST; propriedade de dados operacionais por Member; crescimento do escopo; retenção de dados pessoais; afirmar funcionamento E2E sem execução. Mitigar com decisões antes das Tasks dependentes, testes PostgreSQL reais e critérios de aceite verificáveis.

## 11. Definition of Done

### Sprint 4

- Módulo acessível apenas para membership válido, organização ativa, módulo Barber habilitado e permissão adequada.
- Perfil, profissionais com/sem conta, serviços/associações e clientes funcionam sem cruzar tenants.
- Regras Owner/Admin/Member são cobertas no backend e documentadas por entidade.
- Migrations explícitas, reversíveis e sem perda de histórico; sem upload público.
- Testes unitários, integração e frontend críticos passam; E2E apenas marcado como funcional depois de comprovado contra PostgreSQL de teste isolado.
- Lint, format check, typecheck, build e CI passam ou têm falha documentada/resolvida conforme processo do projeto.
- Documentação descreve limitações reais e não agenda features futuras como já implementadas.

### Sprint 5

- Horários, pausas/exceções e agenda usam timezone organizacional e preservam instantes durante DST.
- Estados, autorização por propriedade, snapshots EUR/duração e histórico respeitam decisões aprovadas.
- Conflitos e requisições concorrentes são bloqueados no backend/DB e demonstrados em teste PostgreSQL.
- Dashboard deriva apenas de dados reais e respeita tenant/timezone/permissões.
- E2E de fluxo completo e isolamento passa na base dedicada; qualidade CI e documentação concluídas.

## 12. Ficheiros e alterações desta tarefa

Planeamento documentado neste ficheiro. O estado funcional do repositório não foi alterado. Foram apenas inspecionados arquivos e criada esta documentação de planeamento autorizada; nenhum código funcional, migration, configuração ou dependência foi alterado. Nenhum teste/comando de validação foi executado; branch, commits e ficheiros não rastreados foram preservados.
