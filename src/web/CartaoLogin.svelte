<script lang="ts">
  // Tela de login do painel web (só apresentação; a lógica de acesso fica em Entrada.svelte)
  import logo from '$lib/assets/logo.png';
  let { ocupado = false, erro = '', aoEntrar }: { ocupado?: boolean; erro?: string; aoEntrar: () => void } = $props();
</script>

<main class="tela">
  <section class="cartao">
    <img class="logo" src={logo} alt="Grupo Target Auto Spa" width="756" height="197" />
    <h1>Painel administrativo</h1>
    <p class="sub">Acesso restrito à administração.</p>
    <button type="button" class="btn-primario" disabled={ocupado} aria-busy={ocupado} onclick={aoEntrar}>
      {ocupado ? 'Aguarde...' : 'Entrar com Google'}
    </button>
    {#if erro}<p role="alert" class="erro">{erro}</p>{/if}
  </section>
</main>

<style>
  .tela { min-height: 100dvh; display: grid; place-items: center; padding: 24px; background: linear-gradient(160deg, var(--navy-900) 0%, var(--navy-700) 100%); }
  .cartao { width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 32px 28px; text-align: center; background: var(--superficie); border: 1px solid var(--superficie-borda); border-radius: var(--raio-grande); }
  .logo { width: 100%; max-width: 280px; height: auto; margin-bottom: 8px; }
  h1 { font-size: 1.5rem; color: var(--texto-claro); }
  .sub { color: var(--texto-claro-suave); font-size: 0.95rem; }
  button { margin-top: 8px; }
  button:disabled { opacity: 0.6; cursor: progress; }
  button:focus-visible { outline: 3px solid var(--gold-100); outline-offset: 3px; }
  .erro { color: var(--erro-vivo); font-size: 0.9rem; }
</style>
