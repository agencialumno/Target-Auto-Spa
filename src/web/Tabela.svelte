<script lang="ts" generics="T">
  // Tabela do painel web: ordenação por coluna, paginação e os três estados sempre visíveis
  // (carregando, vazio e erro com o código do Firestore). Textos entram escapados ({}), nunca como HTML.
  import { ordenar, paginar, type Coluna, type Direcao } from '$lib/web/tabela';

  let {
    colunas,
    linhas,
    carregando = false,
    erro = '',
    vazio = 'Nada para mostrar.',
    porPagina = 25,
    ordemInicial,
    aoTentarDeNovo,
    legenda = ''
  }: {
    colunas: Coluna<T>[];
    linhas: T[];
    carregando?: boolean;
    erro?: string;
    vazio?: string;
    porPagina?: number;
    ordemInicial?: { coluna: string; dir: Direcao };
    aoTentarDeNovo?: () => void;
    legenda?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let ordem = $state<{ coluna: string; dir: Direcao } | null>(ordemInicial ?? null);
  let pagina = $state(1);

  const ordenadas = $derived.by(() => {
    const col = colunas.find((c) => c.id === ordem?.coluna);
    return col?.chave && ordem ? ordenar(linhas, col.chave, ordem.dir) : linhas;
  });
  const pg = $derived(paginar(ordenadas, pagina, porPagina));

  // Mudou o conjunto de linhas: volta para a página 1
  $effect(() => {
    linhas;
    pagina = 1;
  });

  function alternar(c: Coluna<T>) {
    if (!c.chave) return;
    ordem = ordem?.coluna === c.id ? { coluna: c.id, dir: ordem.dir === 'asc' ? 'desc' : 'asc' } : { coluna: c.id, dir: 'asc' };
  }
  const sentido = (c: Coluna<T>) => (ordem?.coluna === c.id ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none');
</script>

{#if erro}
  <p class="erro" role="alert">{erro}</p>
  {#if aoTentarDeNovo}<button type="button" class="btn" onclick={aoTentarDeNovo}>Tentar de novo</button>{/if}
{:else if carregando}
  <p class="aviso" role="status">Carregando...</p>
{:else if linhas.length === 0}
  <p class="aviso" role="status">{vazio}</p>
{:else}
  <div class="rolagem">
    <table>
      {#if legenda}<caption class="sr">{legenda}</caption>{/if}
      <thead>
        <tr>
          {#each colunas as c (c.id)}
            <th scope="col" class:dir={c.alinhar === 'dir'} aria-sort={c.chave ? sentido(c) : undefined}>
              {#if c.chave}
                <button type="button" class="ord" onclick={() => alternar(c)}>
                  {c.titulo}{ordem?.coluna === c.id ? (ordem.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </button>
              {:else}{c.titulo}{/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each pg.itens as r}
          <tr>
            {#each colunas as c (c.id)}
              <td class:dir={c.alinhar === 'dir'}>
                {#if c.link}<a href={c.link(r)}>{c.texto(r)}</a>{:else}{c.texto(r)}{/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <nav class="paginas" aria-label="Paginação">
    <span>{pg.total} {pg.total === 1 ? 'registro' : 'registros'} · página {pg.pagina} de {pg.paginas}</span>
    <button type="button" class="btn" disabled={pg.pagina <= 1} onclick={() => (pagina = pg.pagina - 1)}>Anterior</button>
    <button type="button" class="btn" disabled={pg.pagina >= pg.paginas} onclick={() => (pagina = pg.pagina + 1)}>Próxima</button>
  </nav>
{/if}

<style>
  .rolagem { overflow-x: auto; border: 1px solid #d9dde4; border-radius: 10px; background: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eceff3; white-space: nowrap; }
  th { background: #f5f7fa; font-weight: 600; }
  .dir { text-align: right; }
  .ord { all: unset; cursor: pointer; font-weight: 600; }
  .ord:focus-visible { outline: 2px solid #1a73e8; }
  a { color: inherit; text-decoration: underline; }
  .paginas { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
  .paginas span { flex: 1; color: #555; font-size: 0.85rem; }
  .btn { min-height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid #c3c9d3; background: #fff; font: inherit; cursor: pointer; }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .erro { color: #b3261e; margin: 8px 0; }
  .aviso { color: #555; margin: 16px 0; }
  .sr { position: absolute; left: -9999px; }
</style>
