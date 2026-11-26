# Barber — Sprint 5

## Implementado

- Horários semanais da barbearia e de cada profissional, com zero ou mais períodos por dia. Períodos sobrepostos ou invertidos são recusados.
- Disponibilidade calculada a partir dos horários gerais e individuais, serviço e profissional ativos, associação serviço-profissional, indisponibilidades e marcações `PENDING`/`CONFIRMED`.
- Exceções organizacionais ou de profissional com tipo, motivo e intervalo. Um conflito devolve `409` com as marcações afetadas; nenhuma marcação é apagada ou alterada implicitamente.
- Criação e reagendamento de marcações, ciclo `PENDING` → `CONFIRMED` → `COMPLETED`, cancelamento a partir de pendente/confirmada e histórico preservado.
- Snapshots de nome/preço/duração do serviço, nome do profissional e nome/contacto do cliente.
- Painel com contagens do dia organizacional, próximas marcações e agenda diária com filtros por profissional, cliente e estado.

## API

Todas as rotas ficam sob `/organizations/:slug/barber` e herdam os guards de organização, membership, módulo Barber ativo e permissão do módulo.

| Método           | Rota                                             | Finalidade                                                                                           |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `GET` / `PUT`    | `/working-hours`                                 | Consultar períodos; substituir os períodos gerais ou de um profissional (`professionalId` opcional). |
| `GET`            | `/availability?serviceId=&date=&professionalId=` | Consultar slots locais de 15 minutos; `excludingAppointmentId` é usado no reagendamento.             |
| `GET` / `POST`   | `/availability-exceptions`                       | Listar e criar folgas, férias, ausências, compromissos e bloqueios.                                  |
| `PUT` / `DELETE` | `/availability-exceptions/:id`                   | Editar ou remover uma exceção.                                                                       |
| `GET`            | `/appointments`                                  | Filtrar por dia local, intervalo ISO, profissional, cliente e estado.                                |
| `GET`            | `/appointments/:id`                              | Consultar uma marcação do tenant.                                                                    |
| `POST` / `PUT`   | `/appointments` / `/appointments/:id`            | Criar ou reagendar; todos os dados e disponibilidade são validados no servidor.                      |
| `PATCH`          | `/appointments/:id/status`                       | Confirmar, concluir ou cancelar conforme as transições permitidas.                                   |
| `GET`            | `/dashboard`                                     | Contagens do dia e próximas marcações no timezone da organização.                                    |

### Permissões e tenant

Owner/Admin podem gerir horários gerais e de todos os profissionais. Member precisa de `barber:write` e só pode editar horários/exceções do profissional próprio ou atribuído. Só Owner/Admin podem gerir indisponibilidade geral da barbearia. A consulta de agenda é limitada ao tenant validado pelo guard; cada alteração por ID volta a consultar com `organizationId`. Members só podem criar marcações para clientes da sua carteira e não podem mudar a marcação para outro profissional.

### Datas e conflitos

Horários recorrentes são horas civis no timezone do perfil organizacional (padrão `Europe/Lisbon`). O backend converte a data/hora local em instante usando `Intl` e rejeita horários inexistentes ou ambíguos em transições DST. As marcações guardam `timestamptz` UTC. Intervalos são semiabertos (`início <= instante < fim`), permitindo marcações adjacentes.

Criação, reagendamento, transição de estado e mutação de exceções usam transação PostgreSQL e lock advisory transacional por organização. A disponibilidade é revalidada depois do lock, antes do `save()`, e verifica sobreposição com `starts_at < novo_fim AND ends_at > novo_início`; canceladas e concluídas não bloqueiam slots. O mecanismo serializa alterações do calendário da mesma organização; uma requisição incompatível recebe `409`.

## Banco de dados

A migration `1763800000000-CreateBarberScheduling` cria `barber_working_hours`, `barber_availability_exceptions` e `barber_appointments`, com índices tenant-scoped, constraints de intervalo/estado e FKs compostas que exigem que profissional, serviço e cliente pertençam à mesma organização. Os snapshots preservam o histórico quando o catálogo é alterado. A exclusão de profissional segue a regra existente da Sprint 4: apaga dados operacionais e marcações associadas, preservando os registos de clientes e removendo apenas a respetiva associação profissional.

## Testar

Os testes E2E são destrutivos apenas para o serviço `postgres-test` definido em `compose.yaml` (`127.0.0.1:5433`, base `saas_auth_test`, volume temporário). Configure `NODE_ENV=test`, `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5433`, `POSTGRES_USER=saas_test`, `POSTGRES_PASSWORD=saas_test_password` e `POSTGRES_DB=saas_auth_test`. A validação da API recusa host não-loopback e nome de base que não termine em `_test`.

```powershell
docker compose --profile test up -d postgres-test
$env:NODE_ENV = 'test'
$env:POSTGRES_HOST = '127.0.0.1'
$env:POSTGRES_PORT = '5433'
$env:POSTGRES_USER = 'saas_test'
$env:POSTGRES_PASSWORD = 'saas_test_password'
$env:POSTGRES_DB = 'saas_auth_test'
npm run test:e2e --workspace=api
```

Não execute a suíte E2E com o `.env` de desenvolvimento sem substituir explicitamente todas as cinco variáveis PostgreSQL pelos valores do serviço de teste.
