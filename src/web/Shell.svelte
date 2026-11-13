<script lang="ts">
  // Moldura do painel web: barra lateral (barra superior com menu recolhível abaixo de 900px) e conteúdo largo
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { authStore } from '$lib/auth.svelte';
  import { sairWeb } from '$lib/web/auth-web';
  import simbolo from '$lib/assets/simbolo.png';

  let { children }: { children: Snippet } = $props();

  const MENU = [
    { href: '/admin', rotulo: 'Dashboard' },
    { href: '/admin/usuarios', rotulo: 'Usuários' },
    { href: '/admin/agendamentos', rotulo: 'Agendamentos' },
    { href: '/admin/pagamentos', rotulo: 'Pagamentos' },
    { href: '/admin/precos', rotulo: 'Serviços e preços' },
    { href: '/admin/custos', rotulo: 'Custos' },
    { href: '/admin/atividades', rotulo: 'Atividades' },
    { href: '/admin/avaliacoes', rotulo: 'Avaliações' },
    { href: '/admin/relatorios', rotulo: 'Relatórios' },
    { href: '/admin/mensagens', rotulo: 'Mensagens' }
  ];

  let aberto = $state(false);

  const ativo = (href: string) =>
    href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname === href || page.url.pathname.startsWith(href + '/');

  // Trocou de tela: recolhe o menu (tablet/celular)
  $effect(() => {
    page.url.pathname;
    aberto = false;
  });
</script>

<div class="web">
  <aside class:aberto>
    <div class="topo">
      <p class="marca">
        <img src={simbolo} alt="" width="36" height="36" />
        <span>Target Auto Spa<small>Painel administrativo</small></span>
      </p>
      <button type="button" class="hamb" aria-expanded={aberto} aria-controls="menu-web" onclick={() => (aberto = !aberto)}>
        {aberto ? 'Fechar' : 'Menu'}
      </button>
    </div>
    <div class="recolhivel" id="menu-web">
      <nav aria-label="Seções do painel">
        {#each MENU as m (m.href)}
          <a href={m.href} class:ativo={ativo(m.href)} aria-current={ativo(m.href) ? 'page' : undefined}>{m.rotulo}</a>
        {/each}
      </nav>
      <div class="rodape">
        <span>{authStore.perfil?.nome ?? ''}</span>
        <button type="button" onclick={() => sairWeb()}>Sair</button>
      </div>
    </div>
  </aside>
  <main>
    <div class="conteudo">{@render children()}</div>
  </main>
</div>

<style>
  .web { display: grid; grid-template-columns: 250px 1fr; min-height: 100dvh; background: linear-gradient(160deg, var(--navy-900) 0%, var(--navy-700) 100%); color: var(--texto-claro); }
  aside { background: var(--navy-900); border-right: 1px solid var(--superficie-borda); display: flex; flex-direction: column; padding: 20px 12px; position: sticky; top: 0; height: 100dvh; }
  .topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 20px; }
  .marca { display: flex; align-items: center; gap: 10px; margin: 0 8px; font-weight: 800; color: var(--texto-claro); }
  .marca span { display: flex; flex-direction: column; line-height: 1.2; }
  .marca small { font-weight: 500; color: var(--texto-claro-suave); font-size: 0.72rem; }
  .hamb { display: none; }
  .recolhivel { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  nav { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
  nav a { color: var(--texto-claro-suave); padding: 10px 12px; border-radius: 12px; font-weight: 600; }
  nav a:hover { background: var(--superficie); color: var(--texto-claro); }
  nav a.ativo { background: var(--gold-500); color: var(--navy-900); font-weight: 700; }
  nav a:focus-visible, .rodape button:focus-visible, .hamb:focus-visible { outline: 2px solid var(--gold-100); outline-offset: 2px; }
  .rodape { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.8rem; padding: 12px 8px 0; border-top: 1px solid var(--superficie-borda); color: var(--silver); }
  .rodape span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rodape button, .hamb { background: transparent; color: var(--silver); border: 1px solid var(--superficie-borda); border-radius: 10px; padding: 6px 12px; font-weight: 600; }
  .rodape button:hover, .hamb:hover { background: var(--superficie); }
  main { min-width: 0; padding: 24px 28px; }
  .conteudo { max-width: 1400px; margin: 0 auto; }
  /* Telas reaproveitadas do app: sem botão de voltar, folha com todos os cantos arredondados */
  .conteudo :global(.pagina) { min-height: 0; background: transparent; }
  .conteudo :global(.cab) { padding: 0 0 16px; }
  .conteudo :global(.cab-topo) { display: none; }
  .conteudo :global(.cab h1) { max-width: none; }
  .conteudo :global(.folha) { border-radius: var(--raio-grande); padding: 24px; }
  .conteudo :global(.folha-alca) { display: none; }

  @media (max-width: 899px) {
    .web { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    aside { position: static; height: auto; padding: 12px 16px; border-right: 0; border-bottom: 1px solid var(--superficie-borda); }
    .topo { margin-bottom: 0; }
    .hamb { display: inline-block; }
    .recolhivel { display: none; margin-top: 12px; }
    aside.aberto .recolhivel { display: flex; }
    main { padding: 16px; }
  }
</style>
