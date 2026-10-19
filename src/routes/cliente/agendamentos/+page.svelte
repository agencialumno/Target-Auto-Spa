<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import { app, rotuloStatus, type Agendamento } from '$lib/app.svelte';
  import { getServico, brl } from '$lib/mock';
  import { dataCurta } from '$lib/formato';

  const andamento = $derived(app.agendamentos.filter((a) => a.status !== 'finalizado'));
  const historico = $derived(app.agendamentos.filter((a) => a.status === 'finalizado'));

  const nomes = (a: Agendamento) =>
    a.servicos
      .map((id) => getServico(id)?.nome)
      .filter(Boolean)
      .join(' + ');
</script>

{#snippet cartao(a: Agendamento)}
  <a class="item card" href={`/cliente/agendamentos/${a.id}`}>
    <span class="textos">
      <strong>{nomes(a)}</strong>
      <small class="quando">{dataCurta(a.data)} às {a.hora}</small>
      <span class="rodape">
        <span class={`selo-status ${a.status}`}>{rotuloStatus[a.status]}</span>
        <b>{brl(a.total)}</b>
      </span>
    </span>
    <Icone nome="chevron" tamanho={20} />
  </a>
{/snippet}

<div class="pagina">
  <header class="cab">
    <h1>Meus <em>agendamentos</em></h1>
  </header>

  <section class="folha com-barra">
    <div class="folha-alca"></div>

    {#if app.agendamentos.length === 0}
      <div class="vazio">
        <p>Você ainda não tem agendamentos.</p>
        <a class="btn-primario" href="/cliente/servicos">Agendar um serviço</a>
      </div>
    {:else}
      {#if andamento.length}
        <div class="secao-topo"><h2>Em andamento</h2></div>
        <div class="lista">
          {#each andamento as a (a.id)}
            {@render cartao(a)}
          {/each}
        </div>
      {/if}

      {#if historico.length}
        <div class="secao-topo espaco"><h2>Histórico</h2></div>
        <div class="lista">
          {#each historico as a (a.id)}
            {@render cartao(a)}
          {/each}
        </div>
      {/if}
    {/if}
  </section>
</div>

<style>
  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .espaco {
    margin-top: 22px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    color: var(--texto);
  }

  .textos {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.3;
  }

  .quando {
    color: var(--texto-suave);
    text-transform: capitalize;
  }

  .rodape {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  .selo-status {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--info-fundo);
    color: var(--teal-700);
  }

  .selo-status.em-atendimento {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
  }

  .selo-status.finalizado {
    background: var(--ok-fundo);
    color: var(--ok-texto);
  }

  .vazio {
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: center;
    color: var(--texto-suave);
    padding: 24px 0;
  }

  .vazio :global(.btn-primario) {
    display: block;
  }
</style>