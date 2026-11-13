// Estado de um bloco do dashboard: carregando, pronto, vazio ou erro. Cada bloco é independente:
// um que falha ou trava não afeta os outros. Toda leitura tem tempo limite.
export const TEMPO_LIMITE_MS = 15_000;

export type EstadoBloco = 'carregando' | 'pronto' | 'vazio' | 'erro';

const DICAS: Record<string, string> = {
  'failed-precondition': 'índice do Firestore faltando',
  'permission-denied': 'regra do Firestore bloqueou a leitura',
  unavailable: 'sem conexão com o Firestore',
  timeout: 'tempo esgotado (15 s)'
};

export class ErroTempo extends Error {
  code = 'timeout';
  constructor() {
    super('timeout');
  }
}

export function descreverErro(e: unknown): string {
  const code = (e as { code?: string })?.code;
  const nome = typeof code === 'string' ? code.replace(/^firestore\//, '') : 'desconhecido';
  const dica = DICAS[nome];
  return dica ? `Não foi possível carregar (${nome}: ${dica}).` : `Não foi possível carregar (${nome}).`;
}

export function comTempo<T>(p: Promise<T>, ms = TEMPO_LIMITE_MS): Promise<T> {
  return new Promise<T>((ok, falha) => {
    const t = setTimeout(() => falha(new ErroTempo()), ms);
    p.then(
      (v) => (clearTimeout(t), ok(v)),
      (e) => (clearTimeout(t), falha(e))
    );
  });
}

export class Bloco<T> {
  estado = $state<EstadoBloco>('carregando');
  dados = $state<T | null>(null);
  erro = $state('');
  atualizadoEm = $state<Date | null>(null);
  private fn: () => Promise<T>;
  private vazio: (d: T) => boolean;
  private ms: number;
  private geracao = 0;

  constructor(fn: () => Promise<T>, vazio: (d: T) => boolean = () => false, ms = TEMPO_LIMITE_MS) {
    this.fn = fn;
    this.vazio = vazio;
    this.ms = ms;
  }

  // Resposta de uma carga antiga (período já trocado) é descartada
  async carregar(): Promise<void> {
    const minha = ++this.geracao;
    this.estado = 'carregando';
    this.erro = '';
    try {
      const d = await comTempo(Promise.resolve().then(this.fn), this.ms);
      if (minha !== this.geracao) return;
      this.dados = d;
      this.atualizadoEm = new Date();
      this.estado = this.vazio(d) ? 'vazio' : 'pronto';
    } catch (e) {
      if (minha !== this.geracao) return;
      this.erro = descreverErro(e);
      this.estado = 'erro';
    }
  }
}
