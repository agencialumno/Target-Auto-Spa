import { DEPURACAO } from './config';

const MAX = 30;

class Depuracao {
  linhas = $state<string[]>([]);
  private iniciado = false;

  registrar(texto: string) {
    if (!DEPURACAO) return;
    const hora = new Date().toLocaleTimeString('pt-BR');
    this.linhas = [`${hora} ${texto}`, ...this.linhas].slice(0, MAX);
  }

  // Captura erros globais e console.error; chamado uma vez no layout raiz
  iniciar() {
    if (!DEPURACAO || this.iniciado || typeof window === 'undefined') return;
    this.iniciado = true;

    window.addEventListener('error', (e) => {
      this.registrar(`onerror: ${e.message} (${e.filename?.split('/').pop()}:${e.lineno})`);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const r: any = e.reason;
      this.registrar(`unhandledrejection: ${r?.code ?? ''} ${r?.message ?? String(r)}`);
    });

    const original = console.error;
    console.error = (...args: unknown[]) => {
      this.registrar(
        'console.error: ' +
          args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' ')
      );
      original.apply(console, args);
    };
    this.registrar('depuração iniciada');
  }
}

export const depuracao = new Depuracao();
