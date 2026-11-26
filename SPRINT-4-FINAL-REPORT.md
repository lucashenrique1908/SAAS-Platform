# Relatório da Sprint 4 — Barber Module

Data: 20/11/2026  
Branch: `feature/barber-sprint-4`

## Estado geral

Implementação funcional da fundação Barber. As rotas continuam sob a autenticação, sessão, CSRF e memberships da plataforma. O login de cliente reutiliza a autenticação existente e não cria membership nem papel interno. Não foram criadas marcações nem funcionalidades da Sprint 5. A aceitação formal permanece pendente de verificação de navegação e formulários num browser; a suite atual não contém E2E web.

## BARBER-01 a BARBER-06

| Task      | Estado                  | Resultado                                                                                                                                                                              |
| --------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BARBER-01 | Implementada e validada | Nest module, rotas, guard de organização/módulo, BFF e página de workspace.                                                                                                            |
| BARBER-02 | Implementada e migrada  | Entidades tenant-scoped, relações e duas migrations reversíveis aplicadas na base local e na base E2E.                                                                                 |
| BARBER-03 | Implementada e validada | Perfil de negócio; profissionais com/sem utilizador; ligação opcional a Member; gestão de atribuições; exclusão transacional só por Owner.                                             |
| BARBER-04 | Implementada e validada | CRUD de serviços, preço inteiro em cêntimos EUR, duração em minutos e associação N:N explícita, alterável por Owner/Admin.                                                             |
| BARBER-05 | Implementada e validada | CRUD de clientes, email opcional, duplicados permitidos, atribuição automática ao profissional do Member, consulta e edição limitadas por responsabilidade.                            |
| BARBER-06 | Parcial                 | API E2E/unit, segurança, isolamento, migrations, lint, typecheck, builds e documentação validados. A verificação interativa de navegação e formulários num browser permanece pendente. |

## Modelo, autorização e rotas

Entidades criadas: `BarberBusinessProfile`, `BarberProfessional`, `BarberProfessionalManager`, `BarberService`, `BarberProfessionalService` e `BarberClient`.

Rotas internas, todas sob `/organizations/:slug/barber`:

- `GET/PUT profile`
- `GET/POST professionals`, `PUT/DELETE professionals/:id`
- `GET/POST services`, `PUT services/:id` (inclui desativação via `isActive=false`)
- `GET/PUT professional-services`
- `GET professional-access` (identifica os profissionais que o Member pode editar)
- `GET/POST clients`, `PUT clients/:id`
- `GET/PUT professional-managers`

O endpoint de cliente autenticado é `GET /barber-customer/me`. A identidade não tem membership e só encontra a ficha pelo próprio `userId`.

`OrganizationAccessGuard` verifica organização ativa e membership. `BarberAccessGuard` verifica o módulo habilitado e permissão Barber. As regras de propriedade/responsabilidade e operações Owner/Admin também são verificadas no backend. Relações profissional-serviço e cliente-profissional têm FKs compostas com `organization_id`, para impedir relações cross-tenant no banco.

Ao remover um Member, a transação remove a atribuição de gestão e a FK limpa `BarberProfessional.userId`; o profissional fica preservado. Apenas Owner pode excluir profissional. A exclusão remove associações, coloca `responsibleProfessionalId` dos clientes em `NULL` e preserva a ficha e os dados pessoais dos clientes.

Timezone inicial `Europe/Lisbon`, configurável e validada como timezone IANA. Ainda não há instantes de marcação nesta Sprint.

## Frontend

Página: `/workspace/barber-demo/barber`. Inclui estados de carregamento/erro, perfil, profissionais, serviços, clientes e formulários de criação/edição. Owner/Admin veem os controlos de gestão e associação; Member recebe apenas as operações da sua permissão/responsabilidade. O Owner tem o controlo de exclusão definitiva.

Área de cliente: `/customer`. Após login de uma conta sem membership, a navegação abre essa área. O cliente vê nome, telefone e email da própria ficha; não vê painel interno nem marcações.

## Migrations e seeds

- `1763600000000-CreateBarberCore.ts`
- `1763700000000-BarberProfessionalMembershipLink.ts`
- `npm run migration:run --workspace=apps/api` aplicado à base local `saas_db` em loopback.
- A suite E2E executou migrations na base isolada `saas_auth_test` (`127.0.0.1:5433`).
- Seed: `npm run seed:barber-demo --workspace=apps/api`.
- O seed só aceita `development` ou `test` (ou `NODE_ENV` ausente), é idempotente, usa `argon2id`, não guarda passwords em claro e não emite credenciais sem `--show-credentials`. Rotação explícita revoga sessões existentes: `npm run seed:barber-demo --workspace=apps/api -- --reset-passwords --show-credentials`.

