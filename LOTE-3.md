# Lote 3: log de atividades (branch `lote-3`)

Nada desta branch foi implantado. A build 133 do TestFlight depende da `main` e das regras atuais.

## Ordem de implantação (só com autorização por escrito)

1. **Índices** (`firebase deploy --only firestore:indexes`): `atividades (atorUid, em desc)`, `(acao, em desc)`, `(alvoId, em desc)`. Esperar o status "Pronto" no console antes de usar a tela. A combinação de filtros depende do merge de índices do Firestore; se o console pedir um composto (ex.: `acao + alvoId + em`), criar pelo link do erro.
2. **Regras** (`firebase deploy --only firestore:rules`): só adiciona `match /atividades`. Nenhuma outra regra exige o log, então a build 133 continua funcionando.
3. **API** (merge na `main` -> deploy da Vercel): o servidor passa a gravar usuário criado/removido, vínculo de condomínio, pagamento (webhook, mesma transação) e consulta de status. Se a coleção/regras ainda não existirem, o Admin SDK grava do mesmo jeito (ele ignora regras); o log só não aparece na tela antes dos índices.
4. **App** (merge na `main` -> build do TestFlight): grava login de admin, preço e status de agendamento pelo cliente.

## Pendência: apertar as regras depois

Quando o app novo estiver na loja e a build 133 sair de circulação, trocar as regras de **status de agendamento** e **preço de serviço** para exigir o log no mesmo batch (`existsAfter` da `atividades` correspondente). Hoje isso NÃO é exigido de propósito.

## Limites conhecidos

- Admin SDK ignora regras: a imutabilidade contra o servidor é de convenção (nenhum código faz update/delete em `atividades`).
- Log de preço, status e login vem do app e só existe se o app o gravar (melhor esforço, forjável pelo próprio autor como ele mesmo).
- Sem encadeamento por hash (decisão do lote).
- `papel_alterado` está na lista de ações, mas não existe fluxo que mude papel hoje.

---

# Lote 4: custos e dashboard (branch `lote-4`, a partir de `lote-3`)

Nada implantado. Compatível com a build 133 (nenhuma regra nova exige o log; `custos` e o dashboard são só do admin).

## Índices necessários (arquivo `firestore.indexes.json`; sem deploy)

| Coleção | Campos | Usado por |
|---|---|---|
| `atividades` | `atorUid asc, em desc` | filtro por usuário (lote 3) |
| `atividades` | `acao asc, em desc` | filtro por ação (lote 3) |
| `atividades` | `alvoId asc, em desc` | filtro por alvo (lote 3) |
| `agendamentos` | `pagamento.status asc, pagamento.pagoEm asc, total asc` | faturamento (`sum`) do dashboard |

Já existentes e reaproveitados: `agendamentos (status, inicio desc)` para as contagens por status. `custos` ordena por `competencia` (índice automático de um campo). O emulador não valida índices: confirmar no console depois de criar (status "Pronto") e abrir o dashboard.

## Ordem de implantação (só com autorização por escrito)

1. **Índices**, esperar "Pronto".
2. **Regras** (`custos`, log de custo e `atividades`).
3. **API** (lote 3: log no servidor). O dashboard e os custos não dependem da API.
4. **App** (build nova do TestFlight): telas `/admin/custos`, `/admin/dashboard`, `/admin/atividades`.

## Regras do faturamento

Só `pagamento.status == 'pago'`, pela data `pagoEm`. `pago_apos_cancelamento` e `divergente` ficam de fora (em revisão). Rentabilidade = faturamento menos custos por competência (meses do período). Custo recorrente conta uma vez por mês, do início ao fim (ou sem fim), sem copiar documento.

## Custo de leitura (fase 1)

- Cartões do topo (hoje, em atendimento, aguardando pagamento, próximo): sobre o que o app já escuta, 0 leituras extras.
- Usuários (4 `count`), agendamentos por status (4 `count`), faturamento (1 `sum`+`count`): poucas leituras cobradas por consulta.
- Custos: lê a lista de custos (até 500 documentos) por atualização.
- Ranking de serviços e desempenho por funcionário: só ao clicar em "Carregar detalhes" (até 500 agendamentos do período).
- Últimas movimentações: 20 documentos de `atividades`.
