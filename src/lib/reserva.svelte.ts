import { getServico, BUFFER_MIN, type Servico } from './mock';

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

  // Sem desconto por enquanto: o total do agendamento é a soma exata dos preços do catálogo
  // (o firestore.rules exige total == soma dos itens). Desconto de nível/plano precisa de servidor.
  get total() {
    return this.itens.reduce((soma, s) => soma + s.precoCentavos, 0) / 100;
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