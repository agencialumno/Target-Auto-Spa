<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/auth.svelte';
  import { decidirAcesso, listaDeEmails, MENSAGEM_NEGADO } from '$lib/web/acesso-admin';
  import { entrarComGoogleWeb, sairWeb } from '$lib/web/auth-web';
  import { traduzErro } from '$lib/auth-erros';

  const permitidos = listaDeEmails(import.meta.env.VITE_ADMIN_EMAILS);

  let email = $state('');
  let senha = $state('');
  let ocupado = $state(false);
  let erro = $state('');

  // Depois do login: admin segue para o painel; qualquer outro papel (ou sem perfil) é desconectado
  $effect(() => {
    if (authStore.carregando || !authStore.usuario) return;
    if (decidirAcesso(authStore.perfil, authStore.usuario.email, permitidos) === 'permitido') {
      goto('/admin', { replaceState: true });
    } else {
      erro = MENSAGEM_NEGADO;
      void sairWeb();
    }
  });

  async function entrar(acao: () => Promise<unknown>) {
    if (ocupado) return;
    ocupado = true;
    erro = '';
    try {
      await acao();
    } catch (e: any) {
      erro = traduzErro(e?.code);
    } finally {
      ocupado = false;
    }
  }
</script>

<main class="login">
  <h1>Target Auto Spa</h1>
  <p>Painel administrativo</p>

  <button type="button" disabled={ocupado} onclick={() => entrar(entrarComGoogleWeb)}>Entrar com Google</button>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      entrar(() => authStore.entrar(email, senha));
    }}
  >
    <input type="email" autocomplete="username" placeholder="E-mail" bind:value={email} required />
    <input type="password" autocomplete="current-password" placeholder="Senha" bind:value={senha} required />
    <button type="submit" disabled={ocupado}>{ocupado ? 'Aguarde...' : 'Entrar'}</button>
  </form>

  {#if erro}<p role="alert" class="erro">{erro}</p>{/if}
</main>

<style>
  .login { max-width: 360px; margin: 12vh auto; padding: 24px; display: flex; flex-direction: column; gap: 12px; }
  form { display: flex; flex-direction: column; gap: 10px; }
  input, button { min-height: 44px; padding: 0 12px; font: inherit; border-radius: 10px; }
  .erro { color: #b3261e; }
</style>
