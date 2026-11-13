import { describe, it, expect } from 'vitest';
import { rotuloQuando, resumir, ordenarConversas, contadorNovas, textoNovas } from './chat';

const agora = new Date(2030, 4, 15, 14, 30);
describe('rotuloQuando', () => {
  it('hoje: só a hora', () => expect(rotuloQuando(new Date(2030, 4, 15, 9, 5), agora)).toBe('09:05'));
  it('antes: data', () => expect(rotuloQuando(new Date(2030, 4, 14, 23, 59), agora)).toBe('14/05'));
  it('outro ano: data com ano', () => expect(rotuloQuando(new Date(2029, 11, 31, 10, 0), agora)).toBe('31/12/2029'));
  it('sem data: vazio', () => expect(rotuloQuando(null, agora)).toBe(''));
});

describe('resumir', () => {
  it('curto fica igual, espaços colapsam', () => expect(resumir('  oi   tudo\nbem ')).toBe('oi tudo bem'));
  it('longo é cortado com reticências', () => {
    const r = resumir('a'.repeat(100), 20);
    expect(r).toHaveLength(20);
    expect(r.endsWith('…')).toBe(true);
  });
});

describe('ordenarConversas', () => {
  const c = (id: string, h: Date | null) => ({ id, clienteNome: id, condominioId: 'x', ultimaMensagem: '', ultimaHora: h, naoLidasGerente: 0, naoLidasCliente: 0 });
  it('mais recente primeiro, sem data por último, sem alterar a entrada', () => {
    const e = [c('a', new Date(2030, 0, 1)), c('b', null), c('c', new Date(2030, 0, 3))];
    expect(ordenarConversas(e).map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(e.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('contadores', () => {
  it('99+ e plural', () => {
    expect(contadorNovas(5)).toBe('5');
    expect(contadorNovas(120)).toBe('99+');
    expect(textoNovas(1)).toBe('1 mensagem nova');
    expect(textoNovas(3)).toBe('3 mensagens novas');
  });
});

import { rotuloMensagem } from './chat';
describe('rotuloMensagem', () => {
  it('hoje só a hora; antes, data + hora; sem data, só a hora', () => {
    expect(rotuloMensagem(new Date(2030, 4, 15, 8, 0), '08:00', agora)).toBe('08:00');
    expect(rotuloMensagem(new Date(2030, 4, 13, 8, 0), '08:00', agora)).toBe('13/05 08:00');
    expect(rotuloMensagem(null, '08:00', agora)).toBe('08:00');
  });
});
