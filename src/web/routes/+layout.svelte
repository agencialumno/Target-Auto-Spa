<script lang="ts">
  import '@fontsource-variable/plus-jakarta-sans';
  import '../../app.css';
  import '$lib/painel.css';
  import '../web.css';
  import favicon from '../assets/favicon-32.png';
  import appleTouch from '../assets/apple-touch-icon.png';
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
  <title>Target Auto Spa · Painel</title>
  <link rel="icon" type="image/png" sizes="32x32" href={favicon} />
  <link rel="apple-touch-icon" sizes="180x180" href={appleTouch} />
</svelte:head>

{@render children()}
