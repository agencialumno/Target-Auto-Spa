import { describe, it, expect } from 'vitest';
import { slotsCobertos, horarioLivreParaDuracao } from './agenda';

describe('slotsCobertos (igual ao do servidor)', () => {
  it('um horário de 30 min por fatia da duração, arredondando para cima', () => {
    expect(slotsCobertos('09:00', 30)).toEqual(['09:00']);
    expect(slotsCobertos('09:00', 90)).toEqual(['09:00', '09:30', '10:00']);
    expect(slotsCobertos('09:00', 45)).toEqual(['09:00', '09:30']);
    expect(slotsCobertos('13:30', 120)).toEqual(['13:30', '14:00', '14:30', '15:00']);
    expect(slotsCobertos('08:00', 210)).toHaveLength(7);
  });
});

describe('horarioLivreParaDuracao', () => {
  it('só é livre se nenhum dos horários cobertos está cheio', () => {
    const cheios = new Set(['10:00']);
    const cheio = (h: string) => cheios.has(h);
    expect(horarioLivreParaDuracao('09:00', 60, cheio)).toBe(true);
    expect(horarioLivreParaDuracao('09:00', 90, cheio)).toBe(false);
    expect(horarioLivreParaDuracao('10:30', 60, cheio)).toBe(true);
  });
});
