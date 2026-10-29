import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { _sha256Js, sha256Hex, gerarNonce } from './nonce';

// Vetores oficiais do NIST (FIPS 180-4)
const VETORES: [string, string][] = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [
    'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
  ],
  ['a'.repeat(1_000_000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0']
];

describe('SHA-256 em JS puro', () => {
  it.each(VETORES)('vetor conhecido (%#)', (entrada, esperado) => {
    expect(_sha256Js(entrada)).toBe(esperado);
  });

  it('bordas do preenchimento (55, 56, 63, 64, 65 bytes) batem com o crypto do Node', () => {
    for (const n of [55, 56, 57, 63, 64, 65, 119, 120]) {
      const s = 'x'.repeat(n);
      expect(_sha256Js(s)).toBe(createHash('sha256').update(s).digest('hex'));
    }
  });

  it('texto com acentos e emoji (UTF-8)', () => {
    const s = 'ação-Ünï-😀';
    expect(_sha256Js(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
  });

  it('saída é hex minúsculo de 64 caracteres (formato que o Firebase espera)', () => {
    expect(_sha256Js('qualquer')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('sha256Hex', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('usa crypto.subtle quando existe', async () => {
    expect(await sha256Hex('abc')).toBe(VETORES[1][1]);
  });

  it('cai no JS puro quando crypto.subtle não existe (contexto inseguro do WebView)', async () => {
    vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    expect(await sha256Hex('abc')).toBe(VETORES[1][1]);
  });

  it('cai no JS puro quando crypto.subtle.digest falha', async () => {
    vi.stubGlobal('crypto', {
      subtle: { digest: () => Promise.reject(new Error('inseguro')) }
    });
    expect(await sha256Hex('abc')).toBe(VETORES[1][1]);
  });
});

describe('gerarNonce', () => {
  it('tem 32 caracteres por padrão e respeita o tamanho pedido', () => {
    expect(gerarNonce()).toHaveLength(32);
    expect(gerarNonce(16)).toHaveLength(16);
  });

  it('usa só caracteres permitidos pela Apple/Firebase', () => {
    for (let i = 0; i < 50; i++) expect(gerarNonce()).toMatch(/^[0-9A-Za-z\-._]+$/);
  });

  it('não repete entre chamadas', () => {
    const conjunto = new Set(Array.from({ length: 200 }, () => gerarNonce()));
    expect(conjunto.size).toBe(200);
  });
});
