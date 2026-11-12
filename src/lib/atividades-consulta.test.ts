import { describe, it, expect } from 'vitest';
import { descreverMudanca, lerAtividade, normalizarFiltros } from './atividades-consulta';

const vazio = { atorUid: '', acao: '', alvoId: '', de: '', ate: '' };

describe('normalizarFiltros', () => {
  it('sem filtros devolve objeto vazio; filtros inválidos são ignorados', () => {
    expect(normalizarFiltros(vazio)).toEqual({});
    expect(normalizarFiltros({ atorUid: '../x', acao: 'qualquer', alvoId: 'a b', de: '01/01/2030', ate: 'x' })).toEqual({});
  });

  it('aceita uid, ação da lista, alvo e período inclusivo', () => {
    const f = normalizarFiltros({ atorUid: ' abc123 ', acao: 'preco_alterado', alvoId: 'ag1', de: '2030-01-01', ate: '2030-01-31' });
    expect(f.atorUid).toBe('abc123');
    expect(f.acao).toBe('preco_alterado');
    expect(f.alvoId).toBe('ag1');
    expect(f.de!.getHours()).toBe(0);
    expect(f.ate!.getHours()).toBe(23);
    expect(f.ate!.getDate()).toBe(31);
  });
});

describe('lerAtividade e descreverMudanca', () => {
  it('lê campos com segurança e descreve status e preço', () => {
    const a = lerAtividade('x', { em: { toDate: () => new Date('2030-01-01') }, acao: 'status_agendamento', antes: { status: 'agendado' }, depois: { status: 'em_andamento' }, lixo: 1 });
    expect(a.em).toBeInstanceOf(Date);
    expect(descreverMudanca(a)).toBe('status: agendado → em_andamento');
    expect(lerAtividade('y', {}).antes).toBeNull();
    expect(descreverMudanca({ antes: { precoCentavos: 6500 }, depois: { precoCentavos: 7000 } })).toMatch(/preço: R\$\s65,00 → R\$\s70,00/);
    expect(descreverMudanca({ antes: null, depois: null })).toBe('');
  });
});
