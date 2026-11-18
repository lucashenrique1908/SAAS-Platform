# Plano das Sprints 4 e 5 — Barber Module

## 1. Resumo e estado

Este documento define o plano de implementação futuro do módulo Barber. Não descreve funcionalidade já implementada. O âmbito é interno à organização e cobre gestão da barbearia e profissionais, catálogo, clientes, disponibilidade, marcações e operações. Perfis públicos, descoberta pública, fotos e uploads estão fora das Sprints 4 e 5. As estimativas são provisórias, dado o carácter de aprendizagem do projeto.

A arquitetura existente é um monorepo npm workspaces com API NestJS, TypeORM e PostgreSQL e web Next.js. A API usa migrations explícitas e `synchronize: false`; sessão, CSRF, memberships, módulos habilitáveis e permissões da organização já existem. A web usa o BFF para chamadas autenticadas. Reutilizar estes padrões e não copiar a propriedade individual do módulo Developer para os recursos partilhados da barbearia.

Estrutura indicativa: API em `apps/api/src/barber/` (module, controller, services, guards, DTOs e entities); páginas internas em `apps/web/src/app/workspace/[slug]/barber/` e componentes em `apps/web/src/components/barber/`. Endpoints agrupados por `/organizations/:slug/barber`; contratos finais são definidos ao implementar DTOs, sem contornar sessão/BFF/CSRF.

Superfície funcional prevista: Sprint 4, leitura/edição do perfil; CRUD de profissionais e atribuições de gestão por Owner/Admin; CRUD de serviços e gestão Owner/Admin da relação profissional-serviço; CRUD de clientes conforme responsabilidade. Sprint 5, horários, exceções, consulta de disponibilidade, criação/gestão/cancelamento de marcações e resumo operacional. Autorização e isolamento aplicam-se a todas as rotas.

Na auditoria, `HEAD` e `origin/develop` observados localmente apontavam para `7bb0a46825d933ddffb8e2dfa45d39f4bd391ac7`; branch observada: `docs/barber-ownership-rules`. Já existiam relatórios e `artifacts/` não rastreados, preservados. Esta tarefa altera apenas este documento.

## 2. Regras de produto aprovadas

As regras abaixo estão fechadas e não são decisões pendentes:

