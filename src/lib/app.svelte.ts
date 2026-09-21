import { chaveData } from './agenda';
import { planos, angulos360, getServico } from './mock';
import { gastoJanela, nivelAtual, proximoNivel, type Compra } from './niveis';
import { dataCurta } from './formato';

export type Status = 'agendado' | 'em-atendimento' | 'finalizado';
export type Fase = 'antes' | 'depois';

export const ordemStatus: Status[] = ['agendado', 'em-atendimento', 'finalizado'];

export const rotuloStatus: Record<Status, string> = {
  agendado: 'Agendado',
  'em-atendimento': 'Em atendimento',
  finalizado: 'Finalizado'
};

export type Avaliacao = { nota: number; nps: number; comentario: string };

export type Agendamento = {
  id: string;
  servicos: string[];
  data: string; // aaaa-mm-dd
  hora: string;
  total: number;
  status: Status;
  avaliacao?: Avaliacao;
  cliente?: string;
  carro?: string;
  placa?: string;
  fotos?: Record<string, string>; // chave "antes:Frente" -> imagem em base64
};

// lida = false significa "ainda não vista por quem recebeu"
export type Mensagem = { de: 'cliente' | 'gerente'; texto: string; hora: string; lida?: boolean };

export type Notificacao = {
  id: string;
  tipo: 'agendamento' | 'status' | 'foto' | 'mensagem';
  titulo: string;
  texto: string;
  quando: number; // milissegundos
  lida: boolean;
  agendamentoId?: string;
};

const CHAVE = 'target-auto-spa-demo-v1';
const MAX_NOTIFICACOES = 50;

// Dados de exemplo até existir o cadastro de cliente e de veículo
const CLIENTE_DEMO = { cliente: 'Cliente exemplo', carro: 'Carro exemplo', placa: 'ABC1D23' };

const horaAgora = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const diasAtras = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return chaveData(d);
};

const nomesDe = (ids: string[]) =>
  ids
    .map((id) => getServico(id)?.nome)
    .filter(Boolean)
    .join(' + ');

const inicial = () => ({
  agendamentos: [] as Agendamento[],
  // Uma compra recente e uma antiga (fora dos 90 dias), só para a demonstração
  compras: [
    { data: diasAtras(20), valor: 120 },
    { data: diasAtras(200), valor: 500 }
  ] as Compra[],
  planoId: null as string | null,
  mensagens: [
    {
      de: 'gerente',
      texto: 'Olá! Sou o gerente do seu condomínio. Como posso ajudar?',
      hora: horaAgora(),
      lida: true
    }
  ] as Mensagem[],
  notificacoes: [] as Notificacao[]
});

class App {
  agendamentos = $state<Agendamento[]>([]);
  compras = $state<Compra[]>([]);
  planoId = $state<string | null>(null);
  mensagens = $state<Mensagem[]>([]);
  notificacoes = $state<Notificacao[]>([]);

