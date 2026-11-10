<script lang="ts">
  import Icone from './Icone.svelte';
  import type { Snippet } from 'svelte';

  // Moldura das seções do admin: cabeçalho com voltar para /admin, título e corpo com área segura
  let {
    titulo,
    destaque = '',
    sub = '',
    children
  }: { titulo: string; destaque?: string; sub?: string; children: Snippet } = $props();
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <a class="btn-voltar" href="/admin" aria-label="Voltar ao painel">
        <Icone nome="back" />
      </a>
    </div>
    <h1>{titulo}{#if destaque}&nbsp;<em>{destaque}</em>{/if}</h1>
    {#if sub}<p>{sub}</p>{/if}
  </header>

  <section class="folha corpo">
    <div class="folha-alca"></div>
    {@render children()}
  </section>
</div>

<style>
  .corpo {
    padding-bottom: calc(32px + var(--safe-bottom));
  }
</style>
