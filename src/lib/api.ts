import { auth } from './firebase';
import { API_BASE } from './config';

// Chama a API da Vercel com o ID token do admin logado; erros vêm como { erro: "mensagem" }
export async function chamarApi(caminho: string, corpo: object) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sessão expirada. Entre novamente.');
  let resposta: Response;
  try {
    resposta = await fetch(`${API_BASE}/api/usuarios/${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo)
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique a internet.');
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro ?? 'Erro inesperado no servidor.');
  return dados;
}
