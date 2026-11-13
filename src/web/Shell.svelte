<script lang="ts">
  // Moldura do painel web: barra lateral e área de conteúdo larga
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { authStore } from '$lib/auth.svelte';
  import { sairWeb } from '$lib/web/auth-web';

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

  const ativo = (href: string) =>
    href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<div class="web">
  <aside>
    <p class="marca">Target Auto Spa<small>Painel administrativo</small></p>
    <nav aria-label="Seções do painel">
      {#each MENU as m (m.href)}
        <a href={m.href} class:ativo={ativo(m.href)} aria-current={ativo(m.href) ? 'page' : undefined}>{m.rotulo}</a>
      {/each}
    </nav>
    <div class="rodape">
      <span>{authStore.perfil?.nome ?? ''}</span>
      <button type="button" onclick={() => sairWeb()}>Sair</button>
    </div>
  </aside>
  <main>
    <div class="conteudo">{@render children()}</div>
  </main>
</div>

<style>
  .web { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; background: #eef1f5; color: #1c2430; }
  aside { background: #0d1b2e; color: #fff; display: flex; flex-direction: column; padding: 20px 12px; position: sticky; top: 0; height: 100vh; }
  .marca { font-weight: 700; margin: 0 8px 20px; display: flex; flex-direction: column; }
  .marca small { font-weight: 400; color: #aab4c3; font-size: 0.75rem; }
  nav { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
  nav a { color: #dbe2ec; text-decoration: none; padding: 10px 12px; border-radius: 8px; }
  nav a:hover { background: rgba(255, 255, 255, 0.08); }
  nav a.ativo { background: #c9a24a; color: #0d1b2e; font-weight: 600; }
  .rodape { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.8rem; padding: 8px; }
  .rodape span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rodape button { background: transparent; color: #fff; border: 1px solid #5b6a80; border-radius: 6px; padding: 4px 10px; cursor: pointer; }
  main { min-width: 0; padding: 28px 32px; }
  .conteudo { max-width: 1400px; margin: 0 auto; }
  /* Telas reaproveitadas do app: sem moldura de celular, cabeçalho escuro sobre fundo claro */
  .conteudo :global(.pagina) { background: transparent; min-height: 0; }
  .conteudo :global(.cab) { color: #0d1b2e; padding: 0 0 16px; }
  .conteudo :global(.cab-topo) { display: none; }
  .conteudo :global(.cab p) { color: #556070; }
  .conteudo :global(.cab h1) { max-width: none; }
  .conteudo :global(.cab h1 em) { color: #8a6a1c; }
  .conteudo :global(.folha) { border-radius: 12px; }
  .conteudo :global(.folha-alca) { display: none; }
</style>
