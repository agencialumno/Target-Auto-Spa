import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ErroHttp } from './usuarios.js';

// Origens do app: iOS (tauri://localhost) e Android/Windows (http(s)://tauri.localhost).
// Origens de desenvolvimento só valem fora de produção.
// Painel web do admin (domínio exato, sem curingas)
const ORIGEM_ADMIN_WEB = 'https://admin.targetautospa.com.br';
const ORIGENS_APP = ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost', ORIGEM_ADMIN_WEB];
const ORIGENS_DEV = ['http://localhost:1420', 'http://localhost:5173'];

export function origensPermitidas(env = process.env) {
  return new Set(env.VERCEL_ENV === 'production' ? ORIGENS_APP : [...ORIGENS_APP, ...ORIGENS_DEV]);
}

// Limite de tentativas por IP. Em memória: vale por instância da função (não é global), então
// reduz força bruta e abuso simples, mas o limite forte deve ficar no Firewall da Vercel.
export function criarLimitador({ max = 20, janelaMs = 60_000, agora = () => Date.now() } = {}) {
  const acessos = new Map();
  return function permitido(chave) {
    const t = agora();
    const recentes = (acessos.get(chave) ?? []).filter((x) => t - x < janelaMs);
    if (recentes.length >= max) {
      acessos.set(chave, recentes);
      return false;
    }
    recentes.push(t);
    acessos.set(chave, recentes);
    if (acessos.size > 5000) {
      for (const [k, v] of acessos) if (!v.some((x) => t - x < janelaMs)) acessos.delete(k);
    }
    return true;
  };
}

export function ipDe(req) {
  const xff = req.headers['x-forwarded-for'];
  const primeiro = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return primeiro || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'desconhecido';
}

function cabecalhos(req, res, origemOk) {
  const origem = req.headers.origin;
  if (origem && origemOk) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// FIREBASE_SERVICE_ACCOUNT_BASE64 = conteúdo do JSON da service account, em base64
function dependencias() {
  if (!getApps().length) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 não definida');
    const conta = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    initializeApp({ credential: cert(conta) });
  }
  return { auth: getAuth(), db: getFirestore() };
}

const limitadorPadrao = criarLimitador();

// Envolve a lógica (criarUsuario/removerUsuario) num handler da Vercel
export function endpoint(
  logica,
  { obterDeps = dependencias, limitador = limitadorPadrao, env = process.env } = {}
) {
  return async function handler(req, res) {
    const origens = origensPermitidas(env);
    const origem = req.headers.origin;
    const origemOk = !origem || origens.has(origem);
    cabecalhos(req, res, origemOk);

    if (req.method === 'OPTIONS') return res.status(origemOk ? 204 : 403).end();
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });

    // Navegadores de outros sites são recusados; clientes sem Origin (o app nativo) seguem para a autenticação
    if (!origemOk) return res.status(403).json({ erro: 'Origem não permitida.' });

    // Limite por IP antes de qualquer trabalho (inclui tentativas com token inválido)
    if (!limitador(ipDe(req))) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ erro: 'Muitas tentativas. Aguarde um minuto.' });
    }

    const tipo = String(req.headers['content-type'] ?? '');
    if (!tipo.toLowerCase().startsWith('application/json')) {
      return res.status(415).json({ erro: 'Envie JSON.' });
    }
    if (Number(req.headers['content-length'] ?? 0) > 4096) {
      return res.status(413).json({ erro: 'Requisição grande demais.' });
    }

    // Sem credencial não há o que fazer: responde 401 sem sequer iniciar o Firebase Admin
    // (assim uma configuração quebrada do Admin SDK não vira 500 para quem nem se autenticou)
    if (!/^Bearer .+/.test(String(req.headers.authorization ?? ''))) {
      return res.status(401).json({ erro: 'Faça login para continuar.' });
    }

    try {
      const resultado = await logica(obterDeps(), req.headers.authorization, req.body);
      return res.status(200).json(resultado);
    } catch (e) {
      if (e instanceof ErroHttp) return res.status(e.status).json({ erro: e.message });
      // Só o nome do erro vai para o log; a resposta nunca traz detalhes internos
      console.error('erro inesperado:', e?.name);
      return res.status(500).json({ erro: 'Erro interno.' });
    }
  };
}

