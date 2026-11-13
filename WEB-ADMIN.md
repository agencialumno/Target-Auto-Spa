# Versão web do admin (lote 7, item 6): desenho e estrutura mínima

Estado: **desenho + estrutura mínima** (build web com login e verificação de papel). Telas completas só depois do OK.
Nada foi publicado: sem deploy de API, regras ou índices.

## 1. Arquitetura

| | (a) Mesmo projeto, modo de build web | (b) Projeto separado |
|---|---|---|
| Reuso | Total: `$lib` (dados, regras puras, componentes, `auth`, `app`) é o mesmo código | Copiar ou publicar um pacote compartilhado; risco de divergir |
| Correções | Uma só vez | Duas vezes |
| Risco para o app | Baixo, se o modo web só ler uma variável de build (provado abaixo) | Nenhum |
| Custo | Um `svelte.config.js` com dois modos | Novo repositório, CI, dependências em dobro |

**Recomendação: (a).** Os dois builds compartilham `src/lib`; o que difere é só quais rotas entram e algumas trocas de módulo.

**Como funciona (já criado):**
- `npm run build:web` (`scripts/build-web.mjs`) roda o Vite com `BUILD_WEB_ADMIN=1`. Sem a variável, `svelte.config.js` e `vite.config.js` são os de sempre (`build/`, rotas de `src/routes`).
- Com a variável: `kit.files.routes = src/web/routes` (só as rotas web), saída em `build-web/`, CSP por hash (`kit.csp`) e alias de `@tauri-apps/api/core` para `src/web/tauri-stub.ts`.
- **Exclusão do que é só do celular:** as rotas `cliente`, `gerente`, `funcionario` e `entrar-condominio` não existem em `src/web/routes`, então não entram no bundle (conferido: nenhuma referência no `build-web`). O plugin do Tauri sai pelo alias (o `invoke` vira um stub que lança erro). Login nativo (Apple/Google nativo), câmera e checklist de fotos só são importados por rotas de celular e por métodos de `auth.svelte.ts` que o web não chama.
- **`/admin` como raiz:** a raiz `/` do web é a tela de login; depois do login vai para `/admin`. Cada tela do admin entra no web por um arquivo de uma linha em `src/web/routes/admin/...` que importa a página existente de `src/routes/admin/...` (sem copiar código). Se quiser a URL sem o prefixo (`admin.targetautospa.com.br/usuarios`), é um `reroute` do SvelteKit que tira o `/admin`; recomendo manter o prefixo: os links atuais já usam `/admin/...`.
- **O build do celular não mudou:** `firebase.ts` e `auth.svelte.ts` ficaram intactos; `svelte.config.js`/`vite.config.js` só mudam com a variável. A verificação final (build do app) está no relatório.

## 2. Login na web

- **Google:** popup (`signInWithPopup` com `browserPopupRedirectResolver` passado **na chamada**). O `auth` do app continua criado sem resolver (o WebView do Tauri trava com ele), então nada muda para o celular. Redirecionamento é pior (perde estado, problemas com cookies de terceiros); popup é o padrão. Código: `src/lib/web/auth-web.ts`.
- **E-mail e senha:** faz sentido como reserva (contas de admin já existem assim); reaproveita `authStore.entrar`. Recomendo exigir Google no início e ligar e-mail/senha só se houver necessidade (menos superfície de força bruta).
- **Só admin entra:** na tela de login, depois que o perfil carrega, `decidirAcesso` (`src/lib/web/acesso-admin.ts`) decide. Qualquer outro papel, ou Google sem cadastro (sem perfil), vê "Acesso negado" e é **desconectado** na hora. O web nunca cria perfil (não chama o cadastro).
- **Onde o papel é verificado (três camadas):**
  1. Cliente: `decidirAcesso` no login e `GuardaPapel papel="admin"` em todo `/admin` (já existe).
  2. **Regras do Firestore (a que vale):** `souAdmin()` lê `users/{uid}.role`. Um não-admin que burle o front não lê nem grava nada de admin.
  3. API: cada endpoint confere o papel no servidor.
