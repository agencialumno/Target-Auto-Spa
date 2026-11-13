// Decisão de acesso do painel web: só o papel `admin` entra. A lista de e-mails é uma camada
// extra opcional (VITE_ADMIN_EMAILS, separada por vírgula); vazia = não restringe por e-mail.
// ATENÇÃO: isto é só experiência de uso. Quem protege os dados são as regras do Firestore e a API.
export type Decisao = 'permitido' | 'negado';

export function listaDeEmails(bruto: string | undefined): string[] {
  return (bruto ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function decidirAcesso(
  perfil: { role?: string } | null,
  email: string | null | undefined,
  permitidos: string[]
): Decisao {
  if (!perfil || perfil.role !== 'admin') return 'negado';
  if (permitidos.length && !permitidos.includes((email ?? '').toLowerCase())) return 'negado';
  return 'permitido';
}

export const MENSAGEM_NEGADO = 'Acesso negado. Esta área é só para administradores.';
