import { auth } from './firebase';
import { API_BASE } from './config';

const TEMPO_TOKEN_MS = 15_000;
const TEMPO_REQUISICAO_MS = 25_000;

const comTempo = <T>(p: Promise<T>, ms: number, mensagem: string) =>
  new Promise<T>((ok, erro) => {
    const t = setTimeout(() => erro(new Error(mensagem)), ms);
    p.then(
      (v) => (clearTimeout(t), ok(v)),
      (e) => (clearTimeout(t), erro(e))
    );
  });

// Chama a API da Vercel com o ID token de quem está logado; erros vêm como { erro: "mensagem" }.
// Nunca fica pendurada nem falha sem mensagem: token e requisição têm tempo limite.
export async function chamarApi(caminho: string, corpo: object, grupo: 'usuarios' | 'pagamento' | 'agendamentos' = 'usuarios') {
  let token: string | undefined;
  try {
    token = await comTempo(
      Promise.resolve(auth.currentUser?.getIdToken()),
      TEMPO_TOKEN_MS,
      'Não foi possível validar a sessão (tempo esgotado). Saia e entre de novo.'
    );
  } catch (e) {
    throw e instanceof Error ? e : new Error('Não foi possível validar a sessão. Saia e entre de novo.');
  }
  if (!token) throw new Error('Sessão expirada. Entre novamente.');

  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), TEMPO_REQUISICAO_MS);
  let resposta: Response;
  try {
    resposta = await fetch(`${API_BASE}/api/${grupo}/${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
      signal: controle.signal
    });
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') {
      throw new Error('O servidor demorou demais para responder. Tente novamente.');
    }
    throw new Error('Sem conexão com o servidor. Verifique a internet.');
  } finally {
    clearTimeout(t);
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro ?? `Erro inesperado no servidor (HTTP ${resposta.status}).`);
  return dados;
}
