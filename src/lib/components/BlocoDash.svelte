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
    <div class="esq" role="status"><span class="so-leitor">Carregando...</span><i></i><i></i></div>
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
  .esq {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .esq i {
    height: 64px;
    border-radius: 14px;
    background: linear-gradient(90deg, var(--card-borda) 25%, transparent 50%, var(--card-borda) 75%) var(--card);
    background-size: 200% 100%;
    animation: brilho 1.2s linear infinite;
  }
  .so-leitor {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  @keyframes brilho {
    to {
      background-position: -200% 0;
    }
  }
</style>
