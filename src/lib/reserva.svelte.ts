import { getServico, BUFFER_MIN, type Servico } from './mock';
import { app } from './app.svelte';

class Reserva {
  principalId = $state<string | null>(null);
  extras = $state<string[]>([]);
  data = $state<string | null>(null);
  hora = $state<string | null>(null);

  get principal(): Servico | undefined {
    return this.principalId ? getServico(this.principalId) : undefined;
  }

  get itens(): Servico[] {
    const lista = [this.principal, ...this.extras.map(getServico)];
    return lista.filter((s): s is Servico => !!s);
  }

  get avulso() {
    return this.principal?.avulso ?? false;
  }

  get duracaoTotal() {
    return this.itens.reduce((soma, s) => soma + s.duracao, 0);
  }

  get slotTotal() {
    return this.duracaoTotal + BUFFER_MIN;
  }

  get subtotal() {
    return this.itens.reduce((soma, s) => soma + s.preco, 0);
  }

  // Desconto do nível ou da assinatura: vale o maior, sem acumular
  get descontoPct() {
    return Math.max(app.nivel.desconto, app.plano?.desconto ?? 0);
  }

  get valorDesconto() {
    const base = this.itens
      .filter((s) => !s.semDesconto)
      .reduce((soma, s) => soma + s.preco, 0);
    return Math.round(base * this.descontoPct) / 100;
  }

  get total() {
    return this.subtotal - this.valorDesconto;
  }

  escolher(id: string) {
    this.principalId = id;
    this.extras = [];
    this.data = null;
    this.hora = null;
  }

  alternarExtra(id: string) {
    this.extras = this.extras.includes(id)
      ? this.extras.filter((e) => e !== id)
      : [...this.extras, id];
    this.hora = null;
  }

  reiniciar() {
    this.principalId = null;
    this.extras = [];
    this.data = null;
    this.hora = null;
  }
}

export const reserva = new Reserva();