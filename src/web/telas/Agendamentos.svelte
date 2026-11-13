<script lang="ts">
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

  const colAg: Coluna<Agendamento>[] = [
    { id: 'quando', titulo: 'Data', texto: dataHora, chave: (a) => a.inicio, link: (a) => `/admin/agendamentos/${a.id}` },
    { id: 'cliente', titulo: 'Cliente', texto: (a) => a.clienteNome, chave: (a) => a.clienteNome },
    { id: 'servico', titulo: 'Serviços', texto: (a) => nomesItens(a.itens) },
    { id: 'cond', titulo: 'Condomínio', texto: (a) => nomeCond(a.condominioId), chave: (a) => nomeCond(a.condominioId) },
    { id: 'status', titulo: 'Status', texto: (a) => rotuloStatus[a.status] ?? a.status, chave: (a) => a.status },
    { id: 'pag', titulo: 'Pagamento', texto: (a) => rotuloPagamento[situacaoPagamento(a)] || '—', chave: (a) => situacaoPagamento(a) },
    { id: 'total', titulo: 'Valor', texto: (a) => brlCentavos(a.total), chave: (a) => a.total, alinhar: 'dir' }
  ];
  const colPag: Coluna<Agendamento>[] = [
    { id: 'pag', titulo: 'Status', texto: (a) => rotuloPagamento[situacaoPagamento(a)] || '—', chave: (a) => situacaoPagamento(a) },
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

<h1>{modo === 'pagamentos' ? 'Pagamentos' : 'Agendamentos'}</h1>
<form class="filtros" onsubmit={(e) => { e.preventDefault(); carregar(); }}>
  <label>De <input type="date" bind:value={de} required /></label>
  <label>Até <input type="date" bind:value={ate} required /></label>
  <label>
    Status do agendamento
    <select bind:value={status}>
      <option value="">Todos</option>
      {#each Object.entries(rotuloStatus) as [id, nome]}<option value={id}>{nome}</option>{/each}
    </select>
  </label>
  <label>
    Condomínio
    <select bind:value={condominio}>
      <option value="">Todos</option>
      {#each condominios as c (c.id)}<option value={c.id}>{c.nome}</option>{/each}
    </select>
  </label>
  <label>
    Pagamento
    <select bind:value={pagamento}>
      <option value="">Todos</option>
      <option value="pago">Pago</option>
      <option value="pendente">Pendente</option>
      <option value="revisao">Em análise</option>
      <option value="sem">Sem pagamento</option>
    </select>
  </label>
  <button type="submit" class="aplicar" disabled={carregando}>Aplicar</button>
</form>
{#if cortado}<p class="aviso" role="status">Mostrando só os {TETO_AGENDAMENTOS} mais recentes do período. Reduza o período para ver tudo.</p>{/if}
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

<style>
  h1 { margin: 0 0 16px; font-size: 1.5rem; }
  .filtros { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; margin-bottom: 16px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #445; }
  input, select { min-height: 36px; padding: 0 10px; font: inherit; border: 1px solid #c3c9d3; border-radius: 8px; background: #fff; }
  .aplicar { min-height: 36px; padding: 0 18px; border-radius: 8px; border: 0; background: #0d1b2e; color: #fff; font: inherit; cursor: pointer; }
  .aplicar:disabled { opacity: 0.5; }
  .aviso { color: #7a5b00; }
</style>
