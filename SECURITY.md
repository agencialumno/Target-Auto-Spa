# Segurança: Target Auto Spa

Relatório da auditoria de 2026-10-29 e política para quem encontrar uma vulnerabilidade.

**Como reportar:** não abra issue pública. Use "Report a vulnerability" na aba Security do GitHub
ou escreva para o responsável do projeto.

## Resumo

| Área | Estado |
|---|---|
| Segredos no histórico (gitleaks, 34 commits) | Limpo. Único alerta: a `apiKey` do Firebase (pública por design), liberada em `.gitleaks.toml` |
| Dependências npm (app, produção) | 4 "high" restantes, todos da mesma cadeia `@grpc/grpc-js` dentro de `firebase`, sem correção publicada e não explorável aqui (ver A1) |
| Dependências npm (`api-vercel`, `scripts/contas-teste`) | 0 vulnerabilidades (firebase-admin 13 para 14.5) |
| Cargo (Tauri) | 7 avisos RustSec/GHSA, nenhum aplicável aos alvos iOS/Android (ver A3) |
| Regras do Firestore | Reescritas e testadas (60 testes no emulador). **Ainda não publicadas: ação sua** |
| API da Vercel | Endurecida (CORS, validação, limite por IP, erros genéricos), 19 testes |
| CSP do app | Definida. **Precisa ser testada no TestFlight** |
| Workflows | Actions fixadas por SHA, `GITHUB_TOKEN` somente leitura, `.ipa` não é mais publicado como artifact |
| Conta `adm@target.com` | Senha fraca: **ação sua** (seção E) |

## A. Vulnerabilidades conhecidas

Ferramentas: `npm audit`, `osv-scanner` 2.7.0 (base OSV: CVE, GHSA, RustSec) sobre os 4 lockfiles, `gitleaks` 8.30.1.
`cargo audit` não foi usado: o `osv-scanner` consulta a mesma base RustSec sobre o `Cargo.lock`.

### A1. `@grpc/grpc-js` 1.9.16 via `firebase` (npm, app): GHSA-m9gg-hp2v-232j (7.4), GHSA-f596-whhp-79r4 (3.7)
- **Severidade:** alta segundo o `npm audit`, não explorável aqui.
- **Por que não corrige:** o `firebase` mais recente (13.1.0, `@firebase/firestore` 4.19.0) ainda fixa `@grpc/grpc-js ~1.9.0`. A sugestão do `npm audit` de "baixar para firebase 9.14.0" é um downgrade e **não foi aplicada**.
- **Por que não é explorável:** o `grpc-js` só é usado pela versão Node do Firestore. O app roda num WebView e usa a versão de navegador (fetch/WebChannel). O bundle de produção (`build/`) não contém código do `grpc-js`, só o nome de uma opção de configuração. As falhas são de servidor gRPC e de contexto de certificados mTLS, que o app não usa.
- **O que fazer:** o Dependabot abrirá o PR quando o Firebase liberar a correção.

### A2. SvelteKit 2.70.3, `cookie`, `deepmerge` (npm, dev): GHSA-pfhg-q3qv-9q6r, GHSA-27mw-82g8-phjj, GHSA-pxg6-pf52-xh8x, GHSA-gcqx-w48m-w2h4
- **Severidade:** baixa. São falhas do servidor SvelteKit (redirecionamento, cabeçalho `cache-control`, cookies).
- **Por que não é explorável:** o app usa `adapter-static` (HTML e JS estáticos dentro do app). Não existe servidor SvelteKit em produção, e essas bibliotecas só rodam em desenvolvimento e no build.
- **O que fazer:** a correção exige o SvelteKit 3 (versão maior). Avaliar a migração com calma, depois de uma rodada de testes no aparelho.