O seed criou a organização `barber-demo`, perfil, Owner, Admin, Member-profissional, serviços/associações e dois clientes, sendo um cliente associado a uma conta sem membership.

## Contas de demonstração

As passwords abaixo foram geradas pelo seed, gravadas apenas como hashes Argon2id e testadas por login/logout. São credenciais locais de demonstração; não as reutilize noutros ambientes.

| Tipo         | Email                                   | Password inicial           | Organização / acesso                                                               | Permissões e teste                                                                                                            |
| ------------ | --------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Owner        | `owner@barber-demo.example.test`        | `M4ARHWPQkE-rwFlbvR51_Ddl` | `Barber Demo Lisboa`; `http://localhost:3000/login` → workspace                    | `owner`; perfil, equipa, serviços, associações, clientes e exclusão definitiva de profissional.                               |
| Admin        | `admin@barber-demo.example.test`        | `W6TlUmydSx9VdfGktq8_QMcn` | Mesma organização; `http://localhost:3000/login` → workspace                       | `admin`; gestão administrativa, sem excluir profissional.                                                                     |
| Profissional | `professional@barber-demo.example.test` | `LElwBC3Po7glu92fjOiRlvTw` | Mesma organização; `http://localhost:3000/login` → `/workspace/barber-demo/barber` | `member`, ligado por `BarberProfessional.userId`; `barber:read` e `barber:write`; dados de clientes sob sua responsabilidade. |
| Cliente      | `client@barber-demo.example.test`       | `8jkNf-H8ZTaVTB4KP6lLY-2z` | Sem membership; `http://localhost:3000/login` → `http://localhost:3000/customer`   | Sem papel/permissões internos; consulta apenas a própria ficha. Não pode abrir workspace nem agendar.                         |

Login das quatro contas: `POST /auth/login` respondeu 200; `/auth/me` respondeu 200; logout respondeu 204. E2E também confirmou que a conta cliente não tem memberships e recebe 404 ao tentar abrir rota interna da organização.

## Verificações executadas

- API unit: 8 ficheiros, **83/83 testes passaram**.
- API E2E, PostgreSQL isolado: **23/23 testes passaram**.
- Web unit: 1 ficheiro, **3/3 testes passaram**.
- Typecheck API: passou.
- Typecheck web: passou.
- Lint API (ESLint + Oxlint): passou.
- Lint web (ESLint): passou.
- Build de produção API e web: passou. O primeiro build da web apontou ausência de fronteira Suspense na rota dinâmica `/customer`; a rota foi ajustada e o build completo passou.
- Migrations: aplicadas com sucesso em `saas_db`; E2E confirmou a sequência em `saas_auth_test`.
- Rollback e reaplicação da última migration (`1763700000000`) também foram validados na base E2E isolada.
- Seed repetido: não duplicou organização nem contas e não alterou passwords sem opção de rotação.
- As quatro credenciais foram exercitadas no endpoint de login e sessão e terminaram com logout.

Após a suite completa E2E (23/23), foi executado também o teste focado da rota `professional-access` (1/1). A tentativa de smoke test headless com Edge/CDP ficou sem resposta e não conta como validação. A suite web existente contém apenas três testes unitários e não tem E2E de navegação; não há revisão visual aprovada em diferentes resoluções.

## Critério de aceitação pendente

Não declaro a Sprint 4 formalmente concluída enquanto o fluxo visual no browser — login e redirecionamento das quatro identidades, navegação, submissão/edição de formulários, feedback de erro/loading e visibilidade dos controlos — não for validado. A aplicação compila, as permissões passaram testes E2E e as quatro credenciais foram exercitadas via API; falta esta camada de QA interativa.

## Limitações e Sprint 5

- Não existem marcações, horários, disponibilidade, snapshots de serviço, histórico operacional ou dashboard de agenda; ficam para a Sprint 5.
- O cliente da barbearia só tem consulta própria nesta demonstração; não há edição de conta nem marcações.
- A exclusão profissional elimina as relações e os dados operacionais existentes no modelo S4; ainda não existem tabelas de marcações/horários/histórico para apagar.
- Verificação de browser em diferentes resoluções não foi executada.

## Iniciar e experimentar

1. Iniciar PostgreSQL e a API/web conforme os comandos dos respetivos READMEs.
2. Aplicar migrations com `npm run migration:run --workspace=apps/api`.
3. Criar/reconciliar os dados com `npm run seed:barber-demo --workspace=apps/api`.
4. Abrir `http://localhost:3000/login` e usar uma das contas acima.
5. Owner, Admin e Profissional abrem Barber em `/workspace/barber-demo/barber`; Cliente abre `/customer`.

O seed normal não repõe passwords já existentes. Para rotacionar e receber novas passwords, usar a opção explícita `--reset-passwords --show-credentials` e atualizar este relatório/credenciais guardadas.
