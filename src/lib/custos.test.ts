import { describe, it, expect } from 'vitest';
import { mesesDoPeriodo, montarCusto, ocorrenciasNoPeriodo, paraCentavos, somarCustos, validarCusto, type Custo, type EntradaCusto } from './custos';

const ok: EntradaCusto = { categoria: 'produtos', descricao: 'Shampoo', valor: '1.250,50', competencia: '2030-03', tipo: 'avulso', fim: '', escopo: 'geral' };
const custo = (extra: Partial<Custo>): Custo => ({
  id: 'c', categoria: 'produtos', descricao: 'x', valorCentavos: 10000, competencia: '2030-03-01', tipo: 'avulso', fim: null, escopo: 'geral', criadoPor: 'adm', ...extra
});

describe('paraCentavos', () => {
  it.each([
    ['1.250,50', 125050],
    ['1250,5', 125050],
    ['65', 6500],
    ['R$ 65,00', 6500],
    ['1250.50', 125050],
    ['0,01', 1]
  ])('%s', (v, esperado) => expect(paraCentavos(v)).toBe(esperado));
  it.each(['', 'abc', '-5', '1,234', '1,2,3', '12 reais'])('inválido: %s', (v) => expect(paraCentavos(v)).toBeNull());
});

describe('validarCusto e montarCusto', () => {
  it('aceita entrada válida e monta o documento em centavos, competência no dia 1', () => {
    expect(validarCusto(ok)).toBeNull();
    expect(montarCusto(ok)).toEqual({ categoria: 'produtos', descricao: 'Shampoo', valorCentavos: 125050, competencia: '2030-03-01', tipo: 'avulso', escopo: 'geral' });
  });

  it('recorrente leva recorrencia mensal e fim; avulso não leva', () => {
    const r = montarCusto({ ...ok, tipo: 'recorrente', fim: '2030-08' });
    expect(r).toMatchObject({ tipo: 'recorrente', recorrencia: 'mensal', fim: '2030-08-01' });
    expect(montarCusto({ ...ok, tipo: 'recorrente' }).fim).toBeNull();
    expect('recorrencia' in montarCusto(ok)).toBe(false);
  });

  it.each([
    [{ categoria: 'x' }, 'categoria'],
    [{ descricao: '  ' }, 'descricao'],
    [{ descricao: 'a'.repeat(121) }, 'descricao'],
    [{ valor: '0' }, 'valor'],
    [{ valor: 'abc' }, 'valor'],
    [{ valor: '2.000.000,00' }, 'valor'],
    [{ competencia: '' }, 'competencia'],
    [{ competencia: '2030-13' }, 'competencia'],
    [{ tipo: 'recorrente' as const, fim: '2030-01' }, 'fim'],
    [{ escopo: ' ' }, 'escopo']
  ])('recusa %#', (extra, campo) => expect(validarCusto({ ...ok, ...extra })?.campo).toBe(campo));
});

describe('período', () => {
  it('mesesDoPeriodo cruza o ano e recusa intervalo invertido', () => {
    expect(mesesDoPeriodo('2030-11', '2031-02')).toEqual(['2030-11', '2030-12', '2031-01', '2031-02']);
    expect(mesesDoPeriodo('2030-05', '2030-04')).toEqual([]);
  });

  it('avulso conta uma vez, só se a competência está no período', () => {
    expect(ocorrenciasNoPeriodo(custo({}), '2030-03', '2030-03')).toBe(1);
    expect(ocorrenciasNoPeriodo(custo({}), '2030-04', '2030-06')).toBe(0);
  });

  it('recorrente conta por mês, recortado pelo início e pelo fim', () => {
    const r = custo({ tipo: 'recorrente', competencia: '2030-03-01', fim: '2030-06-01' });
    expect(ocorrenciasNoPeriodo(r, '2030-01', '2030-12')).toBe(4);
    expect(ocorrenciasNoPeriodo(r, '2030-05', '2030-12')).toBe(2);
    expect(ocorrenciasNoPeriodo(r, '2030-07', '2030-12')).toBe(0);
    expect(ocorrenciasNoPeriodo(custo({ tipo: 'recorrente', competencia: '2030-03-01' }), '2030-01', '2030-05')).toBe(3);
  });

  it('somarCustos soma por categoria e filtra por condomínio (inclui os gerais)', () => {
    const lista = [
      custo({ valorCentavos: 10000 }),
      custo({ categoria: 'aluguel', tipo: 'recorrente', valorCentavos: 50000, escopo: 'c1' }),
      custo({ categoria: 'aluguel', valorCentavos: 70000, escopo: 'c2' })
    ];
    const tudo = somarCustos(lista, '2030-03', '2030-04');
    expect(tudo.totalCentavos).toBe(10000 + 100000 + 70000);
    expect(tudo.porCategoria).toEqual({ produtos: 10000, aluguel: 170000 });
    expect(somarCustos(lista, '2030-03', '2030-04', 'c1').totalCentavos).toBe(110000);
  });
});
