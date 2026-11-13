<script lang="ts">
  import '@fontsource-variable/plus-jakarta-sans';
  import '../../app.css';
  import '$lib/painel.css';
  import { authStore } from '$lib/auth.svelte';
  import { app } from '$lib/app.svelte';
  import { iniciarCatalogo, pararCatalogo } from '$lib/catalogo.svelte';

  let { children } = $props();

  // Liga as escutas do Firestore só para quem é admin; desliga ao sair
  $effect(() => {
    const u = authStore.usuario;
    const p = authStore.perfil;
    if (u && p?.role === 'admin') {
      app.iniciar({ uid: u.uid, nome: p.nome, role: p.role, condominioId: p.condominioId });
      iniciarCatalogo();
    } else if (!authStore.carregando) {
      app.parar();
      pararCatalogo();
    }
  });
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
  <title>Target Auto Spa | Admin</title>
</svelte:head>

{@render children()}
