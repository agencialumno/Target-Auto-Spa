<script lang="ts">
  import TelaWeb from '../TelaWeb.svelte';
  // Tabela de agendamentos (modo "agendamentos") e de pagamentos (modo "pagamentos"): mesma consulta,
  // colunas e filtros diferentes. Período, status e condomínio vão na consulta; pagamento é filtrado aqui.
  import Tabela from '../Tabela.svelte';
  import type { Coluna } from '$lib/web/tabela';
  import { descreverErro, listarAgendamentos, listarCondominios, TETO_AGENDAMENTOS } from '$lib/web/consultas';
  import { filtrarPorPagamento, type FiltroAg } from '$lib/web/tabela';
  import { brlCentavos, nomesItens, rotuloPagamento, rotuloStatus, situacaoPagamento, type Agendamento } from '$lib/agendamentos';

  let { modo }: { modo: 'agendamentos' | 'pagamentos' } = $props();

  const dia = (d: Date) => d.toISOString().slice(0, 10);
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  let de = $state(dia(new Date(ini.getTime() - ini.getTimezoneOffset() * 60000)));
  let ate = $state(dia(new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000)));
  let status = $state('');
  let condominio = $state('');
  let pagamento = $state<FiltroAg['pagamento']>('');

  let todos = $state<Agendamento[]>([]);
  let condominios = $state<{ id: string; nome: string }[]>([]);
  let carregando = $state(true);
  let erro = $state('');
  let cortado = $state(false);

  const nomeCond = (id: string) => condominios.find((c) => c.id === id)?.nome ?? id;
  const base = $derived(modo === 'pagamentos' ? todos.filter((a) => a.pagamento) : todos);
  const lista = $derived(filtrarPorPagamento(base, pagamento));
  const dataHora = (a: Agendamento) => `${a.data.split('-').reverse().join('/')} ${a.hora}`;

  const seloStatus = (a: Agendamento) => (a.status === 'finalizado' ? 'ok' : a.status === 'em_andamento' ? 'aviso' : a.status === 'cancelado' ? 'erro' : '');
  const seloPag = (a: Agendamento) => {
    const s = situacaoPagamento(a);
    return s === 'pago' ? 'ok' : s === 'pendente' || s === 'sem' || s === 'vencido' ? 'aviso' : s === 'nenhuma' ? '' : 'erro';
  };

  const colAg: Coluna<Agendamento>[] = [
    { id: 'quando', titulo: 'Data', texto: dataHora, chave: (a) => a.inicio, link: (a) => `/admin/agendamentos/${a.id}` },
    { id: 'cliente', titulo: 'Cliente', texto: (a) => a.clienteNome, chave: (a) => a.clienteNome },
    { id: 'servico', titulo: 'Serviços', texto: (a) => nomesItens(a.itens) },
    { id: 'cond', titulo: 'Condomínio', texto: (a) => nomeCond(a.condominioId), chave: (a) => nomeCond(a.condominioId) },
    { id: 'status', titulo: 'Status', texto: (a) => rotuloStatus[a.status] ?? a.status, chave: (a) => a.status, selo: seloStatus },
    { id: 'pag', titulo: 'Pagamento', texto: (a) => rotuloPagamento[situacaoPagamento(a)] || '—', chave: (a) => situacaoPagamento(a), selo: seloPag },
    { id: 'total', titulo: 'Valor', texto: (a) => brlCentavos(a.total), chave: (a) => a.total, alinhar: 'dir' }
  ];
  const colPag: Coluna<Agendamento>[] = [
    { id: 'pag', titulo: 'Status', texto: (a) => rotuloPagamento[situacaoPagamento(a)] || '—', chave: (a) => situacaoPagamento(a), selo: seloPag },
    { id: 'total', titulo: 'Valor', texto: (a) => brlCentavos(a.total), chave: (a) => a.total, alinhar: 'dir' },
    {
      id: 'data',
      titulo: 'Data do pagamento',
      texto: (a) => (a.pagamento?.pagoEm ? a.pagamento.pagoEm.toLocaleDateString('pt-BR') : '—'),
      chave: (a) => a.pagamento?.pagoEm ?? null
    },
    { id: 'cliente', titulo: 'Cliente', texto: (a) => a.clienteNome, chave: (a) => a.clienteNome },
    { id: 'origem', titulo: 'Agendamento de origem', texto: (a) => `${dataHora(a)} · ${nomesItens(a.itens)}`, chave: (a) => a.inicio, link: (a) => `/admin/agendamentos/${a.id}` }
  ];

  async function carregar() {
    carregando = true;
    erro = '';
    cortado = false;
    try {
      const [r, c] = await Promise.all([listarAgendamentos({ de, ate, status, condominio }), listarCondominios().catch(() => condominios)]);
      todos = r.itens;
      cortado = r.cortado;
      condominios = c;
    } catch (e) {
      todos = [];
      erro = (e as { code?: string })?.code === 'periodo-invalido' ? 'Período inválido: confira as datas (de ≤ até).' : descreverErro(e, 'os agendamentos');
    } finally {
      carregando = false;
    }
  }
  $effect(() => {
    carregar();
  });
</script>

<TelaWeb titulo={modo === 'pagamentos' ? 'Pagamentos' : 'Agendamentos'}>
<form class="w-filtros" onsubmit={(e) => { e.preventDefault(); carregar(); }}>
  <label class="w-campo">De <input type="date" bind:value={de} required /></label>
  <label class="w-campo">Até <input type="date" bind:value={ate} required /></label>
  <label class="w-campo">
    Status do agendamento
    <select bind:value={status}>
      <option value="">Todos</option>
      {#each Object.entries(rotuloStatus) as [id, nome]}<option value={id}>{nome}</option>{/each}
    </select>
  </label>
  <label class="w-campo">
    Condomínio
    <select bind:value={condominio}>
      <option value="">Todos</option>
      {#each condominios as c (c.id)}<option value={c.id}>{c.nome}</option>{/each}
    </select>
  </label>
  <label class="w-campo">
    Pagamento
    <select bind:value={pagamento}>
      <option value="">Todos</option>
      <option value="pago">Pago</option>
      <option value="pendente">Pendente</option>
      <option value="revisao">Em análise</option>
      <option value="sem">Sem pagamento</option>
    </select>
  </label>
  <button type="submit" class="btn-primario w-btn-primario" disabled={carregando}>Aplicar</button>
</form>
{#if cortado}<p class="w-alerta" role="status">Mostrando só os {TETO_AGENDAMENTOS} mais recentes do período. Reduza o período para ver tudo.</p>{/if}
<Tabela
  colunas={modo === 'pagamentos' ? colPag : colAg}
  linhas={lista}
  {carregando}
  {erro}
  aoTentarDeNovo={carregar}
  ordemInicial={modo === 'pagamentos' ? undefined : { coluna: 'quando', dir: 'desc' }}
  vazio={modo === 'pagamentos' ? 'Nenhum pagamento neste período e filtros.' : 'Nenhum agendamento neste período e filtros.'}
  legenda={modo === 'pagamentos' ? 'Pagamentos' : 'Agendamentos'}
/>
</TelaWeb>
