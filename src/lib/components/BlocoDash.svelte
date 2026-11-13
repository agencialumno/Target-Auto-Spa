<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { EstadoBloco } from '$lib/bloco.svelte';

  // Moldura de um bloco do dashboard: título + um dos 4 estados
  let {
    titulo,
    estado,
    erro = '',
    vazio = 'Sem dados.',
    aoTentar,
    children
  }: { titulo: string; estado: EstadoBloco; erro?: string; vazio?: string; aoTentar: () => void; children: Snippet } = $props();
</script>

<section class="bloco" aria-label={titulo} aria-busy={estado === 'carregando'}>
  <h2>{titulo}</h2>
  {#if estado === 'carregando'}
    <p class="peq" role="status">Carregando...</p>
  {:else if estado === 'erro'}
    <p class="erro" role="alert">{erro}</p>
    <button type="button" class="btn-secundario" onclick={aoTentar}>Tentar de novo</button>
  {:else if estado === 'vazio'}
    <p class="peq">{vazio}</p>
  {:else}
    {@render children()}
  {/if}
</section>

<style>
  h2 {
    margin: 18px 0 8px;
    font-size: 1rem;
  }
  .peq {
    color: var(--texto-suave);
    font-size: 0.78rem;
  }
</style>
