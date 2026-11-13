<script lang="ts">
  // Porta do painel web: sem login mostra o botão do Google; admin passa; qualquer outro é desconectado.
  import type { Snippet } from 'svelte';
  import { authStore } from '$lib/auth.svelte';
  import { decidirAcesso, listaDeEmails, MENSAGEM_NEGADO } from '$lib/web/acesso-admin';
  import { entrarComGoogleWeb, sairWeb } from '$lib/web/auth-web';
  import { traduzErro } from '$lib/auth-erros';

  let { children }: { children: Snippet } = $props();

  const permitidos = listaDeEmails(import.meta.env.VITE_ADMIN_EMAILS);

  let ocupado = $state(false);
  let erro = $state('');

  const decisao = $derived(
    authStore.carregando || !authStore.usuario
      ? null
      : decidirAcesso(authStore.perfil, authStore.usuario.email, permitidos)
  );

  // Logado sem ser admin: mensagem e desconexão imediata
  $effect(() => {
    if (decisao === 'negado') {
      erro = MENSAGEM_NEGADO;
      void sairWeb();
    }
  });

  async function google() {
    if (ocupado) return;
    ocupado = true;
    erro = '';
    try {
      await entrarComGoogleWeb();
    } catch (e: any) {
      erro = traduzErro(e?.code);
    } finally {
      ocupado = false;
    }
  }
</script>

{#if decisao === 'permitido'}
  {@render children()}
{:else if !authStore.carregando}
  <main class="login">
    <h1>Target Auto Spa</h1>
    <p>Painel administrativo</p>
    <button type="button" disabled={ocupado} onclick={google}>{ocupado ? 'Aguarde...' : 'Entrar com Google'}</button>
    {#if erro}<p role="alert" class="erro">{erro}</p>{/if}
  </main>
{/if}

<style>
  .login { max-width: 360px; margin: 12vh auto; padding: 24px; display: flex; flex-direction: column; gap: 12px; }
  button { min-height: 44px; padding: 0 12px; font: inherit; border-radius: 10px; }
  .erro { color: #b3261e; }
</style>