- **Lista de e-mails de admin (camada extra):** `VITE_ADMIN_EMAILS` (separada por vírgula) restringe a tela, mas é visível no bundle e só ajuda na experiência. A versão forte é no servidor: **custom claim** `admin: true` definida por script com o Admin SDK, e as regras exigirem `request.auth.token.admin == true` além do papel (ou `request.auth.token.email in [...]`). Decisão sua (seção 8).

## 3. Segurança (ponto principal)

**Cabeçalhos** (já em `vercel.json`; CSP também como `<meta>` por hash no build):

| Item | Valor |
|---|---|
| CSP | `default-src 'none'`; `script-src 'self' https://apis.google.com` + hash do script de inicialização; `connect-src` Firebase/Google + a API; `frame-src` só `*.firebaseapp.com` e `accounts.google.com` (popup do Firebase Auth); `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`. `style-src` tem `'unsafe-inline'` (o Svelte injeta estilos) |
| Anti-iframe | `X-Frame-Options: DENY` e `frame-ancestors 'none'` (só vale como cabeçalho, não em `<meta>`) |
| `Referrer-Policy` | `no-referrer` |
| HSTS | `max-age=63072000; includeSubDomains; preload` (**cuidado com `preload`/`includeSubDomains`**: afeta todo o domínio `targetautospa.com.br`; só mantenha se todos os subdomínios têm HTTPS) |
| noindex | `<meta name="robots">` + `X-Robots-Tag: noindex, nofollow, noarchive` |
| Outros | `X-Content-Type-Options: nosniff`, `Permissions-Policy` sem câmera/microfone/localização, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (o popup do Google precisa disso) |

**Não testado em navegador real:** a CSP é a primeira suspeita se o popup do Google não abrir. Teste no preview da Vercel antes do domínio final; ajustar custa um commit.

- **Limite de tentativas de login:** o login é feito direto no Firebase Auth (não passa pela nossa API). O Firebase já limita por IP/conta (`auth/too-many-requests`); isso é o que protege a senha. Para reforço: Identity Platform (proteção contra força bruta e bloqueio de contas, pago) ou só Google (sem senha). Na nossa API, o limitador em memória (`criarLimitador`) já existe; o limite forte é o **Firewall da Vercel** (regra de rate limit por IP em `/api/*`).
- **Firebase App Check (reCAPTCHA v3/Enterprise):** protege Firestore/Auth/Storage contra chamadas fora do seu site (scripts, chaves vazadas). Esforço: ~1 dia (registrar o site no reCAPTCHA, `initializeAppCheck` só no build web, depois "Aplicar" no console, por serviço, **só depois de medir** o tráfego). Custo: reCAPTCHA v3 grátis; Enterprise gratuito até 10 mil avaliações/mês. **Cuidado:** aplicar App Check no Firestore também bloqueia o app do celular, que precisaria do provedor nativo (App Attest/Play Integrity); por isso só no modo "monitorar" até o app suportar. Não é urgente.
- **Domínios autorizados (Firebase Auth):** em Authentication > Settings > Domínios autorizados, adicionar `admin.targetautospa.com.br` (e o domínio de preview da Vercel só durante o teste; remover depois).
- **CORS da API:** hoje `ORIGENS_APP` em `api-vercel/_lib/http.js` tem só as origens do Tauri. Mudança necessária (não feita, não é deploy desta etapa): acrescentar **`https://admin.targetautospa.com.br`** à lista, por igualdade exata (como já é feito: `Set`, sem curinga, sem `*.vercel.app`). Origens de preview só fora de produção.
- **Chave de API do Firebase:** é pública por desenho, mas restrinja no Google Cloud Console por "referenciadores HTTP" (`admin.targetautospa.com.br/*`) e por APIs usadas. Observação: o app Tauri usa a mesma chave com origem `tauri://localhost`, que **não é um referenciador** válido: se restringir por site, crie uma chave separada para o web.
- **Mais para um painel exposto:** MFA (Identity Platform) para admins; sessões curtas (expirar login após X horas); log de atividades já existe (`login_admin`) — alertar login de IP novo; poucos admins; revisar e-mails de admin trimestralmente; domínio com DNSSEC/CAA; proteção de branch na `main` (o deploy sai dela); `npm audit` no CI.
- **O que NÃO dá para garantir só no front-end:** tudo o que for do navegador (esconder telas, `GuardaPapel`, lista de e-mails, CSP, noindex) pode ser contornado por quem chama o Firestore/API direto com um token. O que realmente protege: **regras do Firestore, validação na API (token + papel), custom claims, App Check, Firewall/rate limit, MFA**. Qualquer conta que consiga virar `admin` em `users/{uid}` ganha tudo: as regras de `users` já impedem o autopromover; mantenha assim.

