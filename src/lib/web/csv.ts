// CSV do painel web. Célula que começa com = + - @ (ou tab/CR) vira texto: apóstrofo na frente,
// para o Excel/Sheets não executarem como fórmula (injeção de fórmula).
const PERIGOSO = /^[=+\-@\t\r]/;

export function celulaCsv(valor: unknown): string {
  let s = valor === null || valor === undefined ? '' : String(valor);
  if (PERIGOSO.test(s)) s = "'" + s;
  // Aspas, vírgula, ponto e vírgula e quebras de linha pedem aspas ao redor
  if (/[",;\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Separador ";" (padrão do Excel em pt-BR) e BOM para os acentos abrirem certos
export function paraCsv(cabecalho: string[], linhas: unknown[][]): string {
  const todas = [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(';'));
  return '\uFEFF' + todas.join('\r\n') + '\r\n';
}

export function baixarCsv(nome: string, conteudo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Dinheiro no CSV como número simples (1234,50), sem símbolo
export const reais = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');
