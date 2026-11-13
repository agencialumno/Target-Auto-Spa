import { describe, it, expect } from 'vitest';
import { celulaCsv, paraCsv, reais } from './csv';

describe('CSV: proteção contra injeção de fórmula', () => {
  it.each(['=1+1', '+55 11', '-2', '@SUM(A1)', '\tcmd', '\rcmd'])('neutraliza célula que começa com %j', (v) => {
    const c = celulaCsv(v);
    expect(c.replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('não mexe em texto comum nem em números', () => {
    expect(celulaCsv('Lavagem')).toBe('Lavagem');
    expect(celulaCsv(12)).toBe('12');
    expect(celulaCsv(null)).toBe('');
    expect(celulaCsv(undefined)).toBe('');
    expect(celulaCsv('a=b')).toBe('a=b'); // só o PRIMEIRO caractere importa
  });

  it('coloca aspas em ; , aspas e quebra de linha', () => {
    expect(celulaCsv('a;b')).toBe('"a;b"');
    expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(celulaCsv('l1\nl2')).toBe('"l1\nl2"');
  });

  it('neutraliza e protege junto: =HIPERLINK("x";"y")', () => {
    expect(celulaCsv('=HIPERLINK("x";"y")')).toBe('"\'=HIPERLINK(""x"";""y"")"');
  });

  it('monta o arquivo com BOM, ; e CRLF, neutralizando o cabeçalho também', () => {
    const csv = paraCsv(['Nome', '=cab'], [['João', '@x'], ['Maria', 5]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe("﻿Nome;'=cab\r\nJoão;'@x\r\nMaria;5\r\n");
  });

  it('dinheiro em reais com vírgula', () => {
    expect(reais(123450)).toBe('1234,50');
    expect(reais(5)).toBe('0,05');
  });
});
