# Lote 6: reservar o horário pela duração do serviço (item 2, fase 1)

## O que mudou

- **API nova** `POST /api/agendamentos/criar` (`api-vercel/_lib/agendamento.js`): numa transação do Admin SDK cria o
  agendamento e uma vaga de `ocupacao` para cada fatia de 30 min que a duração cobre (90 min às 09:00 = 09:00, 09:30, 10:00).
  Preço, nome, categoria e duração vêm de `servicos/*`; o condomínio e o papel vêm de `users/{uid}`.
  Capacidade: `condominios/{id}.capacidade` (regular) ou `config/insulfilm.capacidade` (externo).
  Idempotente pela `chave` (id do agendamento = hash(uid + chave)).
- **Compatível com o que já existe**: mesmos ids de vaga (`{cond}_{data}_{hora}_{n}` / `ext_...`), mesmo formato de
  agendamento (`vagaId` = vaga do horário inicial) mais dois campos opcionais: `vagasIds` e `duracaoMin`.
  Reservas feitas por builds antigas (1 vaga, direto no Firestore) são respeitadas pela API.
  Vaga que sobrou de agendamento cancelado conta como livre (a API a sobrescreve).
- **App**: a tela de agendar usa a API, mostra só inícios cujos horários de 30 min estão todos livres, usa chave de
  idempotência e tem estados carregando / sem vaga / erro. `cancelar` apaga todas as vagas (`vagasIds`).
- **Sem plano B pelo Firestore**: ver "Decisão" abaixo.

## Decisão: o app NÃO cai no caminho antigo se a API falhar

Se a resposta se perdeu (timeout), a reserva pode já existir: um plano B direto no Firestore a duplicaria. Além disso o
caminho antigo seguraria só 1 horário num serviço longo. O app repete a chamada com a MESMA chave (o servidor devolve a
mesma reserva) e mostra o erro. As builds antigas continuam usando o caminho antigo enquanto as regras permitirem.

## Índices e regras

- **Índices**: nenhum novo (a API só lê documentos por id).
- **Regras**: nenhuma mudança agora. As regras de `create` em `agendamentos` e `ocupacao` ficam como estão para as builds
  instaladas.
- **Pendência (depois que o app novo estiver na loja)**: fechar `create` de `agendamentos` e `ocupacao` para o cliente
  (`allow create: if false`), mantendo `delete` de `ocupacao` (o cancelamento do app apaga cada vaga) e o `update` de
  `agendamentos` do cancelamento/avaliação. Com isso só a API cria reservas. Atualizar `firestore-tests/regras.test.ts`.

## Pré-requisito de deploy: webhook do pagamento libera só uma vaga

`api-vercel/_lib/webhook-asaas.js` (CHECKOUT_EXPIRED/CANCELED) apaga só `ocupacao/{vagaId}`. Para reservas novas isso
deixa as outras vagas presas. Não alterei o pagamento (fora do escopo do lote). Mitigação já presente: a API trata vaga de
agendamento `cancelado` como livre. Falta: (a) o webhook apagar também `vagasIds` e (b) a grade do app (que só conta
documentos) ainda mostraria esses horários como cheios até lá. Recomendado fazer (a) antes de liberar o app novo.

## Passos de implantação, em ordem

1. Mesclar `lote-6` na `main` (depois da autorização) e fazer o deploy da API (Vercel cria o endpoint novo).
2. (Recomendado) ajustar o webhook para liberar `vagasIds` e fazer o deploy da API de novo.
3. Conferir o endpoint com um agendamento de teste (serviço de 90 min): devem nascer 3 documentos em `ocupacao`.
4. Publicar o app novo (build com a tela de agendar nova). As builds antigas continuam funcionando.
5. Esperar a adoção do app novo; só então fechar `create` de `agendamentos`/`ocupacao` nas regras e implantar
   (`firebase deploy --only firestore:rules`).

## O que o cliente vê de diferente

Menos horários livres para serviços longos: um início só aparece se todos os horários de 30 min que o serviço precisa
estão livres. Em condomínio com capacidade 1, um serviço de 90 min às 09:00 passa a bloquear 09:00, 09:30 e 10:00.
O "preparo" (`BUFFER_MIN`) continua só informativo: não reserva horário.
