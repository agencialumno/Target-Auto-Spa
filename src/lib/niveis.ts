export const JANELA_DIAS = 90;

// Faixas de exemplo: ajuste os valores e descontos com a empresa
export const niveis = [
  { id: 'bronze', nome: 'Bronze', min: 0, desconto: 0 },
  { id: 'prata', nome: 'Prata', min: 300, desconto: 5 },
  { id: 'ouro', nome: 'Ouro', min: 800, desconto: 10 }
] as const;

export type Compra = { data: string; valor: number }; // data no formato aaaa-mm-dd

// Soma só o que foi comprado nos últimos 90 dias (janela móvel)
export function gastoJanela(compras: Compra[], agora = new Date()) {
  const limite = agora.getTime() - JANELA_DIAS * 24 * 3600 * 1000;
  return compras
    .filter((c) => new Date(c.data + 'T12:00:00').getTime() >= limite)
    .reduce((soma, c) => soma + c.valor, 0);
}

export function nivelAtual(gasto: number) {
  return [...niveis].reverse().find((n) => gasto >= n.min) ?? niveis[0];
}

export function proximoNivel(gasto: number) {
  return niveis.find((n) => n.min > gasto) ?? null;
}