// Normalização do nome do condomínio: usada TANTO na tela "entrar no condomínio" (busca)
// QUANTO no cadastro pelo admin (gravação de nomeNormalizado e geração do id). Uma só função
// garante que o que o admin grava é exatamente o que o morador procura.

export const NOME_MAX = 100;

/** minúsculas, sem acentos, espaços repetidos viram um só, sem espaços nas pontas */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** id do documento: nome normalizado só com [a-z0-9] e hífens ("Residencial São João" -> "residencial-sao-joao") */
export function idDoCondominio(nome: string): string {
  return normalizarNome(nome)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, NOME_MAX);
}

export type ErroNome = 'vazio' | 'longo' | 'invalido' | null;

export function validarNome(nome: string): ErroNome {
  const limpo = nome.trim();
  if (!limpo) return 'vazio';
  if (limpo.length > NOME_MAX) return 'longo';
  if (!idDoCondominio(limpo)) return 'invalido'; // só símbolos
  return null;
}

export type CondominioDados = { id: string; nome: string };

/** Duplicado: mesmo nome normalizado (ou mesmo id) em outro condomínio */
export function acharDuplicado(
  nome: string,
  existentes: { id: string; nome: string; nomeNormalizado?: string }[],
  ignorarId?: string
) {
  const normalizado = normalizarNome(nome);
  const id = idDoCondominio(nome);
  return existentes.find(
    (c) =>
      c.id !== ignorarId &&
      ((c.nomeNormalizado ?? normalizarNome(c.nome)) === normalizado || c.id === id)
  );
}
