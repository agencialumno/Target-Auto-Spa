// Lista de conversas do gerente: rótulos e ordenação (puro, sem rede).
import type { Conversa } from './app.svelte';

const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dois = (n: number) => String(n).padStart(2, '0');

// Hoje: só a hora (HH:MM). Antes de hoje: a data (dd/mm; com o ano se não for o ano atual).
export function rotuloQuando(d: Date | null, agora = new Date()): string {
  if (!d) return '';
  if (mesmoDia(d, agora)) return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
  const base = `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
  return d.getFullYear() === agora.getFullYear() ? base : `${base}/${d.getFullYear()}`;
}

export function resumir(texto: string, max = 60): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Mais recente primeiro; sem data vai para o fim
export const ordenarConversas = (cs: Conversa[]): Conversa[] =>
  [...cs].sort((a, b) => (b.ultimaHora?.getTime() ?? -Infinity) - (a.ultimaHora?.getTime() ?? -Infinity));

export const contadorNovas = (n: number) => (n > 99 ? '99+' : String(n));

export const textoNovas = (n: number) => (n === 1 ? '1 mensagem nova' : `${n} mensagens novas`);

export type EstadoChat = 'carregando' | 'pronto' | 'erro';

// Hora da bolha: hoje só a hora; antes de hoje, data + hora
export function rotuloMensagem(criadoEm: Date | null, hora: string, agora = new Date()): string {
  if (!criadoEm || mesmoDia(criadoEm, agora)) return hora;
  return `${rotuloQuando(criadoEm, agora)} ${hora}`;
}