### A3. Cargo (Tauri): 7 avisos
| Pacote | Aviso | Aplica ao app? |
|---|---|---|
| `glib` 0.18.5 | RUSTSEC-2024-0429 (6.9) | Não: só Linux (GTK); ausente em iOS, Android e Windows (`cargo tree --target` confirma) |
| `zbus_names`, `zvariant`, `zvariant_derive` | RUSTSEC-2026-0370, 0371, 0372 | Não: só Linux (D-Bus), ausentes nos mesmos alvos |
| `proc-macro-error` 1.0.4 | RUSTSEC-2024-0370 (sem manutenção) | Não: só Linux, e é dependência de compilação |
| `block-buffer` 0.10.4 | GHSA-qwgh-2vcv-g2f7 (6.3) | Presente em todos os alvos, mas exige capturar um *panic* e continuar usando o buffer. O release usa `panic = "abort"`, então não há esse estado. Sem versão corrigida |

Atualizar o `Cargo.lock` quando o Tauri liberar versões novas (Dependabot cobre `src-tauri`).
`Cargo.lock` não é versionado no repositório; os builds resolvem as versões mais recentes compatíveis.

### A4. Corrigido
- `npm audit fix` (sem `--force`): `vite`, `sharp`, `re2js`, `source-map-js` (altas).
- `firebase-admin` 13 para 14.5.0 em `api-vercel` e `scripts/contas-teste` (resolve `uuid` GHSA-w5hq-g745-h8pq). Testes passam e o import funciona. Não testado contra o Firebase real.

### A5. Dependências nativas geradas (Gradle, Swift Package): não auditadas
`src-tauri/gen/` não é versionado (é gerado a cada build no CI) e não existe nesta máquina, então o osv-scanner não o enxerga.
O plugin Swift da Apple tem só a dependência `Tauri`. Para cobrir o Gradle, rode `osv-scanner scan source src-tauri/gen/android` num job do CI depois do `tauri android init`. Não implementado.

### A6. Dependabot e actions
- `.github/dependabot.yml`: npm (`/`, `/api-vercel`, `/scripts/contas-teste`), cargo (`/src-tauri`), github-actions.
- Todas as actions dos workflows estão fixadas por SHA de commit (com o comentário da versão).

## B. Regras do Firestore (`firestore.rules`)

Revisão linha a linha. Testes: `npm run test:rules` (emulador, 60 testes: anônimo, cliente, gerente, admin e insulfilm contra cada coleção, leituras e escritas permitidas e negadas).

| # | Achado | Severidade | Correção |
|---|---|---|---|
| B1 | **Chats**: `allow read, create: if logado()`: qualquer usuário logado lia e escrevia em qualquer conversa | Alta | Só o dono (`chatId` = uid do cliente), o gerente do condomínio dele e o admin. Mensagem validada: lado (`de`) coerente com quem escreve, texto de 1 a 2000 caracteres, sem campos extras; só `lida` pode ser atualizada; ninguém apaga |
| B2 | **`condominioId` editável**: o usuário podia se mudar para qualquer condomínio (aparecer para outro gerente, criar agendamentos lá) | Média | Só pode sair de `null` para um condomínio que **existe**, uma única vez. Depois disso só o console/API admin altera |
| B3 | **`null == null`**: um gerente sem `condominioId` passava na checagem de qualquer agendamento sem condomínio | Média | Todas as checagens de gerente exigem `condominioId != null` |
| B4 | **Agendamentos**: o cliente podia criar em nome de outro condomínio, criar já "finalizado" (subir de nível/desconto) ou editar qualquer campo | Média | Criação: dono, condomínio do próprio perfil, status "agendado". Cliente só atualiza `avaliacao`. Gerente não troca dono nem condomínio |
| B5 | **Cadastro**: aceitava qualquer campo extra e nome sem limite | Baixa | Só `nome`, `email`, `role`, `condominioId`; role sempre `cliente`, condomínio `null`, tamanhos limitados |
| B6 | Edição do próprio perfil | Baixa | Só `nome` e a entrada no condomínio. `role` e `email` imutáveis; ninguém apaga perfil |
| B7 | Papel `insulfilm` | Info | Sem acesso a agendamentos até a agenda dele ser migrada (decisão registrada nos testes) |
| B8 | Negar tudo o mais | Info | Mantido o `match /{document=**}` com `false` |

