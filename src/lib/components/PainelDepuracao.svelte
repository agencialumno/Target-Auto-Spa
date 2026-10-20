<script lang="ts">
  import { DEPURACAO } from '$lib/config';
  import { depuracao } from '$lib/debug.svelte';

  let aberto = $state(true);
</script>

{#if DEPURACAO}
  <aside class="painel" aria-label="Depuração">
    <button type="button" class="alterna" onclick={() => (aberto = !aberto)}>
      Depuração ({depuracao.linhas.length}) {aberto ? '▾' : '▸'}
    </button>
    {#if aberto}
      <pre>{depuracao.linhas.join('\n') || '(sem eventos)'}</pre>
    {/if}
  </aside>
{/if}

<style>
  .painel {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: calc(8px + var(--safe-bottom));
    z-index: 50;
    max-height: 38dvh;
    overflow: auto;
    background: var(--superficie);
    border: 1px solid var(--superficie-borda);
    border-radius: 12px;
    color: var(--texto-claro);
    font-size: 0.68rem;
  }

  .alterna {
    width: 100%;
    padding: 8px 10px;
    background: none;
    color: var(--gold-500);
    text-align: left;
    font-weight: 700;
    font-size: 0.72rem;
  }

  pre {
    padding: 0 10px 10px;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
    -webkit-user-select: text;
  }
</style>
