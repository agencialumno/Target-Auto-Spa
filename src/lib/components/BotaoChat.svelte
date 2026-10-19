<script lang="ts">
  import Icone from './Icone.svelte';

  let {
    href,
    contagem = 0,
    rotulo = 'Falar com o gerente'
  }: { href: string; contagem?: number; rotulo?: string } = $props();

  const textoAcessivel = $derived(
    contagem > 0
      ? rotulo + ' (' + contagem + (contagem === 1 ? ' nova)' : ' novas)')
      : rotulo
  );

  const numero = $derived(contagem > 9 ? '9+' : String(contagem));
</script>

<a class="btn-chat" {href} aria-label={textoAcessivel}>
  <Icone nome="chat" />
  {#if contagem > 0}
    <span class="selo">{numero}</span>
  {/if}
</a>

<style>
  .btn-chat {
    position: relative;
    flex: none;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.12);
    color: var(--white);
  }

  .selo {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--erro-vivo);
    color: var(--white);
    border: 2px solid var(--navy-900);
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1;
  }
</style>