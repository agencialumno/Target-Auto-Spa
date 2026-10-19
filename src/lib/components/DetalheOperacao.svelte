<script lang="ts">
  import Icone from './Icone.svelte';
  import Checklist360 from './Checklist360.svelte';
  import { app, ordemStatus, rotuloStatus } from '$lib/app.svelte';
  import { getServico, brl } from '$lib/mock';
  import { dataExtensa } from '$lib/formato';

  let {
    id,
    voltar,
    editavel = false
  }: { id: string; voltar: string; editavel?: boolean } = $props();

  const ag = $derived(app.agendamentos.find((a) => a.id === id));
  const idx = $derived(ag ? ordemStatus.indexOf(ag.status) : 0);

  const nomes = $derived(
    ag
      ? ag.servicos
          .map((s) => getServico(s)?.nome)
          .filter(Boolean)
          .join(' + ')
      : ''
  );

  let aviso = $state('');

  function avancar() {
    if (!ag) return;
    aviso = app.avancarComRegras(ag.id) ?? '';
  }
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <a class="btn-voltar" href={voltar} aria-label="Voltar">
        <Icone nome="back" />
      </a>
    </div>
    <h1>{ag ? nomes : 'Agendamento não encontrado'}</h1>
    {#if ag}
      <p>{ag.cliente ?? 'Cliente'} · {ag.carro ?? 'Veículo'} · {ag.placa ?? '-'}</p>
    {/if}
  </header>

  <section class="folha corpo">
    <div class="folha-alca"></div>

    {#if ag}
      <div class="card quando">
        <Icone nome="calendar" tamanho={18} />
        <span>{dataExtensa(ag.data)} às {ag.hora}</span>
        <b>{brl(ag.total)}</b>
      </div>

      <h2>Andamento</h2>
      <ol class="linha-tempo">
        {#each ordemStatus as st, i}
          <li class:feito={i < idx} class:atual={i === idx}>
            <span class="bolinha">
              {#if i < idx || (i === idx && st === 'finalizado')}
                <Icone nome="check" tamanho={14} />
              {/if}
            </span>
            <strong>{rotuloStatus[st]}</strong>
          </li>
        {/each}
      </ol>

      <h2>Checklist do veículo (360º)</h2>
      <Checklist360 {ag} {editavel} />

      {#if ag.avaliacao}
        <h2>Avaliação do cliente</h2>
        <div class="card aval">
          <b>Nota {ag.avaliacao.nota}/5 · Indicação {ag.avaliacao.nps}/10</b>
          {#if ag.avaliacao.comentario}<p>“{ag.avaliacao.comentario}”</p>{/if}
        </div>
      {/if}
    {:else}
      <p class="vazio">Não encontramos este agendamento.</p>
    {/if}
  </section>

  {#if ag && editavel && ag.status !== 'finalizado'}
    <div class="cta">
      {#if aviso}<p class="aviso">{aviso}</p>{/if}
      <button class="btn-primario" onclick={avancar}>
        {ag.status === 'agendado' ? 'Iniciar atendimento' : 'Finalizar serviço'}
      </button>
    </div>
  {/if}
</div>

<style>
  .corpo {
    padding-bottom: calc(120px + var(--safe-bottom));
  }

  h2 {
    font-size: 1.05rem;
    margin: 22px 0 12px;
  }

  .quando {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    font-size: 0.92rem;
  }

  .quando span {
    flex: 1;
    text-transform: capitalize;
  }

  .linha-tempo {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .linha-tempo li {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    color: var(--texto-suave);
  }

  .linha-tempo li:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 11px;
    top: 26px;
    width: 2px;
    height: 18px;
    background: var(--card-borda);
  }

  .linha-tempo li.feito:not(:last-child)::after {
    background: var(--gold-500);
  }

  li.feito,
  li.atual {
    color: var(--texto);
  }

  .bolinha {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--white);
    border: 2px solid var(--card-borda);
    color: var(--navy-900);
  }

  li.feito .bolinha,
  li.atual .bolinha {
    background: var(--gold-500);
    border-color: var(--gold-500);
  }

  .aval {
    padding: 14px 16px;
    font-size: 0.92rem;
  }

  .aval p {
    margin-top: 4px;
    color: var(--texto-suave);
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
    padding: 16px 0;
  }

  .cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    padding: 12px 20px calc(12px + var(--safe-bottom));
    background: var(--white);
    border-top: 1px solid var(--card-borda);
  }

  .aviso {
    margin-bottom: 8px;
    font-size: 0.85rem;
    color: var(--erro);
    text-align: center;
  }
</style>