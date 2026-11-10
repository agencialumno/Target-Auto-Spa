// Rota inicial de cada papel depois do login
export type PerfilRota = { role: string; condominioId: string | null };

export function rotaInicial(p: PerfilRota): string | null {
  switch (p.role) {
    case 'cliente':
      return p.condominioId ? '/cliente' : '/entrar-condominio';
    case 'gerente':
      return '/gerente';
    case 'funcionario':
      return '/funcionario';
    case 'admin':
      return '/admin';
    case 'insulfilm':
      return '/insulfilm';
    default:
      return null;
  }
}
