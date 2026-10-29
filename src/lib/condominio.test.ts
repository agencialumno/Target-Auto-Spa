import { describe, it, expect } from 'vitest';
import { acharDuplicado, idDoCondominio, normalizarNome, validarNome } from './condominio';

describe('normalizarNome', () => {
  it.each([
    ['Residencial Exemplo', 'residencial exemplo'],
    ['  Residencial   Exemplo  ', 'residencial exemplo'],
    ['RESIDENCIAL EXEMPLO', 'residencial exemplo'],
    ['Residencial São João', 'residencial sao joao'],
    ['Condomínio Açaí & Côco', 'condominio acai & coco'],
    ['Edifício\tLuz\nSol', 'edificio luz sol'],
    ['ÀÉÎÕÜ', 'aeiou']
  ])('%j -> %j', (entrada, esperado) => {
    expect(normalizarNome(entrada)).toBe(esperado);
  });

  it('é idempotente', () => {
    const n = normalizarNome('  São   João ');
    expect(normalizarNome(n)).toBe(n);
  });

  it('acentuação em formas diferentes (composta e decomposta) dá o mesmo resultado', () => {
    expect(normalizarNome('São')).toBe(normalizarNome('São'));
  });

  it('a busca do morador acha o que o admin gravou, qualquer que seja a digitação', () => {
    const gravado = normalizarNome('Residencial São João');
    for (const digitado of ['residencial sao joao', 'RESIDENCIAL  SÃO JOÃO', ' Residencial Sao João ']) {
      expect(normalizarNome(digitado)).toBe(gravado);
    }
  });
});

describe('idDoCondominio', () => {
  it.each([
    ['Residencial São João', 'residencial-sao-joao'],
    ['  Edifício   Luz & Sol  ', 'edificio-luz-sol'],
    ['A.B/C', 'a-b-c'],
    ['Torre 10', 'torre-10']
  ])('%j -> %j', (nome, id) => {
    expect(idDoCondominio(nome)).toBe(id);
  });

  it('só gera caracteres aceitos pela API e pelo id de documento', () => {
    expect(idDoCondominio('Ção!@# $%ˆ&*()_+ Test')).toMatch(/^[a-z0-9-]+$/);
  });

  it('nomes que diferem só em acento, caixa ou espaços geram o mesmo id', () => {
    expect(idDoCondominio('Sao Joao')).toBe(idDoCondominio('  são   JOÃO '));
  });

  it('nome só com símbolos gera id vazio', () => {
    expect(idDoCondominio('!!! ???')).toBe('');
  });

  it('respeita o limite de 100 caracteres', () => {
    expect(idDoCondominio('a'.repeat(300)).length).toBeLessThanOrEqual(100);
  });
});

describe('validarNome', () => {
  it('aceita nome normal', () => expect(validarNome('Residencial Exemplo')).toBeNull());
  it('vazio ou só espaços', () => {
    expect(validarNome('')).toBe('vazio');
    expect(validarNome('   ')).toBe('vazio');
  });
  it('muito longo', () => expect(validarNome('x'.repeat(101))).toBe('longo'));
  it('só símbolos', () => expect(validarNome('***')).toBe('invalido'));
});

describe('acharDuplicado', () => {
  const existentes = [
    { id: 'residencial-sao-joao', nome: 'Residencial São João', nomeNormalizado: 'residencial sao joao' },
    { id: 'torre-10', nome: 'Torre 10', nomeNormalizado: 'torre 10' },
    // cadastrado antes da normalização com acentos: sem nomeNormalizado
    { id: 'antigo', nome: 'Edifício Antigo' }
  ];

  it('mesmo nome com outra digitação é duplicado', () => {
    expect(acharDuplicado('RESIDENCIAL  sao joao', existentes)?.id).toBe('residencial-sao-joao');
    expect(acharDuplicado(' torre   10 ', existentes)?.id).toBe('torre-10');
  });

  it('acha duplicado em documento antigo sem nomeNormalizado', () => {
    expect(acharDuplicado('edificio antigo', existentes)?.id).toBe('antigo');
  });

  it('mesmo id gerado por nomes diferentes também é duplicado (A.B e A B)', () => {
    expect(acharDuplicado('Torre-10', existentes)?.id).toBe('torre-10');
  });

  it('nome novo não é duplicado', () => {
    expect(acharDuplicado('Residencial Novo', existentes)).toBeUndefined();
  });

  it('ao renomear, o próprio condomínio não conta como duplicado', () => {
    expect(acharDuplicado('Torre 10', existentes, 'torre-10')).toBeUndefined();
    expect(acharDuplicado('Torre 10', existentes, 'outro')?.id).toBe('torre-10');
  });
});
