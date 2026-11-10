const dois = (n: number) => String(n).padStart(2, '0');

// Ex.: 21/09/2026 14:32:10
export function carimboDataHora(d = new Date()) {
  return (
    `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`
  );
}

export const LADO_MAX = 1600;
export const QUALIDADE_JPEG = 0.7;
export const ALVO_BYTES = 500 * 1024;

// Tamanho final mantendo a proporção: o lado maior nunca passa de ladoMax (não amplia)
export function dimensoesAlvo(largura: number, altura: number, ladoMax = LADO_MAX, escala = 1) {
  const f = Math.min(1, ladoMax / Math.max(largura, altura)) * escala;
  return { w: Math.max(1, Math.round(largura * f)), h: Math.max(1, Math.round(altura * f)) };
}

/**
 * Gera o JPEG pedindo primeiro qualidade 0.7 no tamanho cheio; se passar do alvo, baixa a
 * qualidade e depois o tamanho, até caber. Se nada couber, devolve o menor que conseguiu.
 */
export async function comprimirAteAlvo(
  gerar: (escala: number, qualidade: number) => Promise<Blob>,
  alvoBytes = ALVO_BYTES
): Promise<Blob> {
  const tentativas: [number, number][] = [
    [1, QUALIDADE_JPEG],
    [1, 0.6],
    [1, 0.5],
    [0.85, 0.5],
    [0.7, 0.5],
    [0.55, 0.45]
  ];
  let menor: Blob | null = null;
  for (const [escala, qualidade] of tentativas) {
    const blob = await gerar(escala, qualidade);
    if (blob.size <= alvoBytes) return blob;
    if (!menor || blob.size < menor.size) menor = blob;
  }
  return menor as Blob;
}

/**
 * Recebe a foto tirada, reduz o tamanho (lado maior até 1600 px) e desenha uma faixa escura
 * embaixo com as linhas de texto (data/hora, placa, etapa). Devolve um JPEG (Blob, alvo < 500 KB)
 * para enviar ao Storage, que só aceita image/jpeg.
 */
export async function fotoComMarcaDagua(
  arquivo: File,
  linhas: string[],
  ladoMax = LADO_MAX
): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error('Não foi possível abrir a foto'));
      i.src = url;
    });

    const desenhar = (escala: number, qualidade: number) => {
      const { w, h } = dimensoesAlvo(img.naturalWidth, img.naturalHeight, ladoMax, escala);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponível');

      ctx.drawImage(img, 0, 0, w, h);

      const fonte = Math.max(12, Math.round(w * 0.035));
      const pad = Math.round(fonte * 0.6);
      const linhaAltura = fonte * 1.3;
      const alturaBarra = linhas.length * linhaAltura + pad * 2;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
      ctx.fillRect(0, h - alturaBarra, w, alturaBarra);

      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${fonte}px system-ui, -apple-system, Helvetica, Arial, sans-serif`;
      ctx.textBaseline = 'top';
      linhas.forEach((linha, i) => {
        ctx.fillText(linha, pad, h - alturaBarra + pad + i * linhaAltura, w - pad * 2);
      });

      return new Promise<Blob>((ok, erro) =>
        canvas.toBlob(
          (b) => (b ? ok(b) : erro(new Error('Não foi possível gerar o JPEG'))),
          'image/jpeg',
          qualidade
        )
      );
    };

    return await comprimirAteAlvo(desenhar);
  } finally {
    URL.revokeObjectURL(url);
  }
}
