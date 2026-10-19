import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('src/lib/assets', { recursive: true });

// 1) ÍCONE DO APP: símbolo centralizado em 1024x1024 com fundo escuro
const LADO = 1024;
const TAMANHO_SIMBOLO = 780;

const simboloRecortado = await sharp('../Identidade Visual/simbolo.png')
  .trim({ threshold: 10 })
  .resize(TAMANHO_SIMBOLO, TAMANHO_SIMBOLO, { fit: 'inside' })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: LADO,
    height: LADO,
    channels: 3,
    background: '#0d0f12'
  }
})
  .composite([{ input: simboloRecortado, gravity: 'center' }])
  .png()
  .toFile('assets-origem/icone-1024.png');

// 2) LOGO DENTRO DO APP: recorta as margens vazias
await sharp('../Identidade Visual/logo.png')
  .trim({ threshold: 10 })
  .png()
  .toFile('src/lib/assets/logo.png');

// 3) SÍMBOLO DA SPLASH: recortado, com fundo transparente
await sharp('../Identidade Visual/simbolo.png')
  .trim({ threshold: 10 })
  .resize(600, 600, { fit: 'inside' })
  .png()
  .toFile('src/lib/assets/simbolo.png');

console.log('Pronto: icone-1024.png, logo.png e simbolo.png gerados.');