import { paginaRetorno } from '../../_lib/retorno.js';

// GET /api/retorno/pago | cancelado | expirado
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
  const tipo = String(req.query?.tipo ?? '');
  const html = paginaRetorno(tipo);
  if (!html) return res.status(404).end();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