**Mudança de comportamento no app:** como B2 exige condomínio existente, **removi o desvio temporário** "qualquer nome de condomínio" de `entrarNoCondominio`. A tela volta a mostrar "Condomínio não encontrado" para nomes que não estão em `condominios`. Os condomínios passam a ser cadastrados por você no console (campos `nome` e `nomeNormalizado` em minúsculas).

**Ação sua, publicar as regras (não publiquei, é um recurso compartilhado):**
1. Crie antes pelo menos um documento em `condominios` (id livre, ex.: `condominio-teste`, campos `nome` e `nomeNormalizado`).
2. `firebase deploy --only firestore:rules` (a partir de `target-auto-spa/`).
3. Teste: cadastro, entrar no condomínio, login, login com Apple.
4. Reverter, se preciso: `git revert` do commit das regras e novo deploy.

## C. API da Vercel (`api-vercel`)

| # | Item | Estado |
|---|---|---|
| C1 | CORS | Só `tauri://localhost` e `(http/https)://tauri.localhost`; `localhost` de desenvolvimento só fora de produção. Origem não permitida recebe 403 também no POST (mesmo com token válido). Sem `Origin` (cliente nativo) segue para a autenticação |
| C2 | Validação de entrada | Corpo objeto; nome até 100; e-mail até 254 e formato; senha até 128 e forte; papel da lista; `condominioId` só `[A-Za-z0-9_-]` até 100; `uid` só alfanumérico até 128; `Content-Type` JSON; corpo até 4 KB |
| C3 | Limite por IP | 20 requisições por minuto por IP (429 + `Retry-After`), em memória por instância. **Não é global**: serve contra abuso simples; o limite forte deve ser regra do Firewall da Vercel (ação sua) |
| C4 | Erros | Mensagens genéricas; o detalhe interno nunca vai na resposta (só o nome do erro no log). 401 sem pista sobre o motivo; 403 igual para "não admin" e "sem perfil" |
| C5 | Cabeçalhos | `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` |
| C6 | Autenticação | `verifyIdToken(token, true)` (confere revogação) e papel lido do Firestore. Nunca confia em dado do cliente |
| C7 | Testes | 19 (`npm test` em `api-vercel/`): token ausente, formato errado, inválido, não admin e admin; CORS; validação; 429; erro interno sem vazamento |

**Proteção SSO da Vercel desligada.** Está desligada porque o app precisa chamar a API e não consegue fazer login na Vercel. O que dá para fazer a mais:
- **Firewall da Vercel** (Projeto, Firewall): regra de rate limit por IP para `/api/usuarios/*` (ex.: 10 por minuto) e, se houver ataque, Attack Challenge Mode.
- **Segredo compartilhado no app não ajuda**: o app é público, o segredo seria extraído.
- **App Check** do Firebase (atestação do app) não tem suporte oficial no Tauri. Não implementado.
- A defesa real continua sendo o ID token de admin validado no servidor, o limite por IP e as validações.
- Marque `FIREBASE_SERVICE_ACCOUNT_BASE64` como **Sensitive** e use uma service account só com os papéis necessários (Firebase Authentication Admin e Cloud Datastore User), não a de Owner.

## D. App e CI

