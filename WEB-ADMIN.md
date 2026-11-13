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
- `npm run build:web` (`scripts/web-admin/dist.mjs`) roda o Vite com `BUILD_WEB_ADMIN=1`. Sem a variável, `svelte.config.js` e `vite.config.js` são os de sempre (`build/`, rotas de `src/routes`).
- Com a variável: `kit.files.routes = src/web/routes` (só as rotas web), saída em `web-admin/dist/`, CSP por hash (`kit.csp`) e alias de `@tauri-apps/api/core` para `src/web/tauri-stub.ts`.
- **Exclusão do que é só do celular:** as rotas `cliente`, `gerente`, `funcionario` e `entrar-condominio` não existem em `src/web/routes`, então não entram no bundle (conferido: nenhuma referência no `web-admin/dist`). O plugin do Tauri sai pelo alias (o `invoke` vira um stub que lança erro). Login nativo (Apple/Google nativo), câmera e checklist de fotos só são importados por rotas de celular e por métodos de `auth.svelte.ts` que o web não chama.
- **`/admin` como raiz:** a raiz `/` redireciona para `/admin` (no cliente e, na Vercel, por redirecionamento); a tela de login aparece em `/admin` enquanto não há sessão de admin. Cada tela do admin entra no web por um arquivo de uma linha em `src/web/routes/admin/...` que importa a página existente de `src/routes/admin/...` (sem copiar código). Se quiser a URL sem o prefixo (`admin.targetautospa.com.br/usuarios`), é um `reroute` do SvelteKit que tira o `/admin`; recomendo manter o prefixo: os links atuais já usam `/admin/...`.
- **O build do celular não mudou:** `firebase.ts` e `auth.svelte.ts` ficaram intactos; `svelte.config.js`/`vite.config.js` só mudam com a variável. A verificação final (build do app) está no relatório.

## 2. Login na web

- **Google:** popup (`signInWithPopup` com `browserPopupRedirectResolver` passado **na chamada**). O `auth` do app continua criado sem resolver (o WebView do Tauri trava com ele), então nada muda para o celular. Redirecionamento é pior (perde estado, problemas com cookies de terceiros); popup é o padrão. Código: `src/lib/web/auth-web.ts`.
- **E-mail e senha:** fora do web (decisão: só Google), o que reduz a superfície de força bruta de senha.
- **Só admin entra:** na tela de login, depois que o perfil carrega, `decidirAcesso` (`src/lib/web/acesso-admin.ts`) decide. Qualquer outro papel, ou Google sem cadastro (sem perfil), vê "Acesso negado" e é **desconectado** na hora. O web nunca cria perfil (não chama o cadastro).
- **Onde o papel é verificado (três camadas):**
  1. Cliente: `decidirAcesso` no login e `GuardaPapel papel="admin"` em todo `/admin` (já existe).
  2. **Regras do Firestore (a que vale):** `souAdmin()` lê `users/{uid}.role`. Um não-admin que burle o front não lê nem grava nada de admin.
  3. API: cada endpoint confere o papel no servidor.
- **Lista de e-mails de admin (camada extra):** `VITE_ADMIN_EMAILS` (separada por vírgula) restringe a tela, mas é visível no bundle e só ajuda na experiência. A versão forte é no servidor: **custom claim** `admin: true` definida por script com o Admin SDK, e as regras exigirem `request.auth.token.admin == true` além do papel (ou `request.auth.token.email in [...]`). Decisão sua (seção 8).

## 3. Segurança (ponto principal)

**Cabeçalhos** (em `web-admin/vercel.json`; CSP também como `<meta>` por hash no build):

