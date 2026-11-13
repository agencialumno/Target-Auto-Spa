<script lang="ts">
  import TelaWeb from '../TelaWeb.svelte';
  // Relatórios por período, calculados no navegador sobre uma consulta de agendamentos + a lista de custos.
  import { descreverErro, listarAgendamentos, listarPagos, TETO_AGENDAMENTOS } from '$lib/web/consultas';
  import { listarCustos } from '$lib/custos-admin';
  import type { Custo } from '$lib/custos';
  import type { Agendamento } from '$lib/agendamentos';
  import { brlCentavos } from '$lib/agendamentos';
  import {
    agendamentosPorStatus,
    custosPorCategoria,
    desempenhoPorFuncionario,
    faturamentoPorDia,
    faturamentoPorServico,
    totalFaturamento,
    type Linha
  } from '$lib/web/relatorios';
  import { baixarCsv, paraCsv, reais } from '$lib/web/csv';

  const hoje = new Date();
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  let de = $state(local(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  let ate = $state(local(hoje));

  let ags = $state<Agendamento[]>([]);
  let pagos = $state<Agendamento[]>([]);
  let cortadoPagos = $state(false);
  let custos = $state<Custo[]>([]);
  let carregando = $state(true);
  let erro = $state('');
  let erroCustos = $state('');
  let cortado = $state(false);
  let geradoDe = $state('');
  let geradoAte = $state('');

  const porDia = $derived(faturamentoPorDia(pagos));
  const porServico = $derived(faturamentoPorServico(pagos));
  const porStatus = $derived(agendamentosPorStatus(ags));
  const porFunc = $derived(desempenhoPorFuncionario(ags, pagos));
  const porCusto = $derived(custosPorCategoria(custos, geradoDe || de, geradoAte || ate));
  const totalFat = $derived(totalFaturamento(pagos));

  async function carregar() {
    carregando = true;
    erro = '';
    erroCustos = '';
    cortado = false;
    try {
      const [r, p] = await Promise.all([listarAgendamentos({ de, ate, status: '', condominio: '' }), listarPagos(de, ate)]);
      ags = r.itens;
      cortado = r.cortado;
      pagos = p.itens;
      cortadoPagos = p.cortado;
      geradoDe = de;
      geradoAte = ate;
    } catch (e) {
      ags = [];
      pagos = [];
      erro = (e as { code?: string })?.code === 'periodo-invalido' ? 'Período inválido: confira as datas (de ≤ até).' : descreverErro(e, 'os agendamentos do relatório');
    }
    try {
      custos = await listarCustos();
    } catch (e) {
      custos = [];
      erroCustos = descreverErro(e, 'os custos');
    } finally {
      carregando = false;
    }
  }
  $effect(() => {
    carregar();
  });

  const nome = (base: string) => `${base}_${geradoDe}_${geradoAte}.csv`;
  const linhas = (ls: Linha[]) => ls.map((l) => [l.rotulo, l.quantidade, reais(l.centavos)]);
  const exportar = {
    dia: () => baixarCsv(nome('faturamento_por_dia'), paraCsv(['Dia', 'Agendamentos pagos', 'Faturamento (R$)'], linhas(porDia))),
    servico: () => baixarCsv(nome('faturamento_por_servico'), paraCsv(['Serviço', 'Itens pagos', 'Faturamento (R$)'], linhas(porServico))),
    status: () => baixarCsv(nome('agendamentos_por_status'), paraCsv(['Status', 'Agendamentos', 'Valor (R$)'], linhas(porStatus))),
    func: () =>
      baixarCsv(
        nome('desempenho_por_funcionario'),
        paraCsv(['Funcionário', 'Atendimentos', 'Finalizados', 'Faturamento por data do pagamento (R$)', 'Nota média'], porFunc.map((f) => [f.nome, f.atendimentos, f.finalizados, reais(f.centavos), f.notaMedia ?? '']))
      ),
    custo: () => baixarCsv(nome('custos_por_categoria'), paraCsv(['Categoria', 'Custo (R$)'], porCusto.map((l) => [l.rotulo, reais(l.centavos)])))
  };
</script>

<TelaWeb titulo="Relatórios">
<form class="w-filtros" onsubmit={(e) => { e.preventDefault(); carregar(); }}>
  <label class="w-campo">De <input type="date" bind:value={de} required /></label>
  <label class="w-campo">Até <input type="date" bind:value={ate} required /></label>
  <button type="submit" class="btn-primario w-btn-primario" disabled={carregando}>Gerar</button>
</form>
<p class="w-nota">Cada relatório diz qual data usa. Faturamento = só pagamentos "Pago", pela data do pagamento (mesmo critério do dashboard).</p>

{#if erro}
  <p class="w-erro" role="alert">{erro}</p>
  <button type="button" class="btn-secundario w-btn" onclick={carregar}>Tentar de novo</button>
{:else if carregando}
  <p class="w-aviso" role="status">Carregando...</p>
{:else}
  {#if cortadoPagos}<p class="w-alerta" role="status">Só os {TETO_AGENDAMENTOS} pagamentos mais antigos do período entraram no faturamento. Reduza o período.</p>{/if}
  {#if cortado}<p class="w-alerta" role="status">Só os {TETO_AGENDAMENTOS} agendamentos mais recentes do período entraram. Reduza o período.</p>{/if}
  {#if ags.length === 0}<p class="w-aviso" role="status">Nenhum agendamento no período.</p>{/if}

  <section class="w-card">
    <header class="w-card-topo"><h2>Faturamento por período <small>({brlCentavos(totalFat)})</small></h2><button type="button" class="btn-secundario w-btn" onclick={exportar.dia}>Exportar CSV</button></header>
    {#if porDia.length === 0}<p class="w-aviso">Sem faturamento no período.</p>{:else}
      <p class="w-nota">Data usada: data do pagamento (pagamento.pagoEm). Só pagamentos "Pago".</p>
      <table class="w-tabela"><thead><tr><th>Dia do pagamento</th><th class="dir">Pagos</th><th class="dir">Faturamento</th></tr></thead>
        <tbody>{#each porDia as l}<tr><td>{l.rotulo.split('-').reverse().join('/')}</td><td class="dir">{l.quantidade}</td><td class="dir">{brlCentavos(l.centavos)}</td></tr>{/each}</tbody></table>
    {/if}
  </section>

  <section class="w-card">
    <header class="w-card-topo"><h2>Faturamento por serviço</h2><button type="button" class="btn-secundario w-btn" onclick={exportar.servico}>Exportar CSV</button></header>
    {#if porServico.length === 0}<p class="w-aviso">Sem serviços pagos no período.</p>{:else}
      <p class="w-nota">Data usada: data do pagamento (pagamento.pagoEm). Só pagamentos "Pago".</p>
      <table class="w-tabela"><thead><tr><th>Serviço</th><th class="dir">Itens</th><th class="dir">Faturamento</th></tr></thead>
        <tbody>{#each porServico as l}<tr><td>{l.rotulo}</td><td class="dir">{l.quantidade}</td><td class="dir">{brlCentavos(l.centavos)}</td></tr>{/each}</tbody></table>
    {/if}
  </section>

  <section class="w-card">
    <header class="w-card-topo"><h2>Agendamentos por status</h2><button type="button" class="btn-secundario w-btn" onclick={exportar.status}>Exportar CSV</button></header>
    <p class="w-nota">Data usada: data do agendamento (início). Todos os status.</p>
    <table class="w-tabela"><thead><tr><th>Status</th><th class="dir">Agendamentos</th><th class="dir">Valor</th></tr></thead>
      <tbody>{#each porStatus as l}<tr><td>{l.rotulo}</td><td class="dir">{l.quantidade}</td><td class="dir">{brlCentavos(l.centavos)}</td></tr>{/each}</tbody></table>
  </section>

  <section class="w-card">
    <header class="w-card-topo"><h2>Desempenho por funcionário</h2><button type="button" class="btn-secundario w-btn" onclick={exportar.func}>Exportar CSV</button></header>
    {#if porFunc.length === 0}<p class="w-aviso">Nenhum atendimento com funcionário no período.</p>{:else}
      <p class="w-nota">Datas usadas: atendimentos, finalizados e nota pela data do agendamento; faturamento pela data do pagamento.</p>
      <table class="w-tabela"><thead><tr><th>Funcionário</th><th class="dir">Atendimentos</th><th class="dir">Finalizados</th><th class="dir">Faturamento (data do pagamento)</th><th class="dir">Nota média</th></tr></thead>
        <tbody>{#each porFunc as f}<tr><td>{f.nome}</td><td class="dir">{f.atendimentos}</td><td class="dir">{f.finalizados}</td><td class="dir">{brlCentavos(f.centavos)}</td><td class="dir">{f.notaMedia ?? '—'}</td></tr>{/each}</tbody></table>
    {/if}
  </section>

  <section class="w-card">
    <header class="w-card-topo"><h2>Custos por categoria</h2><button type="button" class="btn-secundario w-btn" onclick={exportar.custo} disabled={!!erroCustos}>Exportar CSV</button></header>
    {#if erroCustos}
      <p class="w-erro" role="alert">{erroCustos}</p>
    {:else if porCusto.length === 0}
      <p class="w-aviso">Sem custos no período.</p>
    {:else}
      <p class="w-nota">Data usada: mês de competência do custo.</p>
      <table class="w-tabela"><thead><tr><th>Categoria</th><th class="dir">Custo</th></tr></thead>
        <tbody>{#each porCusto as l}<tr><td>{l.rotulo}</td><td class="dir">{brlCentavos(l.centavos)}</td></tr>{/each}</tbody></table>
    {/if}
  </section>
{/if}
</TelaWeb>
