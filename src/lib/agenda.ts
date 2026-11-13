export const ABERTURA = 8 * 60; // 08:00
export const FECHAMENTO = 18 * 60; // 18:00
// Grade fixa de horários de início: todos disputam as mesmas vagas (um documento por horário)
export const GRADE_MIN = 30;
export const ANTECEDENCIA_INSULFILM_H = 36;
const HORARIOS_INSULFILM = ['09:00', '11:00', '14:00', '16:00'];

// Horários de 30 min que um serviço cobre a partir de `hora` (90 min às 09:00 -> 09:00, 09:30, 10:00).
// O servidor reserva exatamente estes (api-vercel/_lib/agendamento.js: slotsCobertos).
export function slotsCobertos(hora: string, duracaoMin: number): string[] {
  const [h, m] = hora.split(':').map(Number);
  const n = Math.max(1, Math.ceil(duracaoMin / GRADE_MIN));
  return Array.from({ length: n }, (_, k) => hhmm(h * 60 + m + k * GRADE_MIN));
}

// Um horário só é livre se TODOS os horários que o serviço precisa estão livres
export const horarioLivreParaDuracao = (hora: string, duracaoMin: number, cheio: (hora: string) => boolean) =>
  slotsCobertos(hora, duracaoMin).every((h) => !cheio(h));

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
 * Horários de início em grade de 30 min, desde que o serviço termine até o fechamento.
 * A capacidade de cada horário (vagas simultâneas) é do condomínio e fica em /ocupacao.
 */
export function horariosLavagem(
  data: Date,
  duracaoTotal: number,
  agora = new Date()
): string[] {
  const ehHoje = chaveData(agora) === chaveData(data);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const livres: string[] = [];

  for (let t = ABERTURA; t + duracaoTotal <= FECHAMENTO; t += GRADE_MIN) {
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