| Item | Valor |
|---|---|
| CSP | `default-src 'none'`; `script-src 'self' https://apis.google.com` + hash do script de inicialização; `connect-src` Firebase/Google + a API; `frame-src` só `*.firebaseapp.com` e `accounts.google.com` (popup do Firebase Auth); `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`. `style-src` tem `'unsafe-inline'` (o Svelte injeta estilos) |
| Anti-iframe | `X-Frame-Options: DENY` e `frame-ancestors 'none'` (só vale como cabeçalho, não em `<meta>`) |
| `Referrer-Policy` | `no-referrer` |
| HSTS | `max-age=31536000` (sem `preload` e sem `includeSubDomains`, para não afetar o resto do domínio) |
| noindex | `<meta name="robots">` + `X-Robots-Tag: noindex, nofollow, noarchive` |
| Outros | `X-Content-Type-Options: nosniff`, `Permissions-Policy` sem câmera/microfone/localização, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (o popup do Google precisa disso) |

**Não testado em navegador real:** a CSP é a primeira suspeita se o popup do Google não abrir. Teste no preview da Vercel antes do domínio final; ajustar custa um commit.

- **Limite de tentativas de login:** o login é feito direto no Firebase Auth (não passa pela nossa API). O Firebase já limita por IP/conta (`auth/too-many-requests`); isso é o que protege a senha. Para reforço: Identity Platform (proteção contra força bruta e bloqueio de contas, pago) ou só Google (sem senha). Na nossa API, o limitador em memória (`criarLimitador`) já existe; o limite forte é o **Firewall da Vercel** (regra de rate limit por IP em `/api/*`).
- **Firebase App Check (reCAPTCHA v3/Enterprise):** protege Firestore/Auth/Storage contra chamadas fora do seu site (scripts, chaves vazadas). Esforço: ~1 dia (registrar o site no reCAPTCHA, `initializeAppCheck` só no build web, depois "Aplicar" no console, por serviço, **só depois de medir** o tráfego). Custo: reCAPTCHA v3 grátis; Enterprise gratuito até 10 mil avaliações/mês. **Cuidado:** aplicar App Check no Firestore também bloqueia o app do celular, que precisaria do provedor nativo (App Attest/Play Integrity); por isso só no modo "monitorar" até o app suportar. Não é urgente.
- **Domínios autorizados (Firebase Auth):** em Authentication > Settings > Domínios autorizados, adicionar `admin.targetautospa.com.br` (e o domínio de preview da Vercel só durante o teste; remover depois).
- **CORS da API:** hoje `ORIGENS_APP` em `api-vercel/_lib/http.js` tem só as origens do Tauri. **Feito no código, sem deploy:** `https://admin.targetautospa.com.br` entrou em `ORIGENS_APP`, com teste; só vale após o próximo deploy da API. Era a mudança necessária:, por igualdade exata (como já é feito: `Set`, sem curinga, sem `*.vercel.app`). Origens de preview só fora de produção.
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
| Desempenho por funcionário | `funcionarioId == X`, `status == 'finalizado'`, `inicio` no intervalo: contagem e soma; lista de funcionários já carregada | **novo, já no `firestore.indexes.json` (não implantado)**: `agendamentos (funcionarioId ASC, status ASC, inicio DESC)` |
| Custos por categoria | `custos` por `competencia` no intervalo; soma por `categoria` no cliente (`custos.ts` já soma por período e expande recorrentes) | `custos (competencia)` automático |

Margem (faturamento menos custos) sai da combinação do primeiro com o último. CSV: um arquivo por relatório, valores em reais com vírgula decimal, cabeçalho em português, período no nome. **Nada implantado**; o índice novo só entra com o seu OK.

## 6. Hospedagem (Vercel) e o que você precisa fazer

**Por que existe projeto separado (incidente do preview da lote-7):** o primeiro desenho pôs um `vercel.json` na raiz do repositório. O projeto da API (`target-auto-spa-api`) passou a usá-lo: o log do deploy mostra a instalação feita na pasta da API (32 pacotes, `engines` 22.x) e o erro `npm error Missing script: "build:web"`, porque o `package.json` da API não tem esse script. Foi removido. **Regra: nenhum `vercel.json` na raiz do repositório.** A configuração do Web fica em `web-admin/vercel.json`, que só vale para um projeto cujo Root Directory seja `web-admin`.

