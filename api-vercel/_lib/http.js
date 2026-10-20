import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ErroHttp } from './usuarios.js';

// Origens do app: iOS (tauri://localhost), Android/Windows (http(s)://tauri.localhost) e dev.
// A autenticação é por Bearer token, não por cookie, então CORS aqui é só para o navegador deixar passar.
const ORIGENS = new Set([
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'http://localhost:1420',
  'http://localhost:5173'
]);

function cors(req, res) {
  const origem = req.headers.origin;
  if (origem && ORIGENS.has(origem)) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
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

// Envolve a lógica (criarUsuario/removerUsuario) num handler da Vercel
export function endpoint(logica) {
  return async function handler(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });

    try {
      const resultado = await logica(dependencias(), req.headers.authorization, req.body);
      return res.status(200).json(resultado);
    } catch (e) {
      if (e instanceof ErroHttp) return res.status(e.status).json({ erro: e.message });
      console.error('erro inesperado', e?.message);
      return res.status(500).json({ erro: 'Erro interno.' });
    }
  };
}
