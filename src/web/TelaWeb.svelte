<script lang="ts">
  // Moldura de uma tela do painel web: cabeçalho sobre o fundo navy e folha clara, como as telas /admin do app
  import type { Snippet } from 'svelte';
  let { titulo, sub = '', children }: { titulo: string; sub?: string; children: Snippet } = $props();
</script>

<div class="pagina">
  <header class="cab">
    <h1>{titulo}</h1>
    {#if sub}<p>{sub}</p>{/if}
  </header>
  <section class="folha corpo">{@render children()}</section>
</div>

<style>
  .corpo { border-radius: var(--raio-grande); padding: 24px; min-height: 240px; }
</style>