- Existem perfil de negócio da barbearia e perfis individuais de profissionais. Só Owner/Admin criam e editam o perfil de negócio. Member pode lê-lo segundo a permissão do módulo.
- Cada Member pode editar o seu próprio perfil profissional. Members também podem gerir profissionais explicitamente atribuídos. Owner/Admin podem criar e gerir profissionais com ou sem conta de plataforma.
- Apenas Owner/Admin criam, alteram ou removem a associação administrativa profissional-Member. Na saída de um Member, essa associação é removida automaticamente e o profissional/dados são preservados; Owner/Admin podem atribuí-lo a outro Member.
- Apenas Owner pode excluir permanentemente um profissional; Admin não pode fazê-lo. A operação elimina perfil, marcações, histórico, horários, indisponibilidades, associações a serviços, associações administrativas a Members e os restantes dados operacionais desse profissional. Os registos de clientes e todos os seus dados pessoais têm de ser preservados integralmente; remover as associações do profissional a clientes sem cascata que apague clientes. A operação tem de ser transacional.
- Owner/Admin criam e gerem serviços e atribuem os profissionais que os podem executar. A relação serviço-profissional é explícita e pode ser muitos-para-muitos. Member nunca cria, altera, atribui ou remove essas associações. Member só altera dados do serviço quando a responsabilidade aplicável o permite, sem poderes administrativos sobre associações.
- Cliente tem nome e telefone obrigatórios, email opcional e duplicados permitidos. Ao criar cliente, Member fica automaticamente associado ao profissional ligado à sua conta. Member só consulta/edita os seus clientes; Owner/Admin podem consultar/gerir todos. Ver dados do cliente no contexto de uma marcação é exceção limitada, não acesso geral ao registo.
- O cliente pode escolher no agendamento um profissional disponibilizado para o serviço. Esta escolha é independente da associação administrativa profissional-Member.
- Agendamento distingue o utilizador criador (`createdByUserId`) do profissional associado. Criador e profissional associado podem geri-lo de acordo com autorização; Owner/Admin gerem todas as marcações. Member pode ver, em marcação de outro profissional, nome e contactos do cliente e serviço associado, mas não consultar/editar o registo geral do cliente por isso.
- Estados: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`. Cancelamento normal preserva histórico. A exclusão permanente do profissional é uma exceção expressamente aprovada: elimina as suas marcações e histórico associado.
- `barber:read` dá leitura dos dados operacionais permitidos pelas regras acima. `barber:write` só permite escrita dentro da responsabilidade ou atribuição aplicável. API aplica autorização; interface não é fronteira de segurança.
- Isolamento por organização é obrigatório. Timezone configurável por organização, com `Europe/Lisbon` como valor inicial recomendado. Preços em EUR; marcações guardam snapshots de preço/duração. Uma localização por organização nesta versão.

## 3. Arquitetura, responsabilidade e conflitos resolvidos

Auth/Organizations já têm `OrganizationAccessGuard`, memberships com papéis `owner`, `admin`, `member` e permissões do módulo. Owner/Admin têm acesso organizacional amplo; Members precisam da permissão pertinente. O módulo Barber ainda não tem entidades/migrations próprias. Verificar organização, membership, estado do módulo e permissão/responsabilidade no backend em todas as operações e consultas por ID.

### Conceitos e uso por entidade

- `createdByUserId`: utilizador de plataforma que criou determinado registo; registo de autoria, não de responsabilidade atual.
- `userId`: associação opcional da entidade `BarberProfessional` à conta de plataforma do profissional. Não representa a associação administrativa de gestão.
- `responsibleProfessionalId`: usar apenas em recursos com responsável profissional singular. Adequado, por exemplo, à associação de um cliente ao profissional que o Member tinha ao criá-lo. Não usar em `BarberService`, cuja associação de execução é muitos-para-muitos, nem como substituto do profissional da marcação.
- Associação administrativa profissional-Member: relação própria, tenant-scoped, para conceder gestão Member a profissionais explicitamente atribuídos. Só Owner/Admin a alteram.
- `BarberAppointment` usa `createdByUserId` e `professionalId` em conceitos/relações distintos. A escolha do profissional pelo cliente no agendamento seleciona um profissional associado ao serviço e disponibilizado pela organização; não cria nem altera a associação administrativa profissional-Member.

| Entidade                                         | Tenant                                  | Criador                                       | Responsabilidade/atribuição                                                                                                                      | Conta de plataforma                                                     |
| ------------------------------------------------ | --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `BarberBusinessProfile`                          | `organizationId`, único por organização | Opcional para auditoria                       | Nenhuma; recurso partilhado da organização                                                                                                       | Nenhuma                                                                 |
| `BarberProfessional`                             | `organizationId` obrigatório            | Recomendado para auditoria                    | Associação administrativa a Member em relação separada                                                                                           | `userId` opcional; profissional sem conta é válido                      |
| `BarberProfessionalManager` (relação indicativa) | Tenant validado                         | Auditoria de quem atribuiu é recomendada      | Liga profissional a Member explicitamente autorizado; gestão da relação apenas Owner/Admin                                                       | Referencia Member/membership, não substitui `BarberProfessional.userId` |
| `BarberService`                                  | `organizationId` obrigatório            | Recomendado                                   | Sem responsável singular; profissionais autorizados pelo conjunto de associações                                                                 | Nenhuma                                                                 |
| `BarberProfessionalService`                      | `organizationId` e FKs de mesmo tenant  | Opcional                                      | Associação N:N explícita; só Owner/Admin alteram                                                                                                 | Nenhuma                                                                 |
| `BarberClient`                                   | `organizationId` obrigatório            | `createdByUserId` recomendado                 | Profissional atribuído; autoassociação no create por Member. Ao excluir profissional, retirar a referência e manter cliente/dados integralmente. | Nenhuma                                                                 |
| `BarberAppointment`                              | `organizationId` obrigatório            | `createdByUserId` obrigatório enquanto existe | `professionalId` do atendimento; criador e profissional podem gerir conforme autorização                                                         | Criador e profissional são referências distintas                        |
| `BarberWorkingHours`                             | `organizationId` obrigatório            | Opcional para auditoria                       | Pertence a profissional                                                                                                                          | Nenhuma                                                                 |
| `BarberAvailabilityException`                    | `organizationId` obrigatório            | Recomendado para auditoria                    | Pertence a profissional                                                                                                                          | Nenhuma                                                                 |

### Acesso a clientes e marcações; efeitos de remoção

Member consulta/edita clientes atribuídos ao seu perfil profissional no módulo de clientes. Em qualquer marcação que tenha autorização para ler pela regra operacional, pode ver o nome, contacto e serviço dessa marcação, mesmo que pertença a outro profissional. Essa projeção contextual não concede acesso à ficha geral, pesquisa ou edição do cliente. Se a exclusão de profissional eliminar uma marcação, essa projeção deixa de existir com a marcação; o registo geral de cliente e os dados pessoais não são alterados.

Quando um profissional é excluído, os clientes antes associados a ele permanecem íntegros e ficam sem essa associação. Owner/Admin continuam a poder consultar/gerir todos os clientes. Member continua limitado aos clientes sob a sua responsabilidade; a eliminação não transfere automaticamente clientes a outro profissional nem concede acesso geral. Uma eventual reatribuição é operação administrativa segundo as permissões existentes, sem atribuição automática definida neste plano.

A saída de Member é diferente: elimina a associação administrativa desse Member ao profissional, mas preserva o profissional e todos os dados operacionais. Não equivale à exclusão do profissional. `userId` da conta profissional também é distinto da relação de gestão; a API nunca concede acesso sem membership ativa. A implementação deve manter essa distinção e não pode apagar perfil/dados por saída de Member.

## 4. Matriz de permissões por entidade

Pré-condições comuns: sessão válida, organização ativa, membership válida, Barber habilitado e autorização de módulo. Operações Member exigem a permissão adequada e verificação de responsabilidade/atribuição. `barber:read` sozinho não permite escrita. `barber:write` não concede ações administrativas. A tabela descreve direitos de dados da organização; regras de associação a conta, atribuição e exclusão estão explícitas por linha.

| Entidade                                      | Owner                                                                               | Admin                                                                                | Member `barber:read`                                                                                                           | Member `barber:write`                                                                                                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil de negócio                             | Ler/criar/editar; sem vínculo profissional artificial                               | Igual ao Owner                                                                       | Ler                                                                                                                            | Ler; sem criar/editar                                                                                                                                                                                                              |
| Profissional                                  | Ler/criar/editar todos; associar conta e atribuir gestores; excluir permanentemente | Ler/criar/editar todos; associar conta e atribuir gestores; não excluir profissional | Ler todos                                                                                                                      | Editar o próprio perfil ligado à conta e gerir profissionais explicitamente atribuídos; sem criar profissional nem alterar conta/associação de gestão; sem excluir                                                                 |
| Associação administrativa profissional-Member | Criar/alterar/remover                                                               | Criar/alterar/remover                                                                | Ler quando exposta pela operação autorizada                                                                                    | Sem criar, alterar ou remover                                                                                                                                                                                                      |
| Serviço                                       | Ler/criar/editar/desativar; atribuir/reassociar profissionais                       | Igual ao Owner                                                                       | Ler todos                                                                                                                      | Editar apenas campos permitidos se a responsabilidade se aplicar ao profissional próprio/atribuído; sem criar serviço ou mudar associação profissional-serviço                                                                     |
| Associação serviço-profissional               | Criar/alterar/remover                                                               | Criar/alterar/remover                                                                | Ler                                                                                                                            | Ler; sem atribuir, alterar ou remover                                                                                                                                                                                              |
| Cliente                                       | Ler/criar/editar/arquivar todos; gerir associação profissional                      | Igual ao Owner                                                                       | Ler apenas os seus no contexto de clientes; na marcação autorizada, ver nome/contactos/serviço inclusive de outro profissional | Criar (autoassociação ao próprio profissional), ler/editar apenas os seus; sem reatribuir. Duplicados permitidos                                                                                                                   |
| Horário                                       | Ler/criar/editar/remover de todos                                                   | Igual ao Owner                                                                       | Ler todos                                                                                                                      | Ler todos; editar/remover apenas o próprio horário ou de profissional atribuído                                                                                                                                                    |
| Exceção de disponibilidade                    | Ler/criar/editar/remover de todos                                                   | Igual ao Owner                                                                       | Ler todas                                                                                                                      | Ler todas; gerir apenas profissional próprio ou atribuído                                                                                                                                                                          |
| Marcação                                      | Ler/criar/editar/cancelar todas                                                     | Igual ao Owner                                                                       | Ler marcações organizacionais; nos seus dados contextuais mostrar nome/contacto do cliente e serviço                           | Criar; gerir se Member for criador ou profissional associado ligado/atribuído. Sem alterar autor original ou reassociar profissional. Escolha inicial de profissional é do cliente dentro das opções disponibilizadas para serviço |
| Dashboard                                     | Ler agregado organizacional                                                         | Igual ao Owner                                                                       | Ler agregado permitido, respeitando visibilidade de marcação/cliente                                                           | Ler agregado permitido; sem escrita                                                                                                                                                                                                |

**Exclusão profissional:** só Owner, em operação permanente e transacional. Admin, mesmo com acesso administrativo geral, recebe recusa. Elimina todos os dados e relações operacionais pertencentes ao profissional, incluindo marcações e histórico; preserva clientes/dados pessoais e remove associações profissional-cliente sem cascata para cliente.

**Saída de Member:** ao remover membership, também remover a relação administrativa entre esse Member e o profissional; manter profissional/dados. Owner/Admin podem criar nova atribuição. Não confundir com exclusão profissional.

## 5. Modelo de dados, integridade e segurança

Modelo lógico indicativo (não schema aprovado):

- `BarberBusinessProfile`: um por organização, `organizationId` único.
- `BarberProfessional`: `organizationId`, `userId` anulável, dados/estado do profissional. Associação a conta valida membership do utilizador na organização no momento da associação; a referência de conta não é a relação administrativa de gestão. A integridade/remoção de membership não pode apagar profissional/dados; o desenho de FK deve preservar este requisito. Profissional sem conta permanece válido.
- Relação profissional-Member separada de `userId`; valida tenant e membership. A cardinalidade permanece detalhe técnico a fechar.
- `BarberService`: tenant, preço EUR, duração, descrição/estado. Não tem `responsibleProfessionalId` singular se N:N.
- `BarberProfessionalService`: tabela/relacionamento N:N com unicidade do par profissional-serviço e ambos no mesmo tenant.
- `BarberClient`: tenant, nome, telefone, email opcional, criador opcional e associação profissional de responsabilidade. Permitir ausência de profissional após exclusão do associado; não impor unicidade de duplicados.
- `BarberWorkingHours`: períodos recorrentes por profissional/dia, um ou mais intervalos para permitir pausas.
- `BarberAvailabilityException`: intervalo de indisponibilidade associado ao profissional.
- `BarberAppointment`: tenant, `createdByUserId`, `professionalId`, cliente, serviço, instantes, estado e snapshots de preço/duração. FKs/relações coerentes com tenant.

Requisitos de implementação:

1. Incluir `organizationId` em cada tabela operacional apropriada. Consultas sempre filtram pelo tenant validado no backend; não depender da UI nem de ID recebido.
2. Usar FKs compostas/constraints apropriadas para impedir relações entre organizações: profissional e conta validada na membership do tenant; profissional e gestor; os dois lados da junção serviço-profissional; cliente/profissional; marcação/criador, cliente, serviço e profissional. A referência opcional `userId` não pode criar dependência que apague profissional quando uma membership termina. Índices devem apoiar consultas tenant-scoped e unicidade; não criar relações apenas no ORM sem constraint de DB quando a integridade exigir garantia concorrente.
3. Na criação de cliente por Member, derivar profissional do vínculo autenticado, nunca confiar em `responsibleProfessionalId` enviado pelo cliente. Na marcação, validar serviço ativo e associação com o profissional escolhido, todos no tenant.
4. Validar autorização em API/service para leitura, escrita e reassociação, incluindo acesso por ID. As ações do Owner/Admin sobre associações não podem ser invocadas por Member. Transações unem mudança de membership e remoção da associação de gestão quando necessário.
5. **Exclusão profissional:** autorização Owner-only validada no backend; uma única transação atómica elimina todas as marcações e histórico operacional, horários, exceções, junções com serviços, associações profissionais-Member e restantes dependências do profissional. Remover também a associação `BarberClient` ao profissional. A FK/estratégia de referência de cliente não pode executar `CASCADE` para a linha do cliente nem para dados pessoais; deve permitir que o cliente permaneça sem associação profissional. Remover primeiro dependências que referenciam o profissional, manter intactas as linhas de cliente e eliminar o perfil profissional por último, ou usar outra ordem/transação que satisfaça as mesmas invariantes. Se qualquer passo falhar, reverter toda a transação para não deixar eliminação parcial. Não preservar marcações/histórico do profissional excluído. Definir nulabilidade e ordem concreta ao desenhar a migration; este documento não fixa schema nem mecanismo.
6. Saída de Member remove a associação de gestão sem acionar deleção do profissional, dos seus dados, clientes ou marcações. A autorização futura decorre de membership ativa mais permissão e responsabilidade/atribuição atual.
7. Definir política de deleção/retensão para as restantes entidades. Usar migrations TypeORM explícitas, reversíveis, sem `synchronize`; FKs e política de retenção não podem introduzir cascatas destrutivas não aprovadas.
8. Preços persistidos com exatidão (decimal adequado ou cêntimos inteiros), nunca float binário. Instantes de marcação inequívocos; recorrências/entrada local interpretadas no timezone da organização, incluindo DST.

## 6. Sprint 4 — Foundation & Management

Objetivo: acesso, modelo/migrations, perfil de negócio e profissionais, catálogo/associações e clientes. Sem agenda, disponibilidade ou descoberta pública. Todas as estimativas são provisórias. Prioridade P0 significa necessária para completar a fundação, não compromisso de capacidade.

### BARBER-01 — Acesso ao módulo

- **Objetivo/descrição:** estabelecer rotas e UI Barber protegidas pelo modelo existente.
- **Subtasks:** registar módulo Nest e entidades; guard de módulo ativo; controller sob `/organizations/:slug/barber`; páginas/navegação e BFF; política de permissão por rota.
- **Aceitação:** sem membership/organização ativa/módulo habilitado não há acesso; Owner/Admin têm acesso operacional; Member exige permissão apropriada; tentativas de escrita sem `barber:write` são recusadas no backend; UI não substitui autorização.
- **Dependências:** nenhuma. **Prioridade:** P0. **Estimativa:** 3 pontos. **Áreas:** Backend, Frontend, Testing, Documentation.

### BARBER-02 — Modelo, migrations e isolamento

- **Objetivo/descrição:** definir tabelas, FKs, índices, constraints tenant-safe e política referencial para entidades Sprint 4.
- **Subtasks:** mapear entidades/relacionamentos; fechar retenção inicial e índices; criar migration explícita `up/down`; registar TypeORM; provar rollback e integridade.
- **Aceitação:** perfil único por organização; profissional com/sem conta; relação service-professional N:N; duplicados de cliente aceites; referências cross-tenant rejeitadas no DB; migration reversível; nenhuma cascata para clientes; nulabilidade de associação cliente-profissional compatível com exclusão futura aprovada e cascatas de outros dados apenas conforme regras de exclusão explicitamente aprovadas.
- **Dependências:** BARBER-01. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Backend, Database, Testing, Documentation.

### BARBER-03 — Perfil da barbearia e profissionais

- **Objetivo/descrição:** gerir perfil de negócio e perfis profissionais internos.
- **Subtasks:** definir campos mínimos; DTO/service/API; associação opcional de conta; relação administrativa profissional-Member; edição própria e gestão atribuída; comportamento de saída de Member; implementar autorização de exclusão exclusivamente Owner e remoção transacional do perfil e dependências operacionais, depois de BARBER-02 definir constraints compatíveis.
- **Aceitação:** somente Owner/Admin criam/editam perfil de negócio e gerem todos profissionais; Member edita próprio perfil ou gere profissional explicitamente atribuído com `barber:write`; Owner/Admin atribuem/alteram/removem relação de gestão; profissional sem conta continua válido; saída remove relação Member-profissional e preserva profissional/dados; Admin é recusado na exclusão; Owner exclui perfil, marcações/histórico, horários, exceções, associações de serviços/Members e restantes dados operacionais em transação; clientes e todos os seus dados pessoais permanecem e a ligação ao profissional é removida sem cascata. Falha em qualquer passo reverte operação integralmente.
- **Dependências:** BARBER-02. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Backend, Frontend, Database, Testing.

### BARBER-04 — Serviços e atribuições

- **Objetivo/descrição:** gerir catálogo e profissionais habilitados para cada serviço.
- **Subtasks:** preço/duração/validação; CRUD tenant-aware; junção N:N; UI de associação; regras de responsabilidade de Member.
- **Aceitação:** Owner/Admin criam e gerem serviços e atribuições; associação é explícita e permite vários profissionais; Member nunca cria/altera/remove/reatribui associações; Member edita apenas campos operacionais permitidos quando responsabilidade se aplica; ID de serviço ou profissional de outro tenant é rejeitado; histórico de marcações guarda snapshots.
- **Dependências:** BARBER-02 e BARBER-03. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Backend, Frontend, Database, Testing.

### BARBER-05 — Clientes

- **Objetivo/descrição:** criar e consultar fichas mínimas com proteção de responsabilidade.
- **Subtasks:** DTO/nome/telefone/email; create Member com profissional derivado da conta; CRUD/pesquisa; UI; regras de associação e restrição contextual de marcação.
- **Aceitação:** nome e telefone obrigatórios, email opcional, duplicados aceites; Member cria cliente associado ao seu perfil profissional, consulta/edita apenas os seus; Owner/Admin consultam/gerem todos; payload de marcação dá acesso contextual a nome/contacto/serviço conforme regra, sem conceder acesso à ficha geral; FK profissional pode ser removida sem alterar/apagar cliente na exclusão de profissional.
- **Dependências:** BARBER-02/03. **Prioridade:** P0. **Estimativa:** 3 pontos. **Áreas:** Backend, Frontend, Database, Testing.

### BARBER-06 — Testes, segurança e documentação da Sprint 4

- **Objetivo/descrição:** verificar regras, autorização, integridade e documentação fiel da fundação.
- **Subtasks:** testes unitários de validação/serviços; integração PostgreSQL para constraints e migrations; matriz de papéis por recurso; testes web/BFF/CSRF; documentação técnica do que estiver implementado.
- **Aceitação:** testes backend comprovam isolamento e todas as permissões; cobrem profissionais com/sem conta, atribuições, saída Member sem perda de dados, relação N:N, clientes duplicados/autoassociação e acesso contextual; E2E só declarado funcional após execução contra DB de teste isolada; erro E2E anterior não é declarado resolvido sem evidência.
- **Dependências:** BARBER-01 a BARBER-05. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Backend, Frontend, Database, Testing, Infrastructure, Documentation.

**Estimativa Sprint 4:** 26 pontos, provisória; dividir BARBER-03/04/06 conforme capacidade sem alterar regras aprovadas.

## 7. Sprint 5 — Scheduling & Operations

Objetivo: disponibilidade e operação de marcações sobre entidades Sprint 4. Sem reserva pública, uploads ou descoberta pública.

### BARBER-07 — Horários e disponibilidade

- **Objetivo/descrição:** manter períodos recorrentes e calcular opções de atendimento por serviço/profissional.
- **Subtasks:** fechar intervalos e pausas; DTO/modelo; endpoints; UI semanal; algoritmo de disponibilidade no timezone organizacional.
- **Aceitação:** aceita zero ou mais períodos válidos por dia; suporta pausas; serviço só oferece profissionais associados/disponibilizados; autorização de escrita respeita próprio perfil ou atribuição; testes de fronteiras e DST passam.
- **Dependências:** Sprint 4, especialmente BARBER-03/04. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Backend, Frontend, Database, Testing.

### BARBER-08 — Indisponibilidades

- **Objetivo/descrição:** gerir exceções de disponibilidade vinculadas a profissional.
- **Subtasks:** modelo/validação intervalar; API CRUD; UI de datas/horas; integrar exceções no cálculo.
- **Aceitação:** intervalos inválidos rejeitados; exceções bloqueiam novas opções durante o período; escrita limitada a Owner/Admin ou Member com responsabilidade própria/atribuída e `barber:write`; alteração não apaga marcações existentes.
- **Dependências:** BARBER-07. **Prioridade:** P0. **Estimativa:** 3 pontos. **Áreas:** Backend, Frontend, Database, Testing.

### BARBER-09 — Agendamentos

- **Objetivo/descrição:** criar e gerir marcações, distinguindo autor e profissional designado.
- **Subtasks:** entidade/API e estados; escolha do profissional entre os disponibilizados para serviço; validações tenant/cliente/serviço; snapshots; UI calendário/lista e projeção contextual de cliente.
- **Aceitação:** cliente escolhe profissional elegível para serviço; grava `createdByUserId` distinto de `professionalId`; Member com write pode gerir se criador ou profissional associado/atribuído; Owner/Admin gerem todas; Member lê nome/contacto/serviço da marcação de outro profissional mas não acede por isso à ficha geral; estados limitados aos quatro aprovados; cancelamento normal mantém histórico; snapshots não mudam quando serviço muda.
- **Dependências:** BARBER-04/05 e BARBER-07/08. **Prioridade:** P0. **Estimativa:** 8 pontos. **Áreas:** Backend, Frontend, Database, Testing.

### BARBER-10 — Conflitos e concorrência

- **Objetivo/descrição:** impedir reservas incompatíveis em criação e edição concorrentes.
- **Subtasks:** definir fronteiras e estados que ocupam horário; escolher estratégia PostgreSQL; proteger operações em transação; mapear conflitos; teste de corrida.
- **Aceitação:** conflitos parciais/contidos e edições rejeitados; entre requisições simultâneas incompatíveis apenas uma é aceite; cancelada deixa de ocupar disponibilidade conforme semântica aprovada; decisão usa DB/transação, não consulta da UI.
- **Dependências:** BARBER-07 a BARBER-09. **Prioridade:** P0. **Estimativa:** 8 pontos. **Áreas:** Backend, Database, Testing.

### BARBER-11 — Dashboard operacional

- **Objetivo/descrição:** apresentar próximos atendimentos e agregados operacionais reais.
- **Subtasks:** definir agregados; endpoint tenant-aware; componentes e estados vazios/erro/loading; aplicar projeções de cliente autorizadas.
- **Aceitação:** dados reais apenas; “hoje” no timezone da organização; não vaza ficha geral do cliente; leitura respeita permissões e marcações removidas pela exclusão profissional não reaparecem.
- **Dependências:** BARBER-09. **Prioridade:** P1. **Estimativa:** 3 pontos. **Áreas:** Backend, Frontend, Testing.

### BARBER-12 — E2E, segurança e documentação da Sprint 5

- **Objetivo/descrição:** validar fluxos operacionais integrados e documentar comportamento real.
- **Subtasks:** E2E de horário/exceção/marcação/cancelamento; concorrência e tenant; permissões criador/profissional; caso de exclusão Owner-only e preservação de clientes quando o mecanismo for implementado; revisão de documentação.
- **Aceitação:** cadeia E2E e isolamento comprovados em DB de teste; Owner exclui profissional em transação, Admin é recusado, marcações/histórico operacional ligados são removidos e clientes/dados pessoais ficam intactos sem cascata; documentação não declara como feito o que ainda não está desenvolvido.
- **Dependências:** BARBER-07 a BARBER-11 e mecanismo de exclusão implementado sob BARBER-03/migration. **Prioridade:** P0. **Estimativa:** 5 pontos. **Áreas:** Backend, Frontend, Database, Testing, Infrastructure, Documentation.

**Estimativa Sprint 5:** 32 pontos, provisória; rever BARBER-09/10 após decisões temporais e de concorrência.

## 8. Testes e segurança E2E

Cobertura Sprint 4: guards e permissões por entidade; validação tenant por ID; migração/rollback/constraints; profissional com e sem conta; autoassociação de cliente; duplicados; gestão administrativa de atribuições; Member sem autorização não altera associação; saída de Member remove associação e preserva profissional/dados; serviços N:N e projeção contextual.

Cobertura Sprint 5: timezone/DST, intervalos/pausas, exceções, profissional escolhido elegível ao serviço, criador distinto do profissional, privilégios de ambos, visibilidade contextual do cliente, snapshots, transições/cancelamento, conflitos e corrida PostgreSQL. Quando exclusão profissional for implementada, testar atomicidade/falha parcial, Owner permitido, Admin recusado, todas as dependências operacionais eliminadas, clientes integralmente preservados e ausência de cascata cliente.

### Segurança da base E2E — questão anterior não resolvida

Erro de validação E2E anteriormente observado: `POSTGRES_DB deve terminar em _test no ambiente de testes.` Não declarar este problema corrigido. A validação atual exige host loopback e nome de DB terminado em `_test` em `NODE_ENV=test`. O Compose confirma serviço isolado `postgres-test`, bind loopback `127.0.0.1:5433`, credenciais `saas_test`/`saas_test_password`, DB `saas_auth_test` e armazenamento temporário; a base de desenvolvimento usa porta `5432`. O script real é `npm.cmd run test:e2e --workspace=apps/api`, que invoca Vitest E2E; a suite executa migrations por `runMigrations()`.

Antes da execução futura, definir no mesmo processo e verificar explicitamente:

```powershell
docker compose --profile test up -d postgres-test
$env:NODE_ENV = 'test'
$env:POSTGRES_HOST = '127.0.0.1'
$env:POSTGRES_PORT = '5433'
$env:POSTGRES_USER = 'saas_test'
$env:POSTGRES_PASSWORD = 'saas_test_password'
$env:POSTGRES_DB = 'saas_auth_test'
$env:FRONTEND_BASE_URL = 'http://localhost:3000'
$env:CORS_ORIGINS = 'http://localhost:3000'
$env:EMAIL_FROM = 'SaaS Platform <auth@example.test>'
npm.cmd run test:e2e --workspace=apps/api
```

Nunca apontar E2E/migrations para a base de desenvolvimento na porta 5432. A validação de sufixo `_test` não substitui verificar host, porta e DB dedicados. Se voltar a falhar, registar a configuração não secreta efetivamente recebida e o erro antes de propor correção. Testes E2E não foram executados nesta auditoria documental.

## 9. Decisões técnicas ainda pendentes

Não há regras de produto abaixo à espera de aprovação. São refinamentos técnicos, sem autorização para alterar o comportamento aprovado:

| Tema técnico                   | O que falta decidir na implementação                                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Associação profissional-Member | Cardinalidade, formato da relação, auditoria e transação de remoção ao sair Member                                                                                                                               |
| Conta opcional do profissional | Constraint/FK apropriada entre profissional, User e organização, preservando a diferença entre conta e atribuição administrativa                                                                                 |
| Exclusão profissional          | Nulabilidade/referência da associação cliente-profissional, FKs, ordem concreta e transação atómica; o resultado obrigatório é eliminar dados operacionais e preservar clientes, sem preservar marcações ligadas |
| Perfil e formulários           | Campos exatos, evitando duplicação desnecessária da Organization                                                                                                                                                 |
| Retenção de clientes/serviços  | Prazo e política legal/operacional antes de produção; sem alterar a exceção aprovada de exclusão de profissional                                                                                                 |
| Horários                       | Semântica de intervalos, limites, pausas, antecedência e marcações no passado                                                                                                                                    |
| Conflitos                      | Estratégia PostgreSQL (constraint/locking/transação), buffers e estados que ocupam intervalo                                                                                                                     |
| E2E                            | Causa da variável efetivamente recebida na falha anterior e evidência de execução posterior contra a DB dedicada                                                                                                 |

## 10. Definition of Done

### Sprint 4

- Acesso backend exige membership, organização ativa, módulo ativo e permissão apropriada.
- Perfil de negócio só pode ser criado/editado por Owner/Admin; perfil próprio e profissionais explicitamente atribuídos respeitam regras Member; profissionais sem conta funcionam.
- Somente Owner/Admin alteram associações profissional-Member e serviço-profissional; saída Member remove a associação administrativa sem apagar profissional/dados.
- Serviços mantêm N:N explícito; clientes duplicados são aceites e autoassociados pelo backend na criação Member; Member não consulta/edita fichas alheias.
- Migrations/constraints impedem referências cross-tenant e deleções destrutivas não aprovadas; sem uploads/descoberta pública.
- Testes backend cobrem matriz e dados; E2E só declarado funcional após evidência em PostgreSQL de teste isolado.

### Sprint 5

- Horários e exceções respeitam profissional, atribuição, timezone e DST.
- Marcação separa criador e profissional; escolha do cliente é limitada às opções disponibilizadas no serviço; criador e profissional podem gerir de acordo com autorização.
- Member vê nome/contacto/serviço no contexto das marcações permitidas, sem acesso geral à ficha de cliente; snapshots e estados aprovados funcionam.
- Conflitos concorrentes são impedidos na API/DB e demonstrados em PostgreSQL real.
- Exclusão profissional é Owner-only e transacional; apaga profissional e dados operacionais associados, incluindo marcações/histórico, preserva clientes e dados pessoais integralmente e remove associações sem cascata para cliente.
- Dashboard, E2E, isolamento, documentação e verificações de qualidade refletem comportamento observado; erro E2E anterior não é declarado resolvido sem evidência.

## 11. Registo da auditoria

Este plano orienta trabalho futuro; não afirma que funcionalidade, exclusão ou E2E estejam implementados. A exclusão profissional aprovada apaga os dados operacionais associados e marcações, mas preserva clientes. A saída de Member remove apenas a relação administrativa e preserva profissional/dados. São fluxos distintos. Detalhes de schema/transação permanecem técnicos e não alteram estes resultados. Apenas este documento está no âmbito de edição desta auditoria.
