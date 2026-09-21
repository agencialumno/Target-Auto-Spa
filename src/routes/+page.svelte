<script lang="ts">
  import { goto } from '$app/navigation';
  import Icone from '$lib/components/Icone.svelte';
  import logo from '$lib/assets/logo.png';

  const opcoes = [
    {
      rota: '/cliente',
      icone: 'user',
      titulo: 'Sou cliente',
      descricao: 'Agende serviços e acompanhe cada etapa'
    },
    {
      rota: '/gerente',
      icone: 'check',
      titulo: 'Sou gerente do local',
      descricao: 'Agenda do dia, checklist e fotos'
    },
    {
      rota: '/admin',
      icone: 'shield',
      titulo: 'Administrador',
      descricao: 'Visão geral de tudo'
    },
    {
      rota: '/insulfilm',
      icone: 'layers',
      titulo: 'Instalador de insulfilm',
      descricao: 'Agenda separada do profissional externo'
    }
  ];
</script>

<main class="tela">
  <section class="cabecalho">
    <img class="logo" src={logo} alt="Grupo Target Auto Spa" />
    <h1>
      O cuidado que seu carro merece,
      <span class="destaque">a poucos passos da sua porta.</span>
    </h1>
    <p>Produtos biodegradáveis, sem soda cáustica. Agende em poucos toques.</p>
  </section>

  <section class="folha">
    <div class="folha-alca"></div>
    <h2 class="titulo-folha">Como você quer entrar?</h2>

    <div class="lista">
      {#each opcoes as opcao}
        <button class="opcao card" onclick={() => goto(opcao.rota)}>
          <span class="icone"><Icone nome={opcao.icone} /></span>
          <span class="textos">
            <strong>{opcao.titulo}</strong>
            <small>{opcao.descricao}</small>
          </span>
          <span class="seta"><Icone nome="chevron" tamanho={20} /></span>
        </button>
      {/each}
    </div>
  </section>
</main>

<style>
  .tela {
    width: 100%;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    background: linear-gradient(160deg, var(--navy-900) 0%, var(--navy-700) 100%);
  }

  .cabecalho {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: calc(32px + var(--safe-top)) 20px 32px;
  }

  .logo {
    width: min(74%, 300px);
    height: auto;
    margin-bottom: 32px;
  }

  .cabecalho h1 {
    width: 100%;
    max-width: 340px;
    font-size: 1.4rem;
    line-height: 1.25;
    color: var(--white);
  }

  .destaque {
    color: var(--gold-500);
  }

  .cabecalho p {
    width: 100%;
    max-width: 320px;
    margin-top: 14px;
    color: var(--silver);
    font-size: 0.95rem;
  }

  .titulo-folha {
    font-size: 1.15rem;
    margin-bottom: 14px;
  }

  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .opcao {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-width: 0;
    padding: 14px;
    text-align: left;
    color: var(--texto);
  }

  .icone {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: var(--navy-900);
    color: var(--gold-500);
  }

  .textos {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  .textos strong {
    font-size: 0.98rem;
  }

  .textos small {
    color: var(--texto-suave);
    font-size: 0.8rem;
  }

  .seta {
    flex: none;
    color: var(--texto-suave);
  }
</style>