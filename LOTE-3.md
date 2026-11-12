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
