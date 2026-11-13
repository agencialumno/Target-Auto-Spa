<script lang="ts">
  import { untrack } from 'svelte';
  import TelaAdmin from '$lib/components/TelaAdmin.svelte';
  import BlocoDash from '$lib/components/BlocoDash.svelte';
  import { Bloco } from '$lib/bloco.svelte';
  import { app, rotuloStatus } from '$lib/app.svelte';
  import { brlCentavos } from '$lib/agendamentos';
  import { somarCustos, nomeCategoria } from '$lib/custos';
  import { listarCustos } from '$lib/custos-admin';
  import { cartoesTempoReal, detalharPeriodo, limitesDoPeriodo, rentabilidade, STATUS_ORDEM, ticketMedio } from '$lib/dashboard';
  import { agendamentosDoPeriodo, contarPorStatus, contarUsuarios, faturamento, ultimasMovimentacoes } from '$lib/dashboard-dados';
  import { descreverMudanca, rotuloAcao } from '$lib/atividades-consulta';

  const mesAtual = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  let de = $state(mesAtual());
  let ate = $state(mesAtual());
  const periodoInvalido = $derived(!limitesDoPeriodo(de, ate));

  // Período vigente lido na hora da carga: os blocos nunca leem estado reativo por conta própria
  const periodo = () => {
    const l = limitesDoPeriodo(de, ate);
    if (!l) throw Object.assign(new Error('periodo'), { code: 'periodo-invalido' });
    return l;
  };

  const bUsuarios = new Bloco(contarUsuarios);
  const bStatus = new Bloco(() => {
    const l = periodo();
    return contarPorStatus(l.inicio, l.fim);
  });
  const bFinanceiro = new Bloco(async () => {
    const l = periodo();
    const [r, c] = await Promise.all([faturamento(l.inicio, l.fim), listarCustos()]);
    return { receita: r, custos: somarCustos(c, de, ate) };
  });
  const bMov = new Bloco(() => ultimasMovimentacoes(20), (d) => d.length === 0);
  const bDetalhe = new Bloco(async () => {
    const l = periodo();
    return detalharPeriodo(await agendamentosDoPeriodo(l.inicio, l.fim));
  });
  let detalheAberto = $state(false);

  // Cartões do topo em tempo real: sobre o que o app já escuta (sem leitura extra, sem rede)
  let agora = $state(new Date());
  $effect(() => {
    const t = setInterval(() => (agora = new Date()), 30_000);
    return () => clearInterval(t);
  });
  const tempoReal = $derived(cartoesTempoReal(app.agendamentos, agora));

  // `untrack`: o estado dos blocos nunca realimenta o efeito (era o laço de recarga que prendia em "atualizando")
  function carregarPeriodo() {
    untrack(() => {
      bStatus.carregar();
      bFinanceiro.carregar();
      if (detalheAberto) bDetalhe.carregar();
    });
  }
  $effect(() => {
    void de;
    void ate;
    carregarPeriodo();
  });
  $effect(() => {
    untrack(() => {
      bUsuarios.carregar();
      bMov.carregar();
    });
  });

  function abrirDetalhe() {
    detalheAberto = true;
    bDetalhe.carregar();
  }

  const quando = (d: Date | null) => (d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
  const totalAgendamentos = $derived(bStatus.dados ? STATUS_ORDEM.reduce((s, k) => s + (bStatus.dados![k] ?? 0), 0) : 0);
  const resultado = $derived(
    bFinanceiro.dados ? rentabilidade(bFinanceiro.dados.receita.centavos, bFinanceiro.dados.custos.totalCentavos) : null
  );
</script>

<TelaAdmin titulo="Dashboard" sub="Visão geral do negócio">
  <section class="topo" aria-label="Agora">
    <div class="kpi card"><small>Hoje</small><strong>{tempoReal.hoje}</strong><small>agendamentos</small></div>
    <div class="kpi card"><small>Em atendimento</small><strong>{tempoReal.emAtendimento}</strong></div>
    <div class="kpi card"><small>Aguardando pagamento</small><strong>{tempoReal.aguardandoPagamento}</strong></div>
    <div class="kpi card">
      <small>Próximo</small>
      <strong>{tempoReal.proximo ? tempoReal.proximo.hora : '—'}</strong>
      <small>{tempoReal.proximo ? tempoReal.proximo.clienteNome : 'nenhum agendado'}</small>
    </div>
  </section>

  <form class="periodo" onsubmit={(e) => (e.preventDefault(), carregarPeriodo())}>
    <label><span>De</span><input type="month" bind:value={de} /></label>
    <label><span>Até</span><input type="month" bind:value={ate} /></label>
    <button class="btn-primario" type="submit" disabled={periodoInvalido}>Atualizar</button>
  </form>
  {#if periodoInvalido}<p class="erro" role="alert">Período inválido: o mês final não pode ser antes do inicial.</p>{/if}

  <BlocoDash titulo="Financeiro" estado={bFinanceiro.estado} erro={bFinanceiro.erro} aoTentar={() => bFinanceiro.carregar()}>
    {#if resultado && bFinanceiro.dados}
      <div class="grade">
        <div class="kpi card"><small>Faturamento (pagos)</small><strong>{brlCentavos(resultado.faturamentoCentavos)}</strong><small>{bFinanceiro.dados.receita.pagos} pagamentos</small></div>
        <div class="kpi card"><small>Custos</small><strong>{brlCentavos(resultado.custosCentavos)}</strong></div>
        <div class="kpi card">
          <small>Rentabilidade</small>
          <strong class:neg={resultado.resultadoCentavos < 0}>{brlCentavos(resultado.resultadoCentavos)}</strong>
          <small>{resultado.margemPct === null ? 'sem receita' : `margem ${resultado.margemPct}%`}</small>
        </div>
        <div class="kpi card"><small>Ticket médio</small><strong>{brlCentavos(ticketMedio(bFinanceiro.dados.receita.centavos, bFinanceiro.dados.receita.pagos))}</strong></div>
      </div>
      {#if Object.keys(bFinanceiro.dados.custos.porCategoria).length}
        <p class="peq">
          Custos por categoria:
          {#each Object.entries(bFinanceiro.dados.custos.porCategoria) as [c, v], i}{i ? ' · ' : ''}{nomeCategoria(c)} {brlCentavos(v)}{/each}
        </p>
      {/if}
    {/if}
  </BlocoDash>

  <BlocoDash titulo={`Agendamentos no período (${totalAgendamentos})`} estado={bStatus.estado} erro={bStatus.erro} aoTentar={() => bStatus.carregar()}>
    {#if bStatus.dados}
      <div class="grade">
        {#each STATUS_ORDEM as s}
          <div class="kpi card"><small>{rotuloStatus[s]}</small><strong>{bStatus.dados[s]}</strong></div>
        {/each}
      </div>
      <p class="peq">"Realizados" = em atendimento + finalizados; "concluídos" = finalizados; "pendentes" = agendados.</p>
    {/if}
  </BlocoDash>

  <BlocoDash titulo="Usuários" estado={bUsuarios.estado} erro={bUsuarios.erro} aoTentar={() => bUsuarios.carregar()}>
    {#if bUsuarios.dados}
      <div class="grade">
        <div class="kpi card"><small>Clientes</small><strong>{bUsuarios.dados.cliente}</strong></div>
        <div class="kpi card"><small>Gerentes</small><strong>{bUsuarios.dados.gerente}</strong></div>
        <div class="kpi card"><small>Funcionários</small><strong>{bUsuarios.dados.funcionario}</strong></div>
        <div class="kpi card"><small>Administradores</small><strong>{bUsuarios.dados.admin}</strong></div>
      </div>
    {/if}
  </BlocoDash>

  {#if !detalheAberto}
    <h2>Serviços e desempenho</h2>
    <button class="btn-secundario" onclick={abrirDetalhe} disabled={periodoInvalido}>Carregar detalhes do período</button>
    <p class="peq">Abre até 500 agendamentos do período (leitura maior), por isso só sob demanda.</p>
  {:else}
    <BlocoDash titulo="Serviços e desempenho" estado={bDetalhe.estado} erro={bDetalhe.erro} aoTentar={() => bDetalhe.carregar()}>
      {#if bDetalhe.dados}
        {@const detalhe = bDetalhe.dados}
        {#if detalhe.truncado}<p class="peq" role="status">Mostrando só os {detalhe.lidos} agendamentos mais recentes do período.</p>{/if}
        <h3>Serviços executados</h3>
        {#if detalhe.servicos.length}
          <ul>{#each detalhe.servicos as s}<li>{s.nome}: <b>{s.vezes}</b></li>{/each}</ul>
        {:else}<p class="peq">Nenhum serviço finalizado no período.</p>{/if}
        <h3>Desempenho por funcionário{detalhe.notaMedia !== null ? ` (nota média geral ${detalhe.notaMedia})` : ''}</h3>
        {#if detalhe.funcionarios.length}
          <ul>
            {#each detalhe.funcionarios as f}<li>{f.nome}: <b>{f.finalizados}</b> finalizados{f.notaMedia !== null ? ` · nota ${f.notaMedia}` : ''}</li>{/each}
          </ul>
        {:else}<p class="peq">Nenhum atendimento finalizado com funcionário atribuído.</p>{/if}
      {/if}
    </BlocoDash>
  {/if}

  <BlocoDash titulo="Últimas movimentações" estado={bMov.estado} erro={bMov.erro} vazio="Nenhuma atividade registrada ainda." aoTentar={() => bMov.carregar()}>
    {#if bMov.dados}
      <ul class="mov">
        {#each bMov.dados as a (a.id)}
          <li>
            <b>{rotuloAcao[a.acao] ?? a.acao}</b> <small>{quando(a.em)}</small>
            {#if a.antes || a.depois}<small>{descreverMudanca(a)}</small>{/if}
          </li>
        {/each}
      </ul>
      <a class="btn-secundario ver" href="/admin/atividades">Ver todas</a>
    {/if}
  </BlocoDash>
</TelaAdmin>

<style>
  h2 {
    margin: 18px 0 8px;
    font-size: 1rem;
  }

  h3 {
    margin: 10px 0 4px;
    font-size: 0.9rem;
  }

  .topo,
  .grade {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .kpi {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
  }

  .kpi strong {
    font-size: 1.3rem;
    overflow-wrap: anywhere;
  }

  .neg {
    color: var(--erro);
  }

  small,
  .peq {
    color: var(--texto-suave);
    font-size: 0.78rem;
  }

  .periodo {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 16px;
  }

  .periodo button {
    grid-column: 1 / -1;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--texto-suave);
  }

  input {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--card-borda);
    background: var(--card);
    font: inherit;
    color: var(--texto);
  }

  ul {
    margin: 0;
    padding-left: 18px;
    font-size: 0.88rem;
  }

  .mov {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mov li {
    display: flex;
    flex-direction: column;
  }

  .ver {
    display: block;
    margin-top: 10px;
    text-align: center;
  }

  .erro {
    color: var(--erro);
  }
</style>
