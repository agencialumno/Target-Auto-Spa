<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import { authStore } from '$lib/auth.svelte';
  import { app, rotuloStatus, type Agendamento } from '$lib/app.svelte';
  import { angulos360 } from '$lib/mock';
  import { nomesItens } from '$lib/agendamentos';
  import { chaveData } from '$lib/agenda';
  import { dataCurta } from '$lib/formato';

  const hoje = chaveData(new Date());

  // Só os atendimentos atribuídos a este funcionário (as regras do Firestore também garantem isso)
  const doDia = $derived(
    app.agendamentos
      .filter((a) => a.data === hoje && a.status !== 'cancelado')
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
  );
  const proximos = $derived(
    app.agendamentos
      .filter((a) => a.data > hoje && a.status === 'agendado')
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
  );
</script>

{#snippet cartao(a: Agendamento)}
  <a class="item card" href={`/funcionario/${a.id}`}>
    <span class="hora">{a.hora}</span>
    <span class="textos">
      <strong>{nomesItens(a.itens)}</strong>
      <small>{a.data === hoje ? 'Hoje' : dataCurta(a.data)} · {a.veiculo.modelo || 'Veículo'} · {a.veiculo.placa || '-'}</small>
      <span class="rodape">
        <span class={`selo-status ${a.status}`}>{rotuloStatus[a.status]}</span>
        <small>
          Fotos: {app.fotosFeitas(a, 'antes')}/{angulos360.length} antes ·
          {app.fotosFeitas(a, 'depois')}/{angulos360.length} depois
        </small>
      </span>
    </span>
    <Icone nome="chevron" tamanho={20} />
  </a>
{/snippet}

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <button type="button" class="btn-voltar" aria-label="Sair" onclick={() => authStore.sair()}>
        <Icone nome="back" />
      </button>
    </div>
    <h1>Meus <em>atendimentos</em></h1>
    <p>{authStore.perfil?.nome}</p>
  </header>

  <section class="folha corpo">
    <div class="folha-alca"></div>

    {#if app.erro}<p class="vazio" role="alert">{app.erro}</p>{/if}

    <div class="secao-topo"><h2>Hoje</h2></div>
    {#if doDia.length === 0}
      <p class="vazio">Nenhum atendimento atribuído a você hoje.</p>
    {:else}
      <div class="lista">
        {#each doDia as a (a.id)}
          {@render cartao(a)}
        {/each}
      </div>
    {/if}

    {#if proximos.length}
      <div class="secao-topo espaco"><h2>Próximos dias</h2></div>
      <div class="lista">
        {#each proximos as a (a.id)}
          {@render cartao(a)}
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .corpo {
    padding-bottom: calc(32px + var(--safe-bottom));
  }

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

  .hora {
    flex: none;
    width: 54px;
    padding: 8px 0;
    text-align: center;
    border-radius: 12px;
    background: var(--navy-900);
    color: var(--gold-500);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .textos {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.3;
  }

  .textos > small {
    color: var(--texto-suave);
    font-size: 0.8rem;
  }

  .rodape {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    margin-top: 6px;
  }

  .rodape small {
    color: var(--texto-suave);
    font-size: 0.72rem;
  }

  .selo-status {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--info-fundo);
    color: var(--teal-700);
  }

  .selo-status.em_andamento {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
  }

  .selo-status.finalizado {
    background: var(--ok-fundo);
    color: var(--ok-texto);
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
    padding: 24px 0;
  }
</style>
