<script lang="ts">
  import '@fontsource-variable/plus-jakarta-sans';
  import '../app.css';
  import '$lib/painel.css';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Splash from '$lib/components/Splash.svelte';
  import { depuracao } from '$lib/debug.svelte';

  depuracao.iniciar();

  let { children } = $props();

  let mostrarSplash = $state(true);

  onMount(() => {
    const tempo = setTimeout(() => (mostrarSplash = false), 2200);

    // iOS (WKWebView) ainda dispara zoom por pinça mesmo com user-scalable=no
    const bloquear = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', bloquear);
    document.addEventListener('gesturechange', bloquear);
    document.addEventListener('gestureend', bloquear);

    return () => {
      clearTimeout(tempo);
      document.removeEventListener('gesturestart', bloquear);
      document.removeEventListener('gesturechange', bloquear);
      document.removeEventListener('gestureend', bloquear);
    };
  });
</script>

{@render children()}

{#if mostrarSplash}
  <div out:fade={{ duration: 400 }}>
    <Splash />
  </div>
{/if}