<script lang="ts">
  import { goto } from '$app/navigation';
  import logo from '$lib/assets/logo.png';
  import { authStore } from '$lib/auth.svelte';

  type Modo = 'entrar' | 'cadastrar';
  let modo: Modo = $state('entrar');

  let nome = $state('');
  let email = $state('');
  let senha = $state('');
  let carregando = $state(false);

  $effect(() => {
    if (authStore.carregando || !authStore.usuario || !authStore.perfil) return;
    const p = authStore.perfil;
    if (p.role === 'cliente') {
      goto(p.condominioId ? '/cliente' : '/entrar-condominio');
    } else if (p.role === 'gerente') {
      goto('/gerente');
    } else if (p.role === 'admin') {
      goto('/admin');
    } else if (p.role === 'insulfilm') {
      goto('/insulfilm');
    }
  });

  async function enviar() {
    carregando = true;
    try {
      if (modo === 'cadastrar') {
        await authStore.cadastrar(nome, email, senha);
      } else {
        await authStore.entrar(email, senha);
      }
    } catch {
      // erro já fica em authStore.erro
    } finally {
      carregando = false;
    }
  }

  async function comGoogle() {
    carregando = true;
    try {
      await authStore.entrarComGoogle();
    } catch {
      //
    } finally {
      carregando = false;
    }
  }

  async function comApple() {
    carregando = true;
    try {
      await authStore.entrarComApple();
    } catch {
      //
    } finally {
      carregando = false;
    }
  }
</script>

<main class="tela">
  <section class="cabecalho">
    <img class="logo" src={logo} alt="Grupo Target Auto Spa" />
    <h1>
      O cuidado que seu carro merece,
      <span class="destaque">a poucos passos da sua porta.</span>
    </h1>
  </section>

  <section class="folha">
    <div class="folha-alca"></div>

    <div class="abas">
      <button class="aba" class:on={modo === 'entrar'} onclick={() => (modo = 'entrar')}>
        Entrar
      </button>
      <button class="aba" class:on={modo === 'cadastrar'} onclick={() => (modo = 'cadastrar')}>
        Criar conta
      </button>
    </div>

    <form class="form" onsubmit={(e) => (e.preventDefault(), enviar())}>
      {#if modo === 'cadastrar'}
        <label class="campo">
          <span>Nome</span>
          <input
