import { BUFFER_MIN } from './mock';

export const ABERTURA = 8 * 60; // 08:00
export const FECHAMENTO = 18 * 60; // 18:00
export const ANTECEDENCIA_INSULFILM_H = 36;
const HORARIOS_INSULFILM = ['09:00', '11:00', '14:00', '16:00'];

export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const chaveData = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function proximosDias(n: number, inicio = new Date()): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(inicio);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Horários livres de lavagem/estética.
 * Cada atendimento ocupa: duração total + intervalo de 15 min.
 * Lavagem simples: 30 + 15 = 45 min.
 */
export function horariosLavagem(
  data: Date,
  duracaoTotal: number,
  agora = new Date()
): string[] {
  const slot = duracaoTotal + BUFFER_MIN;
  const ehHoje = chaveData(agora) === chaveData(data);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const livres: string[] = [];

  for (let t = ABERTURA; t + duracaoTotal <= FECHAMENTO; t += slot) {
    if (ehHoje && t <= agoraMin) continue;
    livres.push(hhmm(t));
  }
  return livres;
}

/**
 * Insulfilm: agenda própria (profissional externo).
 * Só aceita horários com pelo menos 36 h de antecedência.
 */
export function horariosInsulfilm(data: Date, agora = new Date()): string[] {
  const limite = agora.getTime() + ANTECEDENCIA_INSULFILM_H * 3600 * 1000;
  return HORARIOS_INSULFILM.filter((h) => {
    const [hh, mm] = h.split(':').map(Number);
    const dt = new Date(data);
    dt.setHours(hh, mm, 0, 0);
    return dt.getTime() >= limite;
  });
}