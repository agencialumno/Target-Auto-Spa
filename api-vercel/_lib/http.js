import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ErroHttp } from './usuarios.js';

// Origens do app: iOS (tauri://localhost) e Android/Windows (http(s)://tauri.localhost).
// Origens de desenvolvimento só valem fora de produção.
const ORIGENS_APP = ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'];
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
