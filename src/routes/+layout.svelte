<script lang="ts">
  import '@fontsource-variable/plus-jakarta-sans';
  import '../app.css';
  import '$lib/painel.css';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Splash from '$lib/components/Splash.svelte';

  let { children } = $props();

  let mostrarSplash = $state(true);

  onMount(() => {
    const tempo = setTimeout(() => (mostrarSplash = false), 2200);
    return () => clearTimeout(tempo);
  });
</script>

{@render children()}

{#if mostrarSplash}
  <div out:fade={{ duration: 400 }}>
    <Splash />
  </div>
{/if}