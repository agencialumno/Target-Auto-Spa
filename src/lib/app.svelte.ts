// Estado do app sobre o Firestore e o Storage: agendamentos, chat e notificações.
// Cada papel escuta só o que as regras deixam ler (cliente: os próprios; gerente: do condomínio;
// funcionário: os atribuídos a ele; admin: todos). Nada de dados de exemplo.
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import { getDownloadURL, ref as refStorage, uploadBytes } from 'firebase/storage';
import { openUrl } from '@tauri-apps/plugin-opener';
import { db, storage } from './firebase';
import { chamarApi } from './api';
import { angulos360 } from './mock';
import { getServico } from './catalogo.svelte';
import { gastoJanela, nivelAtual, proximoNivel, type Compra } from './niveis';
import { dataCurta } from './formato';
import {
  caminhoFoto,
  chaveFoto,
  faltamFotos,
  fotosFeitas,
  idVaga,
  lerAgendamento,
  montarVaga,
  montarAgendamento,
  nomesItens,
  proximoStatus,
  type Agendamento,
  type Avaliacao,
  type Fase,
  type Item,
  type NovoAgendamento,
  type Status,
  type Veiculo,
  aguardaConfirmacaoPagamento
} from './agendamentos';

export { ordemStatus, rotuloStatus } from './agendamentos';
export type { Agendamento, Avaliacao, Fase, Status } from './agendamentos';

// lida = false significa "ainda não vista por quem recebeu"
export type Mensagem = {
  id: string;
  de: 'cliente' | 'gerente';
  texto: string;
  hora: string;
  lida?: boolean;
  criadoEm: Date | null;
};

export type Conversa = {
  id: string; // uid do cliente
  clienteNome: string;
  condominioId: string;
  ultimaMensagem: string;
  ultimaHora: Date | null;
  naoLidasGerente: number;
  naoLidasCliente: number;
};

export type Funcionario = { uid: string; nome: string; especialidade: string | null };

// Vaga de horário ocupada (sem dado pessoal): o app só conta quantas há por horário
export type Vaga = { id: string; data: string; hora: string; externo: boolean };

export type Notificacao = {
  id: string;
  tipo: 'agendamento' | 'status' | 'foto' | 'mensagem';
  titulo: string;
  texto: string;
  quando: number; // milissegundos
  lida: boolean;
  agendamentoId?: string;
};

type Sessao = { uid: string; nome: string; role: string; condominioId: string | null };

const MAX_NOTIFICACOES = 50;
const chaveNotificacoes = (uid: string) => `target-auto-spa-notificacoes-v1-${uid}`;

const horaAgora = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const chaveHoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class App {
  agendamentos = $state<Agendamento[]>([]);
  mensagens = $state<Mensagem[]>([]);
  conversas = $state<Conversa[]>([]);
  conversaAtiva = $state<string | null>(null);
  notificacoes = $state<Notificacao[]>([]);
  funcionarios = $state<Funcionario[]>([]);
  carregado = $state(false);
  condominioNome = $state('');
  capacidade = $state(1); // vagas simultâneas por horário no condomínio
  capacidadeExterna = $state(1); // idem para o insulfilm (config/insulfilm)
  vagasRegulares = $state<Vaga[]>([]);
  vagasExternas = $state<Vaga[]>([]);
  erro = $state('');

  private sessao: Sessao | null = null;
  private paradas: Unsubscribe[] = [];
  private paradaMensagens: Unsubscribe | null = null;
  private conhecidos = new Map<string, Status>();
  private urls = new Map<string, string>();
  fotoUrls = $state<Record<string, string>>({});
  private meuChatNaoLidas = $state(0);

  // ---- Ciclo de vida ----
  iniciar(sessao: Sessao) {
    if (this.sessao?.uid === sessao.uid && this.sessao.role === sessao.role) return;
    this.parar();
    this.sessao = sessao;
    this.carregarNotificacoes();
    const ouvir = (u: Unsubscribe) => this.paradas.push(u);
    if (sessao.condominioId) {
      ouvir(
        onSnapshot(
          doc(db, 'condominios', sessao.condominioId),
          (d) => {
            if (!d?.exists()) return;
            this.condominioNome = String(d.data().nome ?? '');
            const c = d.data().capacidade;
            this.capacidade = Number.isInteger(c) && c >= 1 ? c : 1;
          },
          () => {}
        )
      );
    }
    const falha = (e: unknown) => {
      this.erro = `Não foi possível carregar os dados (${(e as { code?: string })?.code ?? 'erro'}).`;
    };

    const colecao = collection(db, 'agendamentos');
    let consulta = null;
    if (sessao.role === 'cliente') {
      consulta = query(colecao, where('clienteId', '==', sessao.uid), orderBy('inicio', 'desc'), limit(200));
    } else if (sessao.role === 'gerente' && sessao.condominioId) {
      consulta = query(colecao, where('condominioId', '==', sessao.condominioId), orderBy('inicio', 'desc'), limit(300));
    } else if (sessao.role === 'funcionario') {
      consulta = query(colecao, where('funcionarioId', '==', sessao.uid), orderBy('inicio', 'asc'), limit(200));
    } else if (sessao.role === 'admin') {
      consulta = query(colecao, orderBy('inicio', 'desc'), limit(1000));
    }
    if (consulta) {
      let primeira = true;
      ouvir(
        onSnapshot(
          consulta,
          (snap) => {
            this.agendamentos = snap.docs.map((d) => lerAgendamento(d.id, d.data()));
            if (!primeira && sessao.role === 'cliente') this.avisarMudancas();
            for (const a of this.agendamentos) this.conhecidos.set(a.id, a.status);
            primeira = false;
            this.carregado = true;
          },
          falha
        )
      );
    } else {
      this.carregado = true;
    }

    if (sessao.role === 'cliente' && sessao.condominioId) {
      // Horários cheios: vagas do condomínio e vagas do insulfilm, a partir de hoje
      const hoje = chaveHoje();
      const lerVagas = (snap: { docs: { id: string; data: () => any }[] }): Vaga[] =>
        snap.docs.map((d) => ({ id: d.id, data: d.data().data, hora: d.data().hora, externo: d.data().externo === true }));
      ouvir(
        onSnapshot(
          query(collection(db, 'ocupacao'), where('condominioId', '==', sessao.condominioId), where('externo', '==', false), where('data', '>=', hoje)),
          (snap) => (this.vagasRegulares = lerVagas(snap)),
          () => {}
        )
      );
      ouvir(
        onSnapshot(
          query(collection(db, 'ocupacao'), where('externo', '==', true), where('data', '>=', hoje)),
          (snap) => (this.vagasExternas = lerVagas(snap)),
          () => {}
        )
      );
      ouvir(
        onSnapshot(
          doc(db, 'config', 'insulfilm'),
          (d) => {
            const c = d?.exists() ? d.data().capacidade : 1;
            this.capacidadeExterna = Number.isInteger(c) && c >= 1 ? c : 1;
          },
          () => {}
        )
      );
    }

    if (sessao.role === 'cliente') {
      // Conversa do cliente: chatId = uid
      ouvir(
        onSnapshot(
          doc(db, 'chats', sessao.uid),
          (snap) => {
            this.meuChatNaoLidas = snap.exists() ? (snap.data().naoLidasCliente ?? 0) : 0;
          },
          () => {}
        )
      );
      this.abrirConversa(sessao.uid);
    }

    if (sessao.role === 'gerente' && sessao.condominioId) {
      ouvir(
        onSnapshot(
          query(collection(db, 'chats'), where('condominioId', '==', sessao.condominioId), orderBy('ultimaHora', 'desc'), limit(100)),
          (snap) => {
            this.conversas = snap.docs.map((d) => this.lerConversa(d.id, d.data()));
          },
          () => {}
        )
      );
      ouvir(
        onSnapshot(
          query(collection(db, 'users'), where('role', '==', 'funcionario')),
          (snap) => {
            this.funcionarios = snap.docs
              .map((d) => ({ uid: d.id, nome: String(d.data().nome ?? ''), especialidade: (d.data().especialidade as string | undefined) ?? null }))
              .sort((a, b) => a.nome.localeCompare(b.nome));
          },
          () => {}
        )
      );
    }
  }

  parar() {
    for (const u of this.paradas) u();
    this.paradas = [];
    this.paradaMensagens?.();
    this.paradaMensagens = null;
    this.sessao = null;
    this.agendamentos = [];
    this.mensagens = [];
    this.conversas = [];
    this.conversaAtiva = null;
    this.notificacoes = [];
    this.funcionarios = [];
    this.carregado = false;
    this.condominioNome = '';
    this.capacidade = 1;
    this.capacidadeExterna = 1;
    this.vagasRegulares = [];
    this.vagasExternas = [];
    this.erro = '';
    this.conhecidos.clear();
    this.urls.clear();
    this.fotoUrls = {};
    this.meuChatNaoLidas = 0;
  }

  private lerConversa(id: string, d: Record<string, any>): Conversa {
    return {
      id,
      clienteNome: d.clienteNome ?? '',
      condominioId: d.condominioId ?? '',
      ultimaMensagem: d.ultimaMensagem ?? '',
      ultimaHora: d.ultimaHora instanceof Timestamp ? d.ultimaHora.toDate() : null,
      naoLidasGerente: d.naoLidasGerente ?? 0,
      naoLidasCliente: d.naoLidasCliente ?? 0
    };
  }

  // ---- Indicadores ----
  get compras(): Compra[] {
    return this.agendamentos
      .filter((a) => a.status === 'finalizado' && a.clienteId === this.sessao?.uid)
      .map((a) => ({
        data: a.data,
        valor: a.total / 100
      }));
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

  get msgNaoLidasCliente() {
    return this.meuChatNaoLidas;
  }

  get msgNaoLidasGerente() {
    return this.conversas.reduce((soma, c) => soma + c.naoLidasGerente, 0);
  }

  get naoLidasNotif() {
    return this.notificacoes.filter((n) => !n.lida).length;
  }

  // Receita em centavos: só o que foi finalizado
  get receita() {
    return this.agendamentos.filter((a) => a.status === 'finalizado').reduce((soma, a) => soma + a.total, 0);
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
    const lista = this.avaliados.filter((a) => typeof a.avaliacao?.nps === 'number');
    if (!lista.length) return null;
    const promotores = lista.filter((a) => (a.avaliacao?.nps ?? 0) >= 9).length;
    const detratores = lista.filter((a) => (a.avaliacao?.nps ?? 0) <= 6).length;
    return Math.round(((promotores - detratores) / lista.length) * 100);
  }

  // ---- Notificações (só neste aparelho) ----
  private carregarNotificacoes() {
    try {
      const bruto = this.sessao ? localStorage.getItem(chaveNotificacoes(this.sessao.uid)) : null;
      this.notificacoes = bruto ? JSON.parse(bruto) : [];
    } catch {
      this.notificacoes = [];
    }
  }

  private salvarNotificacoes() {
    try {
      if (this.sessao) localStorage.setItem(chaveNotificacoes(this.sessao.uid), JSON.stringify(this.notificacoes));
    } catch {
      // sem armazenamento: as notificações ficam só na memória
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
    this.salvarNotificacoes();
  }

  // O gerente/funcionário mudou o andamento: avisa o cliente neste aparelho
  private avisarMudancas() {
    for (const a of this.agendamentos) {
      const antes = this.conhecidos.get(a.id);
      if (!antes || antes === a.status) continue;
      const nomes = nomesItens(a.itens);
      if (a.status === 'em_andamento') {
        this.notificar({
          tipo: 'status',
          titulo: 'Atendimento iniciado',
          texto: `${nomes}: nossa equipe começou a cuidar do seu carro.`,
          agendamentoId: a.id
        });
      } else if (a.status === 'finalizado') {
        this.notificar({
          tipo: 'status',
          titulo: 'Serviço finalizado',
          texto: `${nomes}: seu carro está pronto. Conte como foi na avaliação!`,
          agendamentoId: a.id
        });
      }
    }
  }

  marcarLida(id: string) {
    const n = this.notificacoes.find((x) => x.id === id);
    if (n && !n.lida) {
      n.lida = true;
      this.salvarNotificacoes();
    }
  }

  marcarTodasLidas() {
    for (const n of this.notificacoes) n.lida = true;
    this.salvarNotificacoes();
  }

  // ---- Agendamentos ----
  // Cria o agendamento. O preço de cada item é o do catálogo publicado no Firestore (as regras conferem).
  async criarAgendamento(dados: {
    servicos: string[];
    data: string;
    hora: string;
    veiculo: Veiculo;
    observacoes?: string;
  }): Promise<string> {
    const s = this.sessao;
    if (!s || s.role !== 'cliente' || !s.condominioId) throw new Error('Entre em um condomínio para agendar.');
    const itens: Item[] = dados.servicos.map((id) => {
      const sv = getServico(id);
      if (!sv?.publicado || sv.ativo === false) throw new Error('Serviço indisponível no momento.');
      return { servicoId: sv.id, nome: sv.nome, precoCentavos: sv.precoCentavos };
    });
    // Externo (insulfilm): vem da categoria do catálogo; as regras conferem. Misturar com outro serviço é negado.
    const ehIns = (id: string) => getServico(id)?.categoria === 'insulfilm';
    const externo = itens.every((i) => ehIns(i.servicoId));
    if (!externo && itens.some((i) => ehIns(i.servicoId))) {
      throw new Error('Insulfilm precisa ser agendado separado dos outros serviços.');
    }
    const alvo = { externo, condominioId: s.condominioId, data: dados.data, hora: dados.hora };
    const ref = doc(collection(db, 'agendamentos'));
    const capacidade = externo ? this.capacidadeExterna : this.capacidade;

    // Tenta a vaga 1..capacidade. O agendamento e a vaga vão no mesmo batch: se outra pessoa pegou a
    // vaga, o batch inteiro é recusado e passamos à próxima.
    for (let n = 1; n <= capacidade; n++) {
      const vagaId = idVaga(alvo, n);
      const novo: NovoAgendamento = {
        clienteId: s.uid,
        clienteNome: s.nome || 'Cliente',
        condominioId: s.condominioId,
        itens,
        data: dados.data,
        hora: dados.hora,
        veiculo: dados.veiculo,
        observacoes: dados.observacoes,
        externo,
        vagaId
      };
      const lote = writeBatch(db);
      lote.set(ref, montarAgendamento(novo, serverTimestamp()));
      lote.set(doc(db, 'ocupacao', vagaId), montarVaga(alvo, ref.id));
      try {
        await lote.commit();
        this.notificar({
          tipo: 'agendamento',
          titulo: 'Agendamento confirmado',
          texto: `${nomesItens(itens)} · ${dataCurta(dados.data)} às ${dados.hora}`,
          agendamentoId: ref.id
        });
        return ref.id;
      } catch (e) {
        // Só segue para a próxima vaga se esta já existe; outro erro (preço mudou, sem rede) é repassado
        const ocupada = await getDoc(doc(db, 'ocupacao', vagaId)).then((d) => !!d?.exists()).catch(() => false);
        if (!ocupada) throw e;
      }
    }
    throw new Error('Horário indisponível. Escolha outro horário.');
  }

  // Horário cheio: todas as vagas do horário (1..capacidade) já existem
  horarioCheio(data: string, hora: string, externo: boolean): boolean {
    const vagas = externo ? this.vagasExternas : this.vagasRegulares;
    const ocupadas = vagas.filter((v) => v.data === data && v.hora === hora).length;
    return ocupadas >= (externo ? this.capacidadeExterna : this.capacidade);
  }

  // Cria (ou recupera) o Checkout do Asaas. Idempotente no servidor: devolve o mesmo link enquanto aberto.
  async criarCheckout(id: string): Promise<{ link: string; venceEm: string }> {
    return chamarApi('criar', { agendamentoId: id }, 'pagamento');
  }

  // Inicia o prazo de 15 min logo ao agendar, sem abrir nada; se falhar, o botão "Pagar" tenta de novo
  async prepararPagamento(id: string) {
    try {
      await this.criarCheckout(id);
    } catch {
      // sem rede ou serviço fora: a tela de pagamento oferece "Pagar agora"
    }
  }

  // Abre o pagamento no NAVEGADOR DO SISTEMA, nunca no WebView do app (cartão fora do nosso app)
  async pagar(id: string) {
    const { link } = await this.criarCheckout(id);
    if (!/^https:\/\//.test(link)) throw new Error('Link de pagamento inválido.');
    await openUrl(link);
  }

  // Rede de segurança do webhook: pede ao servidor para conferir no Asaas os pagamentos que o app ainda
  // mostra como pendentes. O servidor grava; o selo "Pago" chega pelo Firestore em tempo real.
  private sincronizandoPagamento = new Map<string, number>();
  async sincronizarPagamentos() {
    if (this.sessao?.role !== 'cliente') return;
    const agora = Date.now();
    const alvos = this.agendamentos.filter(
      (a) => a.clienteId === this.sessao?.uid && aguardaConfirmacaoPagamento(a) && agora - (this.sincronizandoPagamento.get(a.id) ?? 0) > 4000
    );
    await Promise.all(
      alvos.map(async (a) => {
        this.sincronizandoPagamento.set(a.id, agora);
        try {
          await chamarApi('status', { agendamentoId: a.id }, 'pagamento');
        } catch {
          // sem rede ou serviço fora: tenta de novo na próxima vez que o app voltar ao primeiro plano
        }
      })
    );
  }

  // Cancela e libera a vaga no mesmo batch
  async cancelar(id: string) {
    const ag = this.agendamentos.find((a) => a.id === id);
    const lote = writeBatch(db);
    lote.update(doc(db, 'agendamentos', id), { status: 'cancelado', atualizadoEm: serverTimestamp() });
    if (ag?.vagaId) lote.delete(doc(db, 'ocupacao', ag.vagaId));
    await lote.commit();
  }

  fotosFeitas(ag: Agendamento, fase: Fase) {
    return fotosFeitas(ag, fase, angulos360);
  }

  // Avanço de gerente/funcionário: exige as 8 fotos da etapa. Devolve a mensagem de erro, ou null se deu certo
  async avancarComRegras(id: string): Promise<string | null> {
    const ag = this.agendamentos.find((a) => a.id === id);
    if (!ag) return 'Agendamento não encontrado.';
    const falta = faltamFotos(ag, angulos360);
    if (falta) return falta;
    const proximo = proximoStatus(ag.status);
    if (!proximo) return null;
    try {
      await updateDoc(doc(db, 'agendamentos', id), { status: proximo, atualizadoEm: serverTimestamp() });
      return null;
    } catch (e) {
      return `Não foi possível atualizar (${(e as { code?: string })?.code ?? 'erro'}).`;
    }
  }

  // Externos (insulfilm) só vão para quem tem a especialidade; as regras também conferem
  funcionariosPara(ag: Agendamento): Funcionario[] {
    return ag.externo ? this.funcionarios.filter((f) => f.especialidade === 'insulfilm') : this.funcionarios;
  }

  async atribuirFuncionario(id: string, funcionario: Funcionario | null) {
    await updateDoc(doc(db, 'agendamentos', id), {
      funcionarioId: funcionario?.uid ?? null,
      funcionarioNome: funcionario?.nome ?? null,
      atualizadoEm: serverTimestamp()
    });
  }

  // Envia a foto ao Storage e grava só o caminho no documento (nunca a imagem)
  async salvarFoto(id: string, fase: Fase, angulo: string, imagem: Blob) {
    const caminho = caminhoFoto(id, fase, angulo);
    await uploadBytes(refStorage(storage, caminho), imagem, { contentType: 'image/jpeg' });
    await updateDoc(doc(db, 'agendamentos', id), {
      [`checklist.fotos.${chaveFoto(fase, angulo)}`]: { path: caminho, em: Timestamp.now() },
      atualizadoEm: serverTimestamp()
    });
    this.urls.delete(caminho);
  }

  // Endereço de download da foto (cacheado). Dispara a busca na primeira chamada.
  urlFoto(path: string): string | undefined {
    const pronta = this.fotoUrls[path];
    if (pronta) return pronta;
    if (!this.urls.has(path)) {
      this.urls.set(path, '');
      getDownloadURL(refStorage(storage, path))
        .then((u) => {
          this.urls.set(path, u);
          this.fotoUrls = { ...this.fotoUrls, [path]: u };
        })
        .catch(() => this.urls.delete(path));
    }
    return undefined;
  }

  async avaliar(id: string, avaliacao: Avaliacao) {
    await updateDoc(doc(db, 'agendamentos', id), {
      avaliacao: {
        nota: Math.round(avaliacao.nota),
        ...(typeof avaliacao.nps === 'number' ? { nps: Math.round(avaliacao.nps) } : {}),
        comentario: avaliacao.comentario.slice(0, 500),
        em: serverTimestamp()
      },
      atualizadoEm: serverTimestamp()
    });
  }

  // ---- Chat ----
  // Cliente: a conversa é a dele (chatId = uid). Gerente/admin: escolhem a conversa.
  abrirConversa(chatId: string) {
    if (this.conversaAtiva === chatId) return;
    this.paradaMensagens?.();
    this.conversaAtiva = chatId;
    this.mensagens = [];
    let primeira = true;
    this.paradaMensagens = onSnapshot(
      query(collection(db, 'chats', chatId, 'mensagens'), orderBy('criadoEm', 'asc'), limit(500)),
      (snap) => {
        this.mensagens = snap.docs.map((d) => {
          const m = d.data();
          return {
            id: d.id,
            de: m.de,
            texto: m.texto,
            hora: m.hora,
            lida: m.lida,
            criadoEm: m.criadoEm instanceof Timestamp ? m.criadoEm.toDate() : null
          };
        });
        if (!primeira && this.sessao?.role === 'cliente') {
          for (const c of snap.docChanges()) {
            const m = c.doc.data();
            if (c.type === 'added' && m.de === 'gerente' && !c.doc.metadata.hasPendingWrites) {
              this.notificar({ tipo: 'mensagem', titulo: 'Nova mensagem do gerente', texto: String(m.texto).slice(0, 120) });
            }
          }
        }
        primeira = false;
      },
      () => {}
    );
  }

  fecharConversa() {
    this.paradaMensagens?.();
    this.paradaMensagens = null;
    this.conversaAtiva = null;
    this.mensagens = [];
  }

  private async garantirConversa(chatId: string) {
    const s = this.sessao;
    if (!s || s.role !== 'cliente' || chatId !== s.uid || !s.condominioId) return;
    const ref = doc(db, 'chats', chatId);
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, { clienteId: s.uid, clienteNome: s.nome || 'Cliente', condominioId: s.condominioId });
    }
  }

  // Mensagem do cliente: fica "não lida" para o gerente
  async enviar(texto: string) {
    const limpo = texto.trim();
    const s = this.sessao;
    if (!limpo || !s) return;
    await this.garantirConversa(s.uid);
    const lote = writeBatch(db);
    lote.set(doc(collection(db, 'chats', s.uid, 'mensagens')), {
      de: 'cliente',
      texto: limpo.slice(0, 2000),
      hora: horaAgora(),
      lida: false,
      criadoEm: serverTimestamp()
    });
    lote.update(doc(db, 'chats', s.uid), {
      ultimaMensagem: limpo.slice(0, 200),
      ultimaHora: serverTimestamp(),
      naoLidasGerente: increment(1)
    });
    await lote.commit();
  }

  // Resposta do gerente (ou admin) na conversa aberta: fica "não lida" para o cliente
  async responder(texto: string) {
    const limpo = texto.trim();
    const chatId = this.conversaAtiva;
    if (!limpo || !chatId) return;
    const lote = writeBatch(db);
    lote.set(doc(collection(db, 'chats', chatId, 'mensagens')), {
      de: 'gerente',
      texto: limpo.slice(0, 2000),
      hora: horaAgora(),
      lida: false,
      criadoEm: serverTimestamp()
    });
    lote.update(doc(db, 'chats', chatId), {
      ultimaMensagem: limpo.slice(0, 200),
      ultimaHora: serverTimestamp(),
      naoLidasCliente: increment(1)
    });
    await lote.commit();
  }

  // Marca como lidas as mensagens que chegaram para quem abriu a conversa
  async lerMensagens(para: 'cliente' | 'gerente') {
    const chatId = this.conversaAtiva;
    if (!chatId) return;
    const remetente = para === 'cliente' ? 'gerente' : 'cliente';
    const pendentes = this.mensagens.filter((m) => m.de === remetente && m.lida === false);
    const contador = para === 'cliente' ? this.meuChatNaoLidas : (this.conversas.find((c) => c.id === chatId)?.naoLidasGerente ?? 0);
    if (!pendentes.length && !contador) return;
    try {
      const lote = writeBatch(db);
      for (const m of pendentes) lote.update(doc(db, 'chats', chatId, 'mensagens', m.id), { lida: true });
      lote.update(doc(db, 'chats', chatId), para === 'cliente' ? { naoLidasCliente: 0 } : { naoLidasGerente: 0 });
      await lote.commit();
    } catch {
      // sem conexão: tenta de novo na próxima mensagem
    }
    if (para === 'cliente') {
      for (const n of this.notificacoes) if (n.tipo === 'mensagem') n.lida = true;
      this.salvarNotificacoes();
    }
  }
}

export const app = new App();
