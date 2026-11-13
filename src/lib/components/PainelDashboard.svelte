<script lang="ts">
  import { untrack } from 'svelte';
  import BlocoDash from './BlocoDash.svelte';
  import { Bloco } from '$lib/bloco.svelte';
  import { app, rotuloStatus } from '$lib/app.svelte';
  import { brlCentavos } from '$lib/agendamentos';
  import { somarCustos, nomeCategoria } from '$lib/custos';
  import { listarCustos } from '$lib/custos-admin';
  import { cartoesTempoReal, detalharPeriodo, PRESETS, periodoPreset, rentabilidade, rotuloPreset, STATUS_ORDEM, ticketMedio, variacaoPct, type Preset } from '$lib/dashboard';
  import { agendamentosDoPeriodo, contarPorStatus, contarUsuarios, faturamento, ultimasMovimentacoes } from '$lib/dashboard-dados';
  import { descreverMudanca, rotuloAcao } from '$lib/atividades-consulta';

  let preset = $state<Preset>('mes');
  const somaStatus = (r: Record<string, number>) => STATUS_ORDEM.reduce((s, k) => s + (r[k] ?? 0), 0);

  // O período é lido na hora da carga: os blocos nunca leem estado reativo por conta própria
  const bUsuarios = new Bloco(contarUsuarios);
  const bStatus = new Bloco(async () => {
    const p = periodoPreset(preset);
    const atual = await contarPorStatus(p.inicio, p.fim);
    // a comparação é complemento: se falhar, o cartão aparece sem variação
    const anterior = await contarPorStatus(p.anteriorInicio, p.anteriorFim).catch(() => null);
    return { atual, anterior };
  });
  const bFinanceiro = new Bloco(async () => {
    const p = periodoPreset(preset);
    const mensal = preset === 'mes';
    const [r, c, ant] = await Promise.all([
      faturamento(p.inicio, p.fim),
      mensal ? listarCustos() : Promise.resolve(null),
      faturamento(p.anteriorInicio, p.anteriorFim).catch(() => null)
    ]);
    return { receita: r, anterior: ant, custos: c ? somarCustos(c, p.de, p.ate) : null };
  });
  const bMov = new Bloco(() => ultimasMovimentacoes(20), (d) => d.length === 0);
  const bDetalhe = new Bloco(async () => {
    const p = periodoPreset(preset);
    return detalharPeriodo(await agendamentosDoPeriodo(p.inicio, p.fim));
  });
  let detalheAberto = $state(false);

  // Cartões do topo em tempo real: sobre o que o app já escuta (sem leitura extra, sem rede)
  let agora = $state(new Date());
  $effect(() => {
    const t = setInterval(() => (agora = new Date()), 30_000);
    return () => clearInterval(t);
  });
  const tempoReal = $derived(cartoesTempoReal(app.agendamentos, agora));

  // `untrack`: o estado dos blocos nunca realimenta o efeito (isso era o laço de recarga)
  function carregarPeriodo() {
    untrack(() => {
      bStatus.carregar();
      bFinanceiro.carregar();
      if (detalheAberto) bDetalhe.carregar();
    });
  }
  function atualizarTudo() {
    untrack(() => {
      carregarPeriodo();
      bUsuarios.carregar();
      bMov.carregar();
    });
  }
  $effect(() => {
    void preset;
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

  // Puxar para atualizar: gesto de cima para baixo com a página no topo
  let puxando = $state(0);
  let inicioY: number | null = null;
  const LIMIAR = 80;
  const aoTocar = (e: TouchEvent) => (inicioY = typeof window !== 'undefined' && window.scrollY <= 0 ? e.touches[0].clientY : null);
  const aoMover = (e: TouchEvent) => {
    if (inicioY !== null) puxando = Math.max(0, Math.min(120, e.touches[0].clientY - inicioY));
  };
  const aoSoltar = () => {
    if (puxando >= LIMIAR) atualizarTudo();
    puxando = 0;
    inicioY = null;
  };

  const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const atualizadoEm = $derived(
    [bStatus, bFinanceiro, bUsuarios, bMov].map((b) => b.atualizadoEm).filter((d): d is Date => !!d).sort((x, y) => y.getTime() - x.getTime())[0] ?? null
  );
  const quando = (d: Date | null) => (d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

  const totalAgendamentos = $derived(bStatus.dados ? somaStatus(bStatus.dados.atual) : 0);
  const varAgendamentos = $derived(bStatus.dados?.anterior ? variacaoPct(totalAgendamentos, somaStatus(bStatus.dados.anterior)) : null);
  const resultado = $derived(
    bFinanceiro.dados?.custos ? rentabilidade(bFinanceiro.dados.receita.centavos, bFinanceiro.dados.custos.totalCentavos) : null
  );
  const varFaturamento = $derived(
    bFinanceiro.dados?.anterior ? variacaoPct(bFinanceiro.dados.receita.centavos, bFinanceiro.dados.anterior.centavos) : null
  );
  const seta = (v: number) => (v > 0 ? `▲ ${v}%` : v < 0 ? `▼ ${Math.abs(v)}%` : '= 0%');
</script>

<div class="painel" ontouchstart={aoTocar} ontouchmove={aoMover} ontouchend={aoSoltar} role="presentation">
  {#if puxando > 0}
    <p class="puxar" role="status">{puxando >= LIMIAR ? 'Solte para atualizar' : 'Puxe para atualizar'}</p>
  {/if}

  <div class="barra">
    <div class="seg" role="group" aria-label="Período">
      {#each PRESETS as p (p.id)}
        <button type="button" class:ativo={preset === p.id} aria-pressed={preset === p.id} onclick={() => (preset = p.id)}>{p.rotulo}</button>
      {/each}
    </div>
    <div class="atual">
      <small>{atualizadoEm ? `Atualizado às ${hhmm(atualizadoEm)}` : 'Atualizando...'}</small>
      <button type="button" class="link" onclick={atualizarTudo}>Atualizar</button>
    </div>
  </div>

  <section class="topo" aria-label="Agora">
    <a class="kpi card" href="/admin/agendamentos?periodo=hoje"><small>Hoje</small><strong>{tempoReal.hoje}</strong><small>agendamentos</small></a>
    <a class="kpi card" href="/admin/agendamentos?status=em_andamento"><small>Em atendimento</small><strong>{tempoReal.emAtendimento}</strong></a>
    <a class="kpi card" href="/admin/agendamentos?pagamento=pendente"><small>Aguardando pagamento</small><strong>{tempoReal.aguardandoPagamento}</strong></a>
    <a class="kpi card" href="/admin/agendamentos?status=agendado">
      <small>Próximo</small>
      <strong>{tempoReal.proximo ? tempoReal.proximo.hora : '—'}</strong>
      <small>{tempoReal.proximo ? tempoReal.proximo.clienteNome : 'nenhum agendado'}</small>
    </a>
  </section>

  <BlocoDash titulo="Financeiro" estado={bFinanceiro.estado} erro={bFinanceiro.erro} aoTentar={() => bFinanceiro.carregar()}>
    {#if bFinanceiro.dados}
      {@const f = bFinanceiro.dados}
      <div class="grade">
        <a class="kpi card" href="/admin/agendamentos?pagamento=pago&periodo={preset}">
          <small>Faturamento (pagos)</small>
          <strong>{brlCentavos(f.receita.centavos)}</strong>
          <small>{f.receita.pagos} pagamentos{#if varFaturamento !== null} · <span class="var" class:neg={varFaturamento < 0}>{seta(varFaturamento)}</span>{/if}</small>
        </a>
        <div class="kpi card"><small>Ticket médio</small><strong>{brlCentavos(ticketMedio(f.receita.centavos, f.receita.pagos))}</strong></div>
        {#if resultado}
          <a class="kpi card" href="/admin/custos"><small>Custos</small><strong>{brlCentavos(resultado.custosCentavos)}</strong></a>
          <div class="kpi card">
            <small>Rentabilidade</small>
            <strong class:neg={resultado.resultadoCentavos < 0}>{brlCentavos(resultado.resultadoCentavos)}</strong>
            <small>{resultado.margemPct === null ? 'sem receita' : `margem ${resultado.margemPct}%`}</small>
          </div>
        {/if}
      </div>
      {#if resultado && f.custos && Object.keys(f.custos.porCategoria).length}
        <p class="peq">
          Custos por categoria:
          {#each Object.entries(f.custos.porCategoria) as [c, v], i}{i ? ' · ' : ''}{nomeCategoria(c)} {brlCentavos(v)}{/each}
        </p>
      {:else if !resultado}
        <p class="peq">Custos e rentabilidade são mensais: escolha "Mês" para vê-los.</p>
      {/if}
    {/if}
  </BlocoDash>

  <BlocoDash titulo={`Agendamentos ${rotuloPreset[preset]} (${totalAgendamentos})`} estado={bStatus.estado} erro={bStatus.erro} aoTentar={() => bStatus.carregar()}>
    {#if bStatus.dados}
      <div class="grade">
        {#each STATUS_ORDEM as s}
          <a class="kpi card" href="/admin/agendamentos?status={s}&periodo={preset}">
            <small>{rotuloStatus[s]}</small><strong>{bStatus.dados.atual[s]}</strong>
          </a>
        {/each}
      </div>
      {#if varAgendamentos !== null}
        <p class="peq">Total em relação ao período anterior: <span class="var" class:neg={varAgendamentos < 0}>{seta(varAgendamentos)}</span></p>
      {/if}
    {/if}
  </BlocoDash>

  <BlocoDash titulo="Usuários" estado={bUsuarios.estado} erro={bUsuarios.erro} aoTentar={() => bUsuarios.carregar()}>
    {#if bUsuarios.dados}
      <div class="grade">
        <a class="kpi card" href="/admin/usuarios"><small>Clientes</small><strong>{bUsuarios.dados.cliente}</strong></a>
        <a class="kpi card" href="/admin/usuarios"><small>Gerentes</small><strong>{bUsuarios.dados.gerente}</strong></a>
        <a class="kpi card" href="/admin/usuarios"><small>Funcionários</small><strong>{bUsuarios.dados.funcionario}</strong></a>
        <a class="kpi card" href="/admin/usuarios"><small>Administradores</small><strong>{bUsuarios.dados.admin}</strong></a>
      </div>
    {/if}
  </BlocoDash>

  {#if !detalheAberto}
    <h2>Serviços e desempenho</h2>
    <button class="btn-secundario" onclick={abrirDetalhe}>Carregar detalhes do período</button>
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
</div>

<style>
  h2 {
    margin: 18px 0 8px;
    font-size: 1rem;
  }

  h3 {
    margin: 10px 0 4px;
    font-size: 0.9rem;
  }

  .puxar {
    text-align: center;
    color: var(--texto-suave);
    font-size: 0.8rem;
    margin: 0 0 8px;
  }

  .barra {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: var(--card);
    border: 1px solid var(--card-borda);
  }

  .seg button {
    min-height: 40px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    font: inherit;
    font-weight: 600;
    color: var(--texto);
  }

  .seg button.ativo {
    background: var(--navy-900);
    color: var(--gold-500);
  }

  .atual {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .link {
    border: 0;
    background: transparent;
    color: var(--texto);
    font: inherit;
    font-size: 0.8rem;
    text-decoration: underline;
    padding: 6px 0;
  }

  .topo,
  .grade {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .topo {
    margin-top: 12px;
  }

  .kpi {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    color: var(--texto);
    text-decoration: none;
  }

  .kpi strong {
    font-size: 1.6rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .neg {
    color: var(--erro);
  }

  .var {
    font-weight: 600;
    color: var(--ok, #1d7a46);
  }

  .var.neg {
    color: var(--erro);
  }

  small,
  .peq {
    color: var(--texto-suave);
    font-size: 0.78rem;
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
</style>