**Desenho (o que tenho certeza / o que não tenho):**
- Certeza: sem `vercel.json` na raiz, o projeto da API volta ao comportamento da `main` (a `main` não tem esse arquivo). Os previews das lotes 5 e 6 passaram assim.
- Certeza: a Vercel lê o `vercel.json` do Root Directory do projeto, e `installCommand`, `buildCommand`, `outputDirectory`, `redirects`, `rewrites` e `headers` são campos válidos dele.
- **Sem certeza (testar no primeiro deploy do projeto Web):** com Root Directory `web-admin`, o build precisa dos arquivos do repositório inteiro (`cd .. && npm ci`). Isso depende da opção **"Include source files outside of the Root Directory in the Build Step"** (deve estar ligada; é o padrão, mas confira). Se falhar, o plano B é Root Directory = raiz do repositório com Build Command, Output Directory e Install Command preenchidos no painel (sem `vercel.json`) e os cabeçalhos pelo painel/Firewall da Vercel.
- Sem certeza: a regra de rewrite do SPA (`/((?!_app/|favicon.png).*)` para `/index.html`) e a ordem com o redirecionamento de `/`. Teste abrindo `/admin`, atualizando a página e `/`.

**Passo a passo para você (painel da Vercel):**
1. Add New > Project > importar o repositório `agencialumno/Target-Auto-Spa` (o mesmo repositório; será um segundo projeto).
2. Nome: `target-auto-spa-admin`. **Root Directory: `web-admin`**. Framework Preset: **Other**.
3. Em Build and Output Settings, deixe tudo sem substituir (vem do `web-admin/vercel.json`: install `cd .. && npm ci`, build `cd .. && npm run build:web`, saída `dist`).
4. Settings > General: confirme **"Include source files outside of the Root Directory in the Build Step" = ligado**. Node.js Version: 22.x ou 24.x.
5. Settings > Git: Production Branch `main`. Por enquanto só faça o primeiro deploy a partir de um preview (branch `lote-7`) e teste.
6. Environment Variables: nenhuma é obrigatória. `VITE_ADMIN_EMAILS` é opcional (e-mails separados por vírgula).
7. Settings > Domains > adicionar `admin.targetautospa.com.br`. No DNS do domínio, `CNAME admin` com o valor que a Vercel mostrar (normalmente `cname.vercel-dns.com`); se o DNS for da Vercel, ela cria sozinha.
8. Firebase Auth: Authentication > Settings > Domínios autorizados > adicionar `admin.targetautospa.com.br` (e o domínio do preview só durante o teste). Google Cloud > Credenciais > client "Aplicativo da Web" > Origens JavaScript autorizadas > `https://admin.targetautospa.com.br`.
9. Firewall da Vercel (projeto da API): regra de limite por IP em `/api/*`.
10. API: o CORS do novo domínio já está no código; só vale depois do deploy da API (junto com o lote 6). Sem isso, as telas do web que chamam a API falham por CORS; o login e o dashboard (Firestore direto) não dependem disso.

Importante: o projeto da API **não deve ser alterado** em nada no painel.

## 7. Esforço e entregas

| Entrega | O que deixa funcionando | Esforço |
|---|---|---|
| **1. Login web + dashboard** | Login Google (e e-mail), acesso negado e desconexão para não-admin, dashboard, cabeçalhos, hospedagem, CORS | 1 a 2 dias (a estrutura já está feita; falta layout de desktop básico, testes no preview e a configuração) |
| **2. Gestão em desktop** | Barra lateral, tabelas com filtros/paginação/CSV: usuários, agendamentos, pagamentos, serviços e preços, custos, atividades | 4 a 6 dias |
| **3. Relatórios + supervisão de mensagens + endurecimento** | Os 5 relatórios com CSV, chat somente leitura, App Check em modo monitor, claim de admin | 3 a 5 dias |