## 4. Layout para desktop

Hoje as telas são colunas de largura de celular (`.pagina`, cartões, `.folha`). Proposta:

- **Estrutura:** barra lateral fixa (as 7 seções do admin) + área de conteúdo larga (max ~1280 px), topo com busca e usuário. Em tela estreita volta ao layout atual.
- **Tabelas** (usuários, agendamentos, pagamentos, custos, atividades): colunas ordenáveis, filtros no topo (status, condomínio, período, funcionário), **paginação por cursor** (`startAfter`, como `usuario-dados.ts` já faz, 20/50/100 por página), linha clicável que abre o detalhe já existente.
- **Exportar CSV** em cada tabela: gera no navegador a partir dos dados já carregados (com BOM e `;` para abrir direto no Excel em pt-BR); filtros aplicados valem.
- **Atalhos:** `/` foca a busca, `g` depois `u/a/p/c` navega, `n` novo item, `Esc` fecha painel.

| Já funciona no web sem mudança (só embrulhar a rota) | Precisa de tela nova |
|---|---|
| Dashboard (`PainelDashboard`) | Layout com barra lateral e largura de desktop |
| Usuários e detalhe (`GerenciarUsuarios`, `/admin/usuarios/[uid]`) | Tabela com filtros e paginação (usuários e agendamentos) |
| Agendamentos e detalhe (`/admin/agendamentos`) | Pagamentos: lista dedicada (hoje só dentro do agendamento) |
| Serviços e preços (`/admin/precos`) | Relatórios (seção 5) |
| Custos (`/admin/custos`) | Mensagens: supervisão do chat (somente leitura) |
| Atividades (`/admin/atividades`) | Exportação CSV |
| Avaliações, Condomínios | |

O que no web não faz sentido e fica de fora: checklist de fotos (câmera) e telas de cliente/gerente/funcionário. O detalhe do agendamento no admin mostra o checklist em leitura (fotos): deve funcionar, mas **precisa de teste** (Storage com CORS/regras).

**Mensagens (supervisão):** as regras já permitem `read` de `chats` ao admin (`souAdmin()`). Tela nova somente leitura: lista de conversas (`orderBy('ultimaHora','desc')`, sem `where`, índice automático de campo único) e abre as mensagens; sem campo de envio e **sem marcar como lida** (não mexer nos contadores do gerente). Conferir que a regra da subcoleção `mensagens` também libera o admin (não verifiquei).

## 5. Relatórios mínimos

| Relatório | Consulta | Índice |
|---|---|---|
| Faturamento por período | `agendamentos` `pagamento.status == 'pago'` e `pagamento.pagoEm` no intervalo, soma de `total` (`getAggregateFromServer`, já usado no dashboard) | já existe |
| Faturamento por serviço | mesma consulta, listando os documentos (até um teto) e somando os `itens` no cliente; **agregação no servidor não separa por item** | já existe; acima do teto, vale um agregado diário gravado pela API (decisão futura) |
| Agendamentos por status | `count` por `status` e `inicio` no intervalo (já no dashboard, com `orderBy('inicio','desc')`) | já existe (`status ASC, inicio DESC`) |
| Desempenho por funcionário | `funcionarioId == X`, `status == 'finalizado'`, `inicio` no intervalo: contagem e soma; lista de funcionários já carregada | **novo**: `agendamentos (funcionarioId ASC, status ASC, inicio DESC)` (a confirmar com o script de diagnóstico, como foi feito no dashboard) |
| Custos por categoria | `custos` por `competencia` no intervalo; soma por `categoria` no cliente (`custos.ts` já soma por período e expande recorrentes) | `custos (competencia)` automático |

