# Fluxo de trabalho Git

Este documento define como a equipa gere branches, Pull Requests (PRs), promoção para produção e rollback no SaaS Platform.

## Branches permanentes

- `main` contém a versão estável em produção. Só recebe alterações através de PR aprovado.
- `develop` é a branch de integração e testes. Recebe funcionalidades e correções normais através de PR e serve de origem para a promoção de versões para `main`.

É regra da equipa não fazer commits diretamente em `main` nem em `develop`. Todas as alterações devem ser propostas e revistas através de PR.

## Convenções de branches

Usar um identificador curto ou uma descrição em minúsculas, com palavras separadas por hífen:

- `new-features/<identificador-ou-descricao>` — novas funcionalidades e tarefas.
- `corrections/<identificador-ou-descricao>` — correções normais.
- `urgent-fixes-in-production/<identificador-ou-descricao>` — correções urgentes de produção (hotfixes).

Exemplos: `new-features/123-login` e `corrections/fix-timezone`.

### Origem e destino

- Branches `new-features/*` e `corrections/*` devem partir de `develop` e regressar a `develop` através de PR.
- Branches `urgent-fixes-in-production/*` devem partir de `main` e regressar a `main` através de PR. Depois de o hotfix ser integrado em `main`, deve também ser integrado em `develop` através de PR, para manter as branches sincronizadas.

## Criar e atualizar uma branch

Atualize a branch de origem antes de começar e crie a branch de trabalho a partir dela:

```bash
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c new-features/<identificador-ou-descricao>
```

Para um hotfix, substitua `develop` por `main` e use o prefixo `urgent-fixes-in-production/`.

Para atualizar uma branch de trabalho com alterações recentes da sua origem, integre a origem na branch de trabalho e resolva quaisquer conflitos antes de abrir ou atualizar o PR:

```bash
git fetch origin
git switch <branch-de-trabalho>
git merge origin/develop
```

Num hotfix, use `git merge origin/main` em vez de `origin/develop`. Execute os testes relevantes após a atualização.

## Pull Requests e revisão

1. Faça push da branch de trabalho para o repositório remoto.
2. Abra um PR para a branch de destino indicada acima. Preencha o [template de Pull Request](../.github/PULL_REQUEST_TEMPLATE.md), incluindo a tarefa ou ticket relacionado, testes, impactos e riscos.
3. Aguarde a revisão de outro membro da equipa. Responda aos comentários, faça as alterações na branch do PR e volte a pedir revisão.
4. Integre o PR apenas depois da aprovação e da resolução das conversas de revisão. Não contorne a revisão com commits diretos na branch de destino.
5. Após a integração, confirme que a alteração ficou na branch correta e que os testes relevantes continuam válidos.

## Resolução de conflitos

Resolva conflitos na branch do PR, nunca diretamente em `main` ou `develop`:

1. Atualize as referências remotas e integre a branch de destino na sua branch de trabalho.
2. Edite os ficheiros em conflito, preservando a intenção das alterações de ambas as branches.
3. Remova os marcadores de conflito, valide as alterações e execute os testes relevantes.
4. Registe a resolução na branch de trabalho e atualize o PR.
5. Se não for claro qual comportamento deve prevalecer, peça orientação aos autores das alterações antes de resolver o conflito.

## Promoção de `develop` para `main`

Quando o conjunto de alterações integrado em `develop` estiver revisto e testado, abra um PR de `develop` para `main`. O PR deve identificar as alterações incluídas e os resultados de validação. A equipa revê e aprova a promoção antes da integração e da publicação em produção. Não integre alterações não validadas nem faça commits diretos em `main`.

As verificações automáticas obrigatórias serão configuradas após a Tarefa 6. Até essa configuração, a equipa deve executar e registar manualmente as validações aplicáveis no PR.

## Rollback

Se uma publicação causar um problema, avalie o impacto e identifique uma reversão segura. Para reverter alterações de código, prepare uma branch de correção a partir da branch que contém a alteração, aplique uma reversão explícita (por exemplo, com `git revert`) e proponha-a através de PR para a branch de destino. Não reescreva o histórico de branches partilhadas.

Antes de executar um rollback em produção, valide a reversão num ambiente apropriado e confirme o comportamento da aplicação, os testes relevantes e o impacto nos dados. Em particular, avalie a compatibilidade das migrations e a necessidade de backup ou de um plano de recuperação da base de dados. Só avance para produção depois desta validação e da revisão necessária.
