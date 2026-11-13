<script lang="ts">
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

<h1>Relatórios</h1>
<form class="filtros" onsubmit={(e) => { e.preventDefault(); carregar(); }}>
  <label>De <input type="date" bind:value={de} required /></label>
  <label>Até <input type="date" bind:value={ate} required /></label>
  <button type="submit" class="aplicar" disabled={carregando}>Gerar</button>
</form>
<p class="nota">Cada relatório diz qual data usa. Faturamento = só pagamentos "Pago", pela data do pagamento (mesmo critério do dashboard).</p>

{#if erro}
  <p class="erro" role="alert">{erro}</p>
  <button type="button" class="btn" onclick={carregar}>Tentar de novo</button>
{:else if carregando}
  <p class="aviso" role="status">Carregando...</p>
{:else}
  {#if cortadoPagos}<p class="aviso" role="status">Só os {TETO_AGENDAMENTOS} pagamentos mais antigos do período entraram no faturamento. Reduza o período.</p>{/if}
  {#if cortado}<p class="aviso" role="status">Só os {TETO_AGENDAMENTOS} agendamentos mais recentes do período entraram. Reduza o período.</p>{/if}
  {#if ags.length === 0}<p class="aviso" role="status">Nenhum agendamento no período.</p>{/if}

  <section>
    <header><h2>Faturamento por período <small>({brlCentavos(totalFat)})</small></h2><button type="button" class="btn" onclick={exportar.dia}>Exportar CSV</button></header>
    {#if porDia.length === 0}<p class="aviso">Sem faturamento no período.</p>{:else}
      <p class="base">Data usada: data do pagamento (pagamento.pagoEm). Só pagamentos "Pago".</p>
      <table><thead><tr><th>Dia do pagamento</th><th class="dir">Pagos</th><th class="dir">Faturamento</th></tr></thead>
        <tbody>{#each porDia as l}<tr><td>{l.rotulo.split('-').reverse().join('/')}</td><td class="dir">{l.quantidade}</td><td class="dir">{brlCentavos(l.centavos)}</td></tr>{/each}</tbody></table>
    {/if}
  </section>

  <section>
    <header><h2>Faturamento por serviço</h2><button type="button" class="btn" onclick={exportar.servico}>Exportar CSV</button></header>
    {#if porServico.length === 0}<p class="aviso">Sem serviços pagos no período.</p>{:else}
      <p class="base">Data usada: data do pagamento (pagamento.pagoEm). Só pagamentos "Pago".</p>
      <table><thead><tr><th>Serviço</th><th class="dir">Itens</th><th class="dir">Faturamento</th></tr></thead>
        <tbody>{#each porServico as l}<tr><td>{l.rotulo}</td><td class="dir">{l.quantidade}</td><td class="dir">{brlCentavos(l.centavos)}</td></tr>{/each}</tbody></table>
    {/if}
  </section>

  <section>
    <header><h2>Agendamentos por status</h2><button type="button" class="btn" onclick={exportar.status}>Exportar CSV</button></header>
    <p class="base">Data usada: data do agendamento (início). Todos os status.</p>
    <table><thead><tr><th>Status</th><th class="dir">Agendamentos</th><th class="dir">Valor</th></tr></thead>
      <tbody>{#each porStatus as l}<tr><td>{l.rotulo}</td><td class="dir">{l.quantidade}</td><td class="dir">{brlCentavos(l.centavos)}</td></tr>{/each}</tbody></table>
  </section>

  <section>
    <header><h2>Desempenho por funcionário</h2><button type="button" class="btn" onclick={exportar.func}>Exportar CSV</button></header>
    {#if porFunc.length === 0}<p class="aviso">Nenhum atendimento com funcionário no período.</p>{:else}
      <p class="base">Datas usadas: atendimentos, finalizados e nota pela data do agendamento; faturamento pela data do pagamento.</p>
      <table><thead><tr><th>Funcionário</th><th class="dir">Atendimentos</th><th class="dir">Finalizados</th><th class="dir">Faturamento (data do pagamento)</th><th class="dir">Nota média</th></tr></thead>
        <tbody>{#each porFunc as f}<tr><td>{f.nome}</td><td class="dir">{f.atendimentos}</td><td class="dir">{f.finalizados}</td><td class="dir">{brlCentavos(f.centavos)}</td><td class="dir">{f.notaMedia ?? '—'}</td></tr>{/each}</tbody></table>
    {/if}
  </section>

  <section>
    <header><h2>Custos por categoria</h2><button type="button" class="btn" onclick={exportar.custo} disabled={!!erroCustos}>Exportar CSV</button></header>
    {#if erroCustos}
      <p class="erro" role="alert">{erroCustos}</p>
    {:else if porCusto.length === 0}
      <p class="aviso">Sem custos no período.</p>
    {:else}
      <p class="base">Data usada: mês de competência do custo.</p>
      <table><thead><tr><th>Categoria</th><th class="dir">Custo</th></tr></thead>
        <tbody>{#each porCusto as l}<tr><td>{l.rotulo}</td><td class="dir">{brlCentavos(l.centavos)}</td></tr>{/each}</tbody></table>
    {/if}
  </section>
{/if}

<style>
  h1 { margin: 0 0 16px; font-size: 1.5rem; }
  h2 { margin: 0; font-size: 1.05rem; }
  h2 small { font-weight: 400; color: #556; }
  .filtros { display: flex; align-items: flex-end; gap: 14px; margin-bottom: 8px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #445; }
  input { min-height: 36px; padding: 0 10px; font: inherit; border: 1px solid #c3c9d3; border-radius: 8px; background: #fff; }
  .aplicar { min-height: 36px; padding: 0 18px; border-radius: 8px; border: 0; background: #0d1b2e; color: #fff; font: inherit; cursor: pointer; }
  .nota { color: #556; font-size: 0.85rem; margin: 0 0 16px; }
  section { background: #fff; border: 1px solid #d9dde4; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #eceff3; }
  .dir { text-align: right; }
  .btn { min-height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #c3c9d3; background: #fff; font: inherit; cursor: pointer; }
  .btn:disabled { opacity: 0.45; }
  .erro { color: #b3261e; }
  .aviso { color: #556; }
  .base { color: #556; font-size: 0.8rem; margin: 0 0 8px; }
</style>