// Handler do webhook do Asaas: só POST, sem CORS (quem chama é o servidor do Asaas), sem Origin.
// A autenticação é o cabeçalho asaas-access-token, conferido na lógica. Responde rápido e nunca
// devolve detalhes internos.
const limitadorWebhook = criarLimitador({ max: 600 });

// Uma linha por requisição: id do evento, tipo, resultado e status HTTP. Só valores que passam por
// regex entram (nunca token, CPF, e-mail, nome ou o corpo do evento).
const LOG_ID_RE = /^[A-Za-z0-9_&.:=-]{1,128}$/;
const LOG_TIPO_RE = /^[A-Z_]{1,60}$/;
export function linhaLogWebhook(corpo, http, resultado) {
  const id = typeof corpo?.id === 'string' && LOG_ID_RE.test(corpo.id) ? corpo.id : '-';
  const tipo = typeof corpo?.event === 'string' && LOG_TIPO_RE.test(corpo.event) ? corpo.event : '-';
  return `webhook evento=${id} tipo=${tipo} resultado=${resultado} http=${http}`;
}

// Lê o corpo sem deixar um JSON quebrado virar 400/500 (a Vercel lança ao acessar req.body)
function corpoSeguro(req) {
  try {
    return req.body;
  } catch {
    return undefined;
  }
}

// Contrato: método errado é 405; sem configuração 503; token inválido 401. Depois do token, tudo é 200
// (tipo desconhecido, repetido, sem agendamento, fora de ordem, corpo estranho); só falha de gravação é 5xx.
export function endpointWebhook({ obterDeps = dependencias, limitador = limitadorWebhook, env = process.env, processar, log = console.log } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const responder = (http, corpo, resultado) => {
      log(linhaLogWebhook(corpoSeguro(req), http, resultado));
      return res.status(http).json(corpo);
    };
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });

    const { tokenValido } = await import('./webhook-asaas.js');
    if (!env.ASAAS_WEBHOOK_TOKEN) return responder(503, { erro: 'Webhook não configurado.' }, 'sem_config');
    if (!tokenValido(req.headers['asaas-access-token'], env.ASAAS_WEBHOOK_TOKEN)) {
      return responder(401, { erro: 'Não autorizado.' }, 'token_invalido');
    }

    if (!limitador(ipDe(req))) {
      res.setHeader('Retry-After', '60');
      return responder(429, { erro: 'Muitas requisições.' }, 'limite');
    }
    const tipo = String(req.headers['content-type'] ?? '');
    if (!tipo.toLowerCase().startsWith('application/json')) return responder(200, { ok: true, resultado: 'tipo_ignorado' }, 'tipo_ignorado');
    if (Number(req.headers['content-length'] ?? 0) > 65536) return responder(200, { ok: true, resultado: 'grande_demais' }, 'grande_demais');
    const corpo = corpoSeguro(req);
    if (corpo === undefined) return responder(200, { ok: true, resultado: 'corpo_ilegivel' }, 'corpo_ilegivel');

    try {
      const logica = processar ?? (await import('./webhook-asaas.js')).processarWebhook;
      const r = await logica({ ...obterDeps(), env, agora: () => new Date() }, req.headers, corpo);
      return responder(r.status, r.corpo, r.corpo?.resultado ?? (r.status === 200 ? 'ok' : 'recusado'));
    } catch (e) {
      // Falha real (gravação/banco): 5xx para o Asaas tentar de novo. Só o nome do erro vai para o log.
      console.error('erro no webhook:', e?.name);
      return responder(500, { erro: 'Erro interno.' }, 'erro_interno');
    }
  };
}