## 8. Decisões

Já decididas por você: mesmo código com modo web; prefixo `/admin` com a raiz redirecionando para `/admin`; login só com Google; HSTS `max-age=31536000` sem `preload` e sem `includeSubDomains`; custom claim e chave de API separada ficam para depois; configuração do Firebase continua no código; índice de funcionário no arquivo (sem implantar); CORS no código (sem deploy).

Ainda abertas:
1. O projeto Web com Root Directory `web-admin` funciona na primeira tentativa? Só o primeiro preview mostra (ver "sem certeza" na seção 6).
2. Quando começar a entrega 2 (gestão em desktop)?

## O que existe nesta etapa

- `scripts/web-admin/dist.mjs` e `npm run build:web` (saída em `web-admin/dist/`, ignorada pelo git).
- `svelte.config.js` e `vite.config.js`: modo web só com `BUILD_WEB_ADMIN=1`.
- `src/web/`: rotas web (raiz redireciona para `/admin`), `Entrada.svelte` (login Google, verificação de papel, "acesso negado" com desconexão), stub do Tauri.
- `src/lib/web/`: `acesso-admin.ts` (com teste) e `auth-web.ts`.
- `web-admin/vercel.json`: configuração e cabeçalhos do projeto Web (não há `vercel.json` na raiz).
- `firestore.indexes.json`: índice `agendamentos (funcionarioId, status, inicio desc)` adicionado (não implantado).
- `api-vercel/_lib/http.js`: origem `https://admin.targetautospa.com.br` no CORS (não implantado).

## 9. Entregas 2 e 3 (lote 8): telas de gestão, relatórios e mensagens

Tudo em `src/web/` e `src/lib/web/`, só existe no build `BUILD_WEB_ADMIN=1`. Nenhum arquivo do app de celular foi alterado (o diff contra a lote-7 só toca essas duas pastas).

**Telas** (barra lateral em `Shell.svelte`): Dashboard, Usuários, Agendamentos, Pagamentos, Serviços e preços, Custos, Atividades, Avaliações, Relatórios, Mensagens. Serviços/preços, Custos, Atividades, Avaliações e os detalhes (usuário, agendamento) reaproveitam as páginas do app; o `Shell` só tira a moldura de celular por CSS.

**Estados**: toda tabela/relatório mostra Carregando, Vazio e Erro com o código do Firestore (`descreverErro`) e botão "Tentar de novo".

**Limites conhecidos** (avisados na tela): agendamentos até 2000 por consulta (reduza o período), usuários até 2000, conversas até 200, mensagens até 500. Ordenação e paginação das tabelas são no navegador sobre o que foi carregado.

### Consultas novas e índices

| Tela | Consulta | Índice | Situação |
|---|---|---|---|
| Usuários | `users` limit 2000 | nenhum | ok |
| Agendamentos / Pagamentos / Relatórios, só período | `inicio >= e < ` orderBy `inicio desc` | campo único `inicio` (automático) | existe |
| + status | `status ==` + período | `(status, inicio desc)` | existe |
| + condomínio | `condominioId ==` + período | `(condominioId, inicio desc)` | existe |
| + status + condomínio | os dois + período | `(condominioId, status, inicio desc)` | existe |
| Filtro de pagamento | feito no navegador | nenhum | evita índice novo |
| Relatórios: faturamento por dia, por serviço e por funcionário | `pagamento.status == pago` + `pagamento.pagoEm` no período, orderBy `pagoEm`, `total` | `(pagamento.status, pagamento.pagoEm, total)` - o MESMO do dashboard | existe no arquivo (confirmar que está implantado) |
| Relatórios: status e atendimentos/nota por funcionário | a consulta de agendamentos por período (acima) | nenhum | calculado no navegador |
| Relatório de custos | `listarCustos` (existente) | `competencia desc` automático | ok |
| Mensagens, lista | `chats` orderBy `ultimaHora desc` limit 200 | campo único (automático) | existe |
| Mensagens, conversa | `chats/{id}/mensagens` orderBy `criadoEm asc` limit 500 | campo único (automático) | existe |

