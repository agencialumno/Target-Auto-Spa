export const dataCurta = (chave: string) =>
  new Date(chave + 'T12:00:00')
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace('.', '');

export const dataExtensa = (chave: string) =>
  new Date(chave + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

// "agora", "há 5 min", "há 2 h", "há 3 dias" ou a data
export function tempoRelativo(ms: number, agora = Date.now()) {
  const seg = Math.max(0, Math.round((agora - ms) / 1000));
  if (seg < 60) return 'agora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return new Date(ms).toLocaleDateString('pt-BR');
}