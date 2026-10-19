import sharp from 'sharp';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// A App Store recusa ícones com canal alpha (ITMS-90717).
// Roda DEPOIS de `tauri icon`: compõe os ícones de iOS sobre fundo opaco, sem alpha.
const PASTA = 'src-tauri/icons/ios';
const FUNDO = '#0d0f12';

const arquivos = (await readdir(PASTA)).filter((f) => f.endsWith('.png'));

for (const nome of arquivos) {
  const caminho = join(PASTA, nome);
  const entrada = await readFile(caminho);
  const saida = await sharp(entrada)
    .flatten({ background: FUNDO })
    .removeAlpha()
    .toColourspace('srgb')
    .png()
    .toBuffer();
  await writeFile(caminho, saida);
}

console.log(`Ícones iOS sem alpha: ${arquivos.length} arquivos em ${PASTA}`);
