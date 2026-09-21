const dois = (n: number) => String(n).padStart(2, '0');

// Ex.: 21/09/2026 14:32:10
export function carimboDataHora(d = new Date()) {
  return (
    `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`
  );
}

/**
 * Recebe a foto tirada, reduz o tamanho e desenha uma faixa escura embaixo
 * com as linhas de texto (data/hora, placa, etapa). Devolve um JPEG em base64.
 */
export async function fotoComMarcaDagua(
  arquivo: File,
  linhas: string[],
  ladoMax = 720
): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error('Não foi possível abrir a foto'));
      i.src = url;
    });

    const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);

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

    return canvas.toDataURL('image/jpeg', 0.6);
  } finally {
    URL.revokeObjectURL(url);
  }
}