<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore, type Papel } from '$lib/auth.svelte';
  import type { Snippet } from 'svelte';

  let { papel, children }: { papel: Papel; children: Snippet } = $props();

  const autorizado = $derived(
    !authStore.carregando && !!authStore.usuario && authStore.perfil?.role === papel
  );

  // Sem login, sem perfil ou papel errado: volta para a tela de login
  $effect(() => {
    if (authStore.carregando) return;
    if (!authStore.usuario || authStore.perfil?.role !== papel) goto('/', { replaceState: true });
  });
</script>

{#if autorizado}
  {@render children()}
{/if}
