// Identidade visual do painel web: nenhuma cor própria; tudo vem das variáveis de src/app.css.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname);
const arquivos = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? arquivos(p) : [p];
  });

// Só o CSS (blocos <style> e web.css) é conferido: o <meta theme-color> da página é HTML, não estilo
const estilos = arquivos(raiz)
  .filter((p) => /\.(svelte|css)$/.test(p))
  .map((p) => ({ p, css: p.endsWith('.css') ? readFileSync(p, 'utf8') : (readFileSync(p, 'utf8').match(/<style[\s\S]*?<\/style>/g) ?? []).join('\n') }));

const appCss = readFileSync(join(__dirname, '../app.css'), 'utf8');

describe('tema do painel web', () => {
  it('há CSS do painel para conferir', () => {
    expect(estilos.length).toBeGreaterThan(5);
  });
  it('não usa cor hexadecimal, rgb() nem hsl() próprios', () => {
    for (const { p, css } of estilos) {
      expect(css.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g) ?? [], p).toEqual([]);
    }
  });
  it('só usa variáveis que existem em app.css', () => {
    const definidas = new Set([...appCss.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    for (const { p, css } of estilos) {
      for (const [, v] of css.matchAll(/var\((--[a-z0-9-]+)/g)) expect(definidas.has(v), `${v} em ${p}`).toBe(true);
    }
  });
});

describe('páginas do painel web', () => {
  it('modelo HTML do web: título, tema e zoom liberado (o do app bloqueia zoom)', () => {
    const html = readFileSync(join(__dirname, 'app.html'), 'utf8');
    expect(html).toContain('<title>Target Auto Spa · Painel</title>');
    expect(html).toContain('name="theme-color" content="#0d0f12"');
    expect(html).not.toContain('user-scalable=no');
  });
  it('favicon 32x32 e apple-touch 180x180 existem (PNG com as dimensões certas)', () => {
    const dim = (f: string) => {
      const b = readFileSync(join(__dirname, 'assets', f));
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };
    expect(dim('favicon-32.png')).toEqual([32, 32]);
    expect(dim('apple-touch-icon.png')).toEqual([180, 180]);
  });
});