| # | Achado | Severidade | Correção |
|---|---|---|---|
| D1 | CSP `null` | Média | CSP definida em `tauri.conf.json`: `default-src 'self'`, `script-src 'self'`, `connect-src` só para IPC, Firebase Auth/Firestore/Storage e a API da Vercel, `object-src 'none'`, `frame-src 'none'`. **Não testei no aparelho**; se o login ou a tela de admin falharem depois deste build, o primeiro suspeito é a CSP (veja o console do WebView ou ligue `DEPURACAO`) |
| D2 | Dados no `localStorage` | Baixa | Nenhum token nem senha é gravado por nosso código. O `localStorage` guarda dados de demonstração (agendamentos, placa, fotos do veículo em base64) sem criptografia e sem dono. Agora são apagados ao sair da conta. Quando os agendamentos forem para o Firestore, remover o armazenamento local. O Firebase Auth guarda a sessão no IndexedDB do WebView, o padrão do SDK |
| D3 | `.ipa` publicado como artifact | Média | Removido. Os ícones extraídos do `.ipa` também. O `.aab` continua como artifact (necessário para o envio manual à Play Store), com retenção de 3 dias |
| D4 | `GITHUB_TOKEN` | Média | Todos os workflows com `permissions: contents: read` e `persist-credentials: false` no checkout. Nenhum usa `pull_request_target` |
| D5 | Actions por tag | Média | Fixadas por SHA |
| D6 | Testes e segredos no CI | Info | Novo `testes.yml`: testes do app, regras no emulador, API e gitleaks (versão fixa, checksum verificado) |
| D7 | Segredos no histórico | Info | gitleaks: nenhuma ocorrência além da `apiKey` pública do Firebase (liberada em `.gitleaks.toml`) |
| D8 | Logs antigos do Actions | Baixa | Estão públicos agora. Mostram o nome da identidade de assinatura. Apague os runs antigos se isso incomodar |
| D9 | Não verificado | Info | Configurações do template Android gerado (ex.: `allowBackup`), pois `gen/` só existe no CI |

## E. Conta `adm@target.com` (senha fraca): o que fazer

Não alterei a conta. Duas opções, da melhor para a pior:
1. **Trocar a senha por uma forte e usar um e-mail seu de verdade.** Rode (com as credenciais do Google já configuradas na máquina e `GOOGLE_CLOUD_QUOTA_PROJECT=target-auto-spa-33842`):
   `node scripts/contas-teste/criar-conta-avulsa.mjs --email adm@target.com --senha "<SENHA-FORTE>" --role admin`
   O script é idempotente: se a conta existe, só redefine a senha. O Console do Firebase não permite definir senha manualmente; a redefinição por e-mail não funciona se `adm@target.com` não tiver caixa de entrada.
2. **Apagar a conta** depois dos testes: Firebase, Authentication, Users, apagar; e apagar o documento em `users/{uid}`.

Depois de trocar a senha, revogue as sessões ativas (Admin SDK: `auth.revokeRefreshTokens(uid)`) e **nunca grave a senha no repositório, que é público**.
Rotina recomendada: um único admin real com e-mail verdadeiro e senha forte, e as contas de teste apagadas antes de publicar.

## O que depende de ação sua

**Firebase (console):**
- Publicar as regras (seção B) depois de criar um documento em `condominios`.
- Registrar o app iOS `br.com.lumno.targetautospa` (corrige o login com Apple).
- Authentication: ativar a proteção contra enumeração de e-mails e a política de senha (8+, maiúscula, minúscula, número, especial). Hoje a regra de senha forte só vale no app, não no servidor.
- Apagar ou trocar as contas de teste.

**Google Cloud (console.cloud.google.com, projeto `target-auto-spa-33842`):**
- APIs e serviços, Credenciais: **restringir a chave de API** do Firebase (só as APIs do Firebase usadas; restrição de aplicativo iOS pelo bundle ID quando o app iOS estiver registrado).
- Revogar a chave da service account depois de configurar a Vercel e guardar só a variável de ambiente.
- Se não precisar mais, `gcloud auth application-default revoke` nesta máquina (as credenciais foram usadas para criar a conta de admin).

**GitHub (Settings do repositório):**
- Code security: ativar **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** com **Push protection** e **CodeQL** (configuração padrão). São grátis em repositório público.
- Branches: proteger a `main` (exigir PR e o job "Testes").
- Actions, General: permissões padrão do workflow "Read repository contents"; exigir aprovação para workflows de colaboradores externos.
- Conta: autenticação em dois fatores.
- Apagar runs antigos do Actions, se o conteúdo dos logs incomodar.

**Vercel:**
- Definir `FIREBASE_SERVICE_ACCOUNT_BASE64` (Sensitive) e fazer redeploy.
- Criar a regra de rate limit no Firewall para `/api/usuarios/*`.

**Apple:** nada novo além do registro do app no Firebase.
