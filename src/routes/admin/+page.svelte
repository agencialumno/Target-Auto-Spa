<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import { authStore } from '$lib/auth.svelte';
  import { app } from '$lib/app.svelte';
  import { servicos } from '$lib/catalogo.svelte';
  import PainelDashboard from '$lib/components/PainelDashboard.svelte';
  import { contarCondominios, contarUsuarios, plural } from '$lib/admin-resumo';

  let usuarios = $state<number | null>(null);
  let condominios = $state<number | null>(null);

  $effect(() => {
    contarUsuarios().then((n) => (usuarios = n)).catch(() => {});
    contarCondominios().then((n) => (condominios = n)).catch(() => {});
  });

  const cartoes = $derived([
    {
      href: '/admin/agendamentos',
      icone: 'calendar',
      titulo: 'Agendamentos',
      contexto: plural(app.agendamentos.length, 'agendamento', 'agendamentos')
    },
    {
      href: '/admin/precos',
      icone: 'sparkle',
      titulo: 'Serviços e preços',
      contexto: plural(servicos.length, 'serviço', 'serviços')
    },
    {
      href: '/admin/avaliacoes',
      icone: 'star',
      titulo: 'Avaliações',
      contexto: plural(app.avaliados.length, 'avaliação', 'avaliações')
    },
    {
      href: '/admin/usuarios',
      icone: 'user',
      titulo: 'Usuários',
      contexto: usuarios === null ? 'Carregando...' : plural(usuarios, 'usuário', 'usuários')
    },
    {
      href: '/admin/custos',
      icone: 'sparkle',
      titulo: 'Custos',
      contexto: 'Custos operacionais'
    },
    {
      href: '/admin/atividades',
      icone: 'calendar',
      titulo: 'Atividades',
      contexto: 'Histórico de ações'
    },
    {
      href: '/admin/condominios',
      icone: 'home',
      titulo: 'Condomínios',
      contexto: condominios === null ? 'Carregando...' : plural(condominios, 'condomínio', 'condomínios')
    }
  ]);
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <button type="button" class="btn-voltar" aria-label="Sair" onclick={() => authStore.sair()}>
        <Icone nome="back" />
      </button>
    </div>
    <h1>Painel do <em>administrador</em></h1>
    <p>Visão geral de todos os condomínios</p>
  </header>

  <section class="folha corpo">
    <div class="folha-alca"></div>

    <PainelDashboard />

    <h2 class="gestao">Gestão</h2>

    <nav class="cartoes" aria-label="Seções do painel">
      {#each cartoes as c (c.href)}
        <a class="secao card" href={c.href}>
          <span class="icone"><Icone nome={c.icone} tamanho={26} /></span>
          <span class="textos">
            <strong>{c.titulo}</strong>
            <small>{c.contexto}</small>
          </span>
          <Icone nome="chevron" tamanho={20} />
        </a>
      {/each}
    </nav>
  </section>
</div>

<style>
  .corpo {
    padding-bottom: calc(32px + var(--safe-bottom));
  }

  .gestao {
    margin: 28px 0 0;
    font-size: 1rem;
  }

  .cartoes {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 10px;
  }

  .secao {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 76px;
    padding: 16px;
    color: var(--texto);
    text-decoration: none;
  }

  .icone {
    flex: none;
    width: 48px;
    height: 48px;
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
    gap: 2px;
  }

  .textos strong {
    font-size: 1.05rem;
  }

  .textos small {
    color: var(--texto-suave);
    font-size: 0.82rem;
  }
</style>
