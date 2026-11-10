// Validação de formulários: toda regra tem uma mensagem em português que diz exatamente o que falta.
// Nenhum formulário pode falhar em silêncio: o botão responde ao toque e a mensagem aparece.

export type CriterioSenha = { id: string; texto: string; mensagem: string; ok: (s: string) => boolean };

export const CRITERIOS_SENHA: CriterioSenha[] = [
  { id: 'tamanho', texto: 'Mínimo 8 caracteres', mensagem: 'Senha precisa de pelo menos 8 caracteres', ok: (s) => s.length >= 8 },
  { id: 'maiuscula', texto: 'Pelo menos 1 letra maiúscula', mensagem: 'Senha precisa de uma letra maiúscula', ok: (s) => /[A-Z]/.test(s) },
  { id: 'minuscula', texto: 'Pelo menos 1 letra minúscula', mensagem: 'Senha precisa de uma letra minúscula', ok: (s) => /[a-z]/.test(s) },
  { id: 'numero', texto: 'Pelo menos 1 número', mensagem: 'Senha precisa de um número', ok: (s) => /[0-9]/.test(s) },
  {
    id: 'especial',
    texto: 'Pelo menos 1 caractere especial (!@#$%^&*)',
    mensagem: 'Senha precisa de um caractere especial (como !@#$%)',
    ok: (s) => /[^A-Za-z0-9]/.test(s)
  }
];

export const criteriosSenha = (senha: string) => CRITERIOS_SENHA.map((c) => ({ ...c, atendido: c.ok(senha) }));

export const senhaForte = (senha: string) => CRITERIOS_SENHA.every((c) => c.ok(senha));

// Primeiro critério que falta, ou null se a senha é forte
export const mensagemSenha = (senha: string): string | null =>
  CRITERIOS_SENHA.find((c) => !c.ok(senha))?.mensagem ?? null;

export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// Problema de um campo: qual campo marcar em vermelho e o que dizer
export type Problema<C extends string = string> = { campo: C; mensagem: string };

// Leva o campo com problema para o meio da tela. O atraso deixa o teclado do iPhone terminar de
// subir, para a rolagem não ser desfeita por ele e o campo não ficar escondido atrás dele.
export function rolarAte(el: HTMLElement | null | undefined) {
  if (!el) return;
  el.focus?.({ preventScroll: true });
  setTimeout(() => el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 350);
}
