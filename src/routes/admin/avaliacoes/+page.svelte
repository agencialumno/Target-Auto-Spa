<script lang="ts">
  import TelaAdmin from '$lib/components/TelaAdmin.svelte';
  import { app } from '$lib/app.svelte';
  import { nomesItens } from '$lib/agendamentos';
</script>

<TelaAdmin titulo="Avaliações" sub="O que os clientes disseram">
  {#if app.avaliados.length === 0}
    <p class="vazio">Nenhuma avaliação ainda.</p>
  {/if}
  <div class="lista">
    {#each app.avaliados as a (a.id)}
      <div class="card aval">
        <strong>{nomesItens(a.itens)}</strong>
        <small>
          Nota {a.avaliacao?.nota}/5{#if typeof a.avaliacao?.nps === 'number'} · Indicação {a.avaliacao?.nps}/10{/if}
        </small>
        {#if a.avaliacao?.comentario}
          <p>“{a.avaliacao.comentario}”</p>
        {/if}
      </div>
    {/each}
  </div>
</TelaAdmin>

<style>
  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .aval {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .aval small {
    color: var(--texto-suave);
    font-size: 0.8rem;
  }

  .aval p {
    margin-top: 4px;
    font-size: 0.9rem;
    color: var(--texto-suave);
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
    padding: 24px 0;
  }
</style>