  constructor() {
    const base = inicial();
    let dados = base;
    try {
      const bruto = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAVE) : null;
      if (bruto) dados = { ...base, ...JSON.parse(bruto) };
    } catch {
      dados = base;
    }
    this.agendamentos = dados.agendamentos;
    this.compras = dados.compras;
    this.planoId = dados.planoId;
    this.mensagens = dados.mensagens;
    this.notificacoes = dados.notificacoes;
  }

  get gasto() {
    return gastoJanela(this.compras);
  }

  get nivel() {
    return nivelAtual(this.gasto);
  }

  get proximo() {
    return proximoNivel(this.gasto);
  }

  get plano() {
    return planos.find((p) => p.id === this.planoId) ?? null;
  }

  // ---- Contadores (o número em cima dos ícones) ----
  get msgNaoLidasCliente() {
    return this.mensagens.filter((m) => m.de === 'gerente' && m.lida === false).length;
  }

  get msgNaoLidasGerente() {
    return this.mensagens.filter((m) => m.de === 'cliente' && m.lida === false).length;
  }

  get naoLidasNotif() {
    return this.notificacoes.filter((n) => !n.lida).length;
  }

  // ---- Indicadores para o administrador ----
  get receita() {
    return this.agendamentos.reduce((soma, a) => soma + a.total, 0);
  }

  get avaliados() {
    return this.agendamentos.filter((a) => a.avaliacao);
  }

  get notaMedia() {
    const lista = this.avaliados;
    if (!lista.length) return null;
    return lista.reduce((soma, a) => soma + (a.avaliacao?.nota ?? 0), 0) / lista.length;
  }

  // NPS = % de promotores (9-10) menos % de detratores (0-6)
  get nps() {
    const lista = this.avaliados;
    if (!lista.length) return null;
    const promotores = lista.filter((a) => (a.avaliacao?.nps ?? 0) >= 9).length;
    const detratores = lista.filter((a) => (a.avaliacao?.nps ?? 0) <= 6).length;
    return Math.round(((promotores - detratores) / lista.length) * 100);
  }

  private salvar() {
    try {
      localStorage.setItem(
        CHAVE,
        JSON.stringify({
          agendamentos: this.agendamentos,
          compras: this.compras,
          planoId: this.planoId,
          mensagens: this.mensagens,
          notificacoes: this.notificacoes
        })
      );
    } catch {
      // sem espaço ou sem armazenamento: a demo continua funcionando na memória
    }
  }

  private notificar(n: Pick<Notificacao, 'tipo' | 'titulo' | 'texto' | 'agendamentoId'>) {
    this.notificacoes.unshift({
      id: `nt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      quando: Date.now(),
      lida: false,
      ...n
    });
    if (this.notificacoes.length > MAX_NOTIFICACOES) {
      this.notificacoes = this.notificacoes.slice(0, MAX_NOTIFICACOES);
    }
  }

  criarAgendamento(dados: { servicos: string[]; data: string; hora: string; total: number }) {
    const id = `ag-${Date.now()}`;
    this.agendamentos.unshift({ id, ...dados, ...CLIENTE_DEMO, status: 'agendado', fotos: {} });
    this.compras.push({ data: chaveData(new Date()), valor: dados.total });
    this.notificar({
      tipo: 'agendamento',
      titulo: 'Agendamento confirmado',
      texto: `${nomesDe(dados.servicos)} · ${dataCurta(dados.data)} às ${dados.hora}`,
      agendamentoId: id
    });
    this.salvar();
    return id;
  }

  // Avança sem regras. Usado pelo botão de demo do cliente e pelo instalador de insulfilm
  avancar(id: string) {
    const ag = this.agendamentos.find((a) => a.id === id);
    if (!ag) return;
    const i = ordemStatus.indexOf(ag.status);
    if (i < ordemStatus.length - 1) {
      ag.status = ordemStatus[i + 1];
      const nomes = nomesDe(ag.servicos);
      if (ag.status === 'em-atendimento') {
        this.notificar({
          tipo: 'status',
          titulo: 'Atendimento iniciado',
          texto: `${nomes}: nossa equipe começou a cuidar do seu carro.`,
          agendamentoId: ag.id
        });
      } else if (ag.status === 'finalizado') {
        this.notificar({
          tipo: 'status',
          titulo: 'Serviço finalizado',
          texto: `${nomes}: seu carro está pronto. Conte como foi na avaliação!`,
          agendamentoId: ag.id
        });
      }
    }
    this.salvar();
  }

  // Avanço do gerente: exige as fotos 360º completas. Devolve a mensagem de erro, ou null se deu certo
  avancarComRegras(id: string): string | null {
    const ag = this.agendamentos.find((a) => a.id === id);
    if (!ag) return 'Agendamento não encontrado.';

    if (ag.status === 'agendado') {
      const feitas = this.fotosFeitas(ag, 'antes');
      if (feitas < angulos360.length) {
        return `Faltam fotos de "Como chegou" (${feitas}/${angulos360.length}).`;
      }
    }
    if (ag.status === 'em-atendimento') {
      const feitas = this.fotosFeitas(ag, 'depois');
      if (feitas < angulos360.length) {
        return `Faltam fotos de "Como saiu" (${feitas}/${angulos360.length}).`;
      }
    }
    this.avancar(id);
    return null;
  }

  fotosFeitas(ag: Agendamento, fase: Fase) {
    return angulos360.filter((a) => ag.fotos?.[`${fase}:${a}`]).length;
  }

  salvarFoto(id: string, fase: Fase, angulo: string, imagem: string) {
    const ag = this.agendamentos.find((a) => a.id === id);
    if (!ag) return;
    const antes = this.fotosFeitas(ag, fase);
    ag.fotos = { ...(ag.fotos ?? {}), [`${fase}:${angulo}`]: imagem };
    const depois = this.fotosFeitas(ag, fase);

    // Avisa o cliente uma única vez, quando o checklist da etapa fica completo
    if (antes < angulos360.length && depois === angulos360.length) {
      this.notificar({
        tipo: 'foto',
        titulo: fase === 'antes' ? 'Fotos da chegada registradas' : 'Fotos da saída registradas',
        texto: `O checklist 360º (${fase === 'antes' ? 'como chegou' : 'como saiu'}) do seu carro está completo.`,
        agendamentoId: ag.id
      });
    }
    this.salvar();
  }

  avaliar(id: string, avaliacao: Avaliacao) {
    const ag = this.agendamentos.find((a) => a.id === id);
    if (!ag) return;
    ag.avaliacao = avaliacao;
    this.salvar();
  }

  assinar(planoId: string | null) {
    this.planoId = planoId;
    this.salvar();
  }

  // Mensagem do cliente: fica "não lida" para o gerente
  enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo) return;
    this.mensagens.push({ de: 'cliente', texto: limpo, hora: horaAgora(), lida: false });
    this.salvar();
    // Resposta automática só para a demonstração
    setTimeout(() => {
      const resposta = 'Recebi sua mensagem. Já verifico e te respondo por aqui.';
      this.mensagens.push({ de: 'gerente', texto: resposta, hora: horaAgora(), lida: false });
      this.notificar({ tipo: 'mensagem', titulo: 'Nova mensagem do gerente', texto: resposta });
      this.salvar();
    }, 1200);
  }

  // Resposta escrita pelo gerente na tela dele: fica "não lida" para o cliente
  responder(texto: string) {
    const limpo = texto.trim();
    if (!limpo) return;
    this.mensagens.push({ de: 'gerente', texto: limpo, hora: horaAgora(), lida: false });
    this.notificar({ tipo: 'mensagem', titulo: 'Nova mensagem do gerente', texto: limpo });
    this.salvar();
  }

  // Marca como lidas as mensagens que chegaram para quem abriu a conversa
  lerMensagens(para: 'cliente' | 'gerente') {
    const remetente = para === 'cliente' ? 'gerente' : 'cliente';
    let mudou = false;
    for (const m of this.mensagens) {
      if (m.de === remetente && m.lida === false) {
        m.lida = true;
        mudou = true;
      }
    }
    if (para === 'cliente') {
      for (const n of this.notificacoes) {
        if (n.tipo === 'mensagem' && !n.lida) {
          n.lida = true;
          mudou = true;
        }
      }
    }
    if (mudou) this.salvar();
  }

  marcarLida(id: string) {
    const n = this.notificacoes.find((x) => x.id === id);
    if (n && !n.lida) {
      n.lida = true;
      this.salvar();
    }
  }

  marcarTodasLidas() {
    for (const n of this.notificacoes) n.lida = true;
    this.salvar();
  }

  resetar() {
    const base = inicial();
    this.agendamentos = base.agendamentos;
    this.compras = base.compras;
    this.planoId = base.planoId;
    this.mensagens = base.mensagens;
    this.notificacoes = base.notificacoes;
    this.salvar();
  }
}

export const app = new App();