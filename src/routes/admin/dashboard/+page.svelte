<script lang="ts">
  import TelaAdmin from '$lib/components/TelaAdmin.svelte';
  import { app, rotuloStatus } from '$lib/app.svelte';
  import { brlCentavos } from '$lib/agendamentos';
  import { somarCustos, nomeCategoria } from '$lib/custos';
  import { listarCustos } from '$lib/custos-admin';
  import {
    cartoesTempoReal,
    detalharPeriodo,
    limitesDoPeriodo,
    rentabilidade,
    STATUS_ORDEM,
    ticketMedio,
    type Detalhe
  } from '$lib/dashboard';
  import { agendamentosDoPeriodo, contarPorStatus, contarUsuarios, faturamento, ultimasMovimentacoes } from '$lib/dashboard-dados';
  import { descreverMudanca, rotuloAcao, type Atividade } from '$lib/atividades-consulta';

  const mesAtual = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  let de = $state(mesAtual());
  let ate = $state(mesAtual());
  let carregando = $state(false);
  let erro = $state('');

  let usuarios = $state<Record<string, number> | null>(null);
  let porStatus = $state<Record<string, number> | null>(null);
  let receita = $state<{ centavos: number; pagos: number } | null>(null);
  let custos = $state<{ totalCentavos: number; porCategoria: Record<string, number> } | null>(null);
  let movimentos = $state<Atividade[]>([]);
  let detalhe = $state<Detalhe | null>(null);
  let carregandoDetalhe = $state(false);

  // Cartões do topo em tempo real: sobre o que o app já escuta (sem leitura extra)
  let agora = $state(new Date());
  $effect(() => {
    const t = setInterval(() => (agora = new Date()), 30_000);
    return () => clearInterval(t);
  });
  const tempoReal = $derived(cartoesTempoReal(app.agendamentos, agora));

  const limites = $derived(limitesDoPeriodo(de, ate));
  const resultado = $derived(receita && custos ? rentabilidade(receita.centavos, custos.totalCentavos) : null);

  async function carregar() {
    if (!limites || carregando) {
      if (!limites) erro = 'Período inválido: o mês final não pode ser antes do inicial.';
      return;
    }
    carregando = true;
    erro = '';
    detalhe = null;
    try {
      const [u, s, r, c, m] = await Promise.all([
        contarUsuarios(),
        contarPorStatus(limites.inicio, limites.fim),
        faturamento(limites.inicio, limites.fim),
        listarCustos(),
        ultimasMovimentacoes(20)
      ]);
      usuarios = u;
      porStatus = s;
      receita = r;
      custos = somarCustos(c, de, ate);
      movimentos = m;
    } catch (e) {
      const codigo = (e as { code?: string })?.code;
      erro =
        codigo === 'failed-precondition'
          ? 'Falta um índice do Firestore para esta consulta. O link para criá-lo aparece no console do navegador.'
          : 'Não foi possível carregar o dashboard.';
    } finally {
      carregando = false;
    }
  }

  async function carregarDetalhe() {
    if (!limites || carregandoDetalhe) return;
    carregandoDetalhe = true;
    try {
      detalhe = detalharPeriodo(await agendamentosDoPeriodo(limites.inicio, limites.fim));
    } catch {
      erro = 'Não foi possível carregar os detalhes.';
    } finally {
      carregandoDetalhe = false;
    }
  }

  $effect(() => {
    carregar();
  });

  const quando = (d: Date | null) => (d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
  const totalAgendamentos = $derived(porStatus ? STATUS_ORDEM.reduce((s, k) => s + (porStatus![k] ?? 0), 0) : 0);
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

  <form class="periodo" onsubmit={(e) => (e.preventDefault(), carregar())}>
    <label><span>De</span><input type="month" bind:value={de} /></label>
    <label><span>Até</span><input type="month" bind:value={ate} /></label>
    <button class="btn-primario" type="submit" disabled={carregando}>{carregando ? 'Atualizando...' : 'Atualizar'}</button>
  </form>

  {#if erro}<p class="erro" role="alert">{erro}</p>{/if}

  {#if resultado && receita && custos}
    <h2>Financeiro</h2>
    <div class="grade">
      <div class="kpi card"><small>Faturamento (pagos)</small><strong>{brlCentavos(resultado.faturamentoCentavos)}</strong><small>{receita.pagos} pagamentos</small></div>
      <div class="kpi card"><small>Custos</small><strong>{brlCentavos(resultado.custosCentavos)}</strong></div>
      <div class="kpi card">
        <small>Rentabilidade</small>
        <strong class:neg={resultado.resultadoCentavos < 0}>{brlCentavos(resultado.resultadoCentavos)}</strong>
        <small>{resultado.margemPct === null ? 'sem receita' : `margem ${resultado.margemPct}%`}</small>
      </div>
      <div class="kpi card"><small>Ticket médio</small><strong>{brlCentavos(ticketMedio(receita.centavos, receita.pagos))}</strong></div>
    </div>
    {#if Object.keys(custos.porCategoria).length}
      <p class="peq">
        Custos por categoria:
        {#each Object.entries(custos.porCategoria) as [c, v], i}{i ? ' · ' : ''}{nomeCategoria(c)} {brlCentavos(v)}{/each}
      </p>
    {/if}
  {/if}

  {#if porStatus}
    <h2>Agendamentos no período ({totalAgendamentos})</h2>
    <div class="grade">
      {#each STATUS_ORDEM as s}
        <div class="kpi card"><small>{rotuloStatus[s]}</small><strong>{porStatus[s]}</strong></div>
      {/each}
    </div>
    <p class="peq">"Realizados" = em atendimento + finalizados; "concluídos" = finalizados; "pendentes" = agendados.</p>
  {/if}

  {#if usuarios}
    <h2>Usuários</h2>
    <div class="grade">
      <div class="kpi card"><small>Clientes</small><strong>{usuarios.cliente}</strong></div>
      <div class="kpi card"><small>Gerentes</small><strong>{usuarios.gerente}</strong></div>
      <div class="kpi card"><small>Funcionários</small><strong>{usuarios.funcionario}</strong></div>
      <div class="kpi card"><small>Administradores</small><strong>{usuarios.admin}</strong></div>
    </div>
  {/if}

  <h2>Serviços e desempenho</h2>
  {#if !detalhe}
    <button class="btn-secundario" onclick={carregarDetalhe} disabled={carregandoDetalhe || !limites}>
      {carregandoDetalhe ? 'Carregando...' : 'Carregar detalhes do período'}
    </button>
    <p class="peq">Abre até 500 agendamentos do período (leitura maior), por isso só sob demanda.</p>
  {:else}
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

  <h2>Últimas movimentações</h2>
  {#if movimentos.length === 0}
    <p class="peq">Nenhuma atividade registrada ainda.</p>
  {:else}
    <ul class="mov">
      {#each movimentos as a (a.id)}
        <li>
          <b>{rotuloAcao[a.acao] ?? a.acao}</b> <small>{quando(a.em)}</small>
          {#if a.antes || a.depois}<small>{descreverMudanca(a)}</small>{/if}
        </li>
      {/each}
    </ul>
    <a class="btn-secundario ver" href="/admin/atividades">Ver todas</a>
  {/if}
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