Margem (faturamento menos custos) sai da combinação do primeiro com o último. CSV: um arquivo por relatório, valores em reais com vírgula decimal, cabeçalho em português, período no nome. **Nada implantado**; o índice novo só entra com o seu OK.

## 6. Hospedagem (Vercel) e o que você precisa fazer

O `vercel.json` na raiz do repositório já define build, saída e cabeçalhos. Pontos de atenção: a API continua no projeto próprio (`api-vercel`, outra raiz), então não conflita; confirme que **nenhum projeto existente da Vercel usa a raiz deste repositório** (senão ele passaria a usar este `vercel.json`).

1. **Vercel:** Add New > Project > importar o repositório do app; **Root Directory** = raiz; Framework Preset **Other**; o Build Command e o Output Directory vêm do `vercel.json` (`npm run build:web` e `build-web`). Production Branch: `main` (enquanto isso, teste com preview da branch).
2. **Variáveis de ambiente** (Settings > Environment Variables): `VITE_ADMIN_EMAILS` (opcional). A configuração do Firebase hoje está no código (`src/lib/firebase.ts`); ela é pública por desenho, então não precisa de variável. Se preferir trocar por variáveis `VITE_FIREBASE_*`, é uma mudança pequena no modo web (decisão sua).
3. **Domínio:** Settings > Domains > adicionar `admin.targetautospa.com.br`.
4. **DNS (no provedor do domínio):** `CNAME admin` apontando para o valor que a Vercel mostrar (`cname.vercel-dns.com`). Se o DNS for da Vercel, ela cria sozinha. Esperar o certificado HTTPS.
5. **Firebase Auth:** Authentication > Settings > Domínios autorizados > adicionar `admin.targetautospa.com.br`. Para o Google: no Google Cloud (Credenciais), o client "Aplicativo da Web" precisa ter `https://admin.targetautospa.com.br` em **Origens JavaScript autorizadas**. (O URI de redirecionamento `https://target-auto-spa-33842.firebaseapp.com/__/auth/handler` já vale.)
6. **Vercel Firewall:** regra de limite por IP em `/api/*`; modo de ataque só se necessário.
7. **API:** incluir a origem na lista de CORS (seção 3) e fazer o deploy da API (junto com o resto do lote 6, no mesmo deploy).

## 7. Esforço e entregas

| Entrega | O que deixa funcionando | Esforço |
|---|---|---|
| **1. Login web + dashboard** | Login Google (e e-mail), acesso negado e desconexão para não-admin, dashboard, cabeçalhos, hospedagem, CORS | 1 a 2 dias (a estrutura já está feita; falta layout de desktop básico, testes no preview e a configuração) |
| **2. Gestão em desktop** | Barra lateral, tabelas com filtros/paginação/CSV: usuários, agendamentos, pagamentos, serviços e preços, custos, atividades | 4 a 6 dias |
| **3. Relatórios + supervisão de mensagens + endurecimento** | Os 5 relatórios com CSV, chat somente leitura, App Check em modo monitor, claim de admin | 3 a 5 dias |

## 8. Decisões que preciso de você

1. Recomendação (a), mesmo projeto: ok?
2. Prefixo `/admin` na URL web, ou URL sem prefixo?
3. Login: só Google, ou Google e e-mail/senha?
4. Camada extra de admin: só lista de e-mails no front (fraca), ou custom claim + regra (forte, recomendado; mexe nas regras e exige um script)?
5. HSTS com `preload` e `includeSubDomains`: mantenho ou só `max-age`?
6. Chave de API do Firebase: restringir por site (exige chave separada para o web)?
7. Config do Firebase: mantém no código ou passa para `VITE_FIREBASE_*`?
8. Índice novo de funcionário (relatório): ok para a entrega 3?

## O que foi criado nesta etapa (estrutura mínima)

`scripts/build-web.mjs`, `npm run build:web`, `svelte.config.js` e `vite.config.js` (modo web por variável), `src/web/` (rotas web: login, layout, `/admin`, stub do Tauri), `src/lib/web/` (`acesso-admin.ts` com teste, `auth-web.ts`), `vercel.json`, `.gitignore` (`build-web/`).