**Índices a criar por causa desta etapa: nenhum.** (O índice `funcionarioId, status, inicio desc` da lote-7 continua no arquivo, não implantado; nenhuma tela desta etapa depende dele.)

Regras: o admin já lê `chats` e `chats/{id}/mensagens` (`souAdmin()` nas regras). A tela de Mensagens não escreve nada (sem envio, sem "lida").

### Pontos de atenção

- Faturamento = só `pagamento.status == pago`, pela **data do pagamento** (`pagamento.pagoEm`), igual ao dashboard; há teste que confirma que os totais batem. Agendamentos por status e atendimentos/nota por funcionário usam a data do **agendamento**; custos, o mês de competência. Cada relatório diz na tela qual data usa.
- A consulta de documentos dos pagos usa `orderBy(pagoEm, total)` para casar com o índice existente do dashboard. Se o índice ainda não estiver implantado, o relatório mostra o erro `failed-precondition` com o link do console.
- CSV: separador `;`, BOM para acentos, células iniciadas por `=`, `+`, `-`, `@` (e tab/CR) ganham `'` na frente.
- Só validável em navegador real, com o projeto Web na Vercel: aparência do CSS nas telas reaproveitadas (largura, cabeçalho), download do CSV, CSP real com o Firebase, login com popup do Google, e o carregamento com dados de produção (volumes e tempos).

## 10. Identidade visual

O painel web usa a mesma identidade do app, adaptada a tela larga. Nenhuma cor própria: tudo vem das variáveis de `src/app.css` (o teste `src/web/tema.test.ts` falha se aparecer `#hex`, `rgb()` ou `hsl()` em qualquer CSS do painel, ou variável que não exista).

- **Login** (`CartaoLogin.svelte`): fundo `linear-gradient(160deg, --navy-900, --navy-700)`, card `--superficie` com borda `--superficie-borda` e raio `--raio-grande`, logo oficial (`logo.png`, alt "Grupo Target Auto Spa"; é dourado/prata com fundo transparente, legível no escuro) e o botão `.btn-primario` do app (dourado). Erro em `--erro-vivo`; foco com contorno `--gold-100`.
- **Moldura** (`Shell.svelte`): barra lateral `--navy-900` com símbolo + nome, item ativo `--gold-500`/`--navy-900`, hover `--superficie`, rodapé com usuário e Sair. Conteúdo sobre o mesmo gradiente do app, com a "folha" clara (`TelaWeb.svelte` para as telas novas; as telas reaproveitadas do app já trazem a sua).
- **Tabelas** (`Tabela.svelte`) e telas: cabeçalho `--card`, zebra `--info-fundo`, hover `--card`, selos ok/aviso/erro com `--ok-*`, `--aviso-*`, `--erro`; classes compartilhadas em `src/web/web.css` (só carregado na web).
- **Aba**: título "Target Auto Spa · Painel", favicon 32x32 e apple-touch 180x180 gerados do `simbolo.png` (`src/web/assets/`; o `static/favicon.png` do app não foi tocado) e `theme-color` `#0d0f12`, num modelo HTML próprio do web (`src/web/app.html`, que também libera o zoom, ao contrário do do app).
- **Responsivo**: abaixo de 900px a barra lateral vira barra superior com botão Menu (recolhe ao trocar de tela). Tabelas rolam na horizontal.
- **Dev**: `npm run dev:web` (servidor de desenvolvimento do modo web).
- **Capturas** em `docs-web/` (login, tela larga e tablet; a tela larga e o tablet usam dados fictícios, pois o dashboard real exige login de admin).
- Nota: no `vite dev` (modo web) o login falhou em teste manual com "Component auth has not been registered yet" (causa não investigada); no build (`build:web` + `vite preview`) a tela de login carrega normalmente.
