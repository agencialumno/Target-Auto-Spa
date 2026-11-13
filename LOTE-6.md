# Lote 6: reservar o horário pela duração do serviço (item 2, fase 1)

## O que mudou

- **API nova** `POST /api/agendamentos/criar` (`api-vercel/_lib/agendamento.js`): numa transação do Admin SDK cria o
  agendamento e uma vaga de `ocupacao` para cada fatia de 30 min que a duração cobre (90 min às 09:00 = 09:00, 09:30, 10:00).
  Preço, nome, categoria e duração vêm de `servicos/*`; o condomínio e o papel vêm de `users/{uid}`.
  Capacidade: `condominios/{id}.capacidade` (regular) ou `config/insulfilm.capacidade` (externo).
  Idempotente pela `chave` (id do agendamento = hash(uid + chave)).
- **Webhook do Asaas** (`api-vercel/_lib/webhook-asaas.js`): expiração e cancelamento do Checkout liberam TODAS as vagas
  da reserva (`vagasIds`); reserva antiga libera a única (`vagaId`). A liberação acontece na mesma transação da mudança
  de status e da marca de evento processado (idempotência por id do evento). Só apaga a vaga que ainda é DESTE agendamento.
  Pago (ou pago com valor divergente) nunca libera vaga. Contrato mantido: depois do token, sempre 200; 5xx só em falha
  real de gravação.
- **Compatível com o que já existe**: mesmos ids de vaga (`{cond}_{data}_{hora}_{n}` / `ext_...`), mesmo formato de
  agendamento (`vagaId` = vaga do horário inicial) mais dois campos opcionais: `vagasIds` e `duracaoMin`.
  Reservas feitas por builds antigas (1 vaga, direto no Firestore) são respeitadas pela API.
  Vaga que sobrou de agendamento cancelado conta como livre (a API a sobrescreve).
- **App**: a tela de agendar usa a API, mostra só inícios cujos horários de 30 min estão todos livres, usa chave de
  idempotência e tem estados carregando / sem vaga / erro. `cancelar` apaga todas as vagas (`vagasIds`).

## Regra de horários: o que NÃO mudou (conferido contra a `main` antes do lote)

| Item | Antes do lote 6 | Agora (grade e API) |
|---|---|---|
| Passo dos horários de início | 30 min (`GRADE_MIN = 30`) | 30 min |
| Primeiro início / fim | 08:00; o serviço termina até 18:00 (duração sem o preparo) | igual |
| Antecedência (lavagem) | início depois de "agora" | igual |
| Janela | hoje + 13 dias (14 dias na grade) | igual (a API recusa além disso) |
| Insulfilm | 09:00, 11:00, 14:00, 16:00; 36 h de antecedência; sem limite de fechamento | igual |
| Preparo (`BUFFER_MIN` = 15) | só texto informativo | igual |

Atenção: o passo de 45 min citado na regra de negócio **não existia** no app: o passo sempre foi 30 min. O que a regra
descreve (30 min de lavagem + 15 de preparo = 45) é só o texto informativo. Se a intenção é ter início a cada 45 min,
é uma mudança nova (`GRADE_MIN` e a lista de horários) e não está neste lote.

O que mudou, de propósito: antes cada reserva segurava só o horário inicial; agora segura todos os de 30 min que a
duração cobre (30 min = 1 vaga, 45 min = 2, 90 min = 3). Um serviço de 45 min, por exemplo, segura 60 min na agenda.

## Decisão: o app NÃO cai no caminho antigo se a API falhar

Se a resposta se perdeu (timeout), a reserva pode já existir: um plano B direto no Firestore a duplicaria. Além disso o
caminho antigo seguraria só 1 horário num serviço longo. O app repete a chamada com a MESMA chave (o servidor devolve a
mesma reserva) e mostra o erro. As builds antigas continuam usando o caminho antigo enquanto as regras permitirem.

## Quem libera ou apaga `ocupacao` (levantamento)

| Lugar | Respeita `vagasIds`? |
|---|---|
| `app.cancelar` (cliente cancela, em `src/lib/app.svelte.ts`) | sim: apaga todas; reserva antiga: a única |
| Webhook do Asaas, expiração/cancelamento | sim (este lote) |
| Regras de `delete` de `ocupacao` | valem por documento (dono, gerente do condomínio ou admin, com o agendamento cancelado no mesmo batch): servem para todas as vagas |
| Gerente/funcionário/admin | a UI não cancela agendamento. Pelas regras o gerente pode cancelar (`agendado` -> `cancelado`): se um botão for criado, deve usar `app.cancelar` |
| Mudança de status no app (`avancarComRegras`: em andamento, finalizado) | não libera vaga (como antes: o histórico de ocupação fica) |
| `removerUsuario` (API) | não mexe em agendamentos nem em vagas (comportamento anterior; fica vaga órfã de reservas futuras de um usuário removido) |
| Scripts (`migrar-insulfilm`, `diagnostico-indices`) | só leem/alteram `users` |

## Índices e regras

- **Índices**: nenhum novo (a API só lê documentos por id).
- **Regras**: nenhuma mudança agora. As regras de `create` em `agendamentos` e `ocupacao` ficam como estão para as builds
  instaladas.
- **Pendência (depois que o app novo estiver na loja)**: fechar `create` de `agendamentos` e `ocupacao` para o cliente
  (`allow create: if false`), mantendo `delete` de `ocupacao` (o cancelamento do app apaga cada vaga) e o `update` de
  `agendamentos` do cancelamento/avaliação. Com isso só a API cria reservas. Atualizar `firestore-tests/regras.test.ts`.

## Passos de implantação, em ordem (um único deploy de API: endpoint novo + webhook)

1. Mesclar `lote-6` (que já contém o `lote-5`) na `main`, depois da autorização.
2. Deploy da API (Vercel): publica `/api/agendamentos/criar` e o webhook que libera `vagasIds`, juntos.
3. Conferir com um agendamento de teste de 90 min: devem nascer 3 documentos em `ocupacao`; deixar o pagamento expirar
   (ou cancelar o Checkout) e conferir que as 3 vagas somem e o agendamento fica `cancelado`.
4. Publicar o app novo (build com a tela de agendar nova). As builds antigas continuam funcionando.
5. Esperar a adoção do app novo; só então fechar `create` de `agendamentos`/`ocupacao` nas regras e implantar
   (`firebase deploy --only firestore:rules`).

## O que o cliente vê de diferente

Menos horários livres para serviços longos: um início só aparece se todos os horários de 30 min que o serviço precisa
estão livres. Em condomínio com capacidade 1, um serviço de 90 min às 09:00 passa a bloquear 09:00, 09:30 e 10:00.
