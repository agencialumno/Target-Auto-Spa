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
  <p class="w-erro" role="alert">{erro}</p>
  {#if aoTentarDeNovo}<button type="button" class="w-btn" onclick={aoTentarDeNovo}>Tentar de novo</button>{/if}
{:else if carregando}
  <p class="w-aviso" role="status">Carregando...</p>
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
                {#if c.link}<a href={c.link(r)}>{c.texto(r)}</a>{:else if c.selo}<span class={`w-selo ${c.selo(r)}`}>{c.texto(r)}</span>{:else}{c.texto(r)}{/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <nav class="paginas" aria-label="Paginação">
    <span>{pg.total} {pg.total === 1 ? 'registro' : 'registros'} · página {pg.pagina} de {pg.paginas}</span>
    <button type="button" class="w-btn" disabled={pg.pagina <= 1} onclick={() => (pagina = pg.pagina - 1)}>Anterior</button>
    <button type="button" class="w-btn" disabled={pg.pagina >= pg.paginas} onclick={() => (pagina = pg.pagina + 1)}>Próxima</button>
  </nav>
{/if}

<style>
  .rolagem { overflow-x: auto; border: 1px solid var(--card-borda); border-radius: var(--raio); background: var(--folha); }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--card-borda); white-space: nowrap; }
  th { background: var(--card); color: var(--texto-suave); font-weight: 700; }
  tbody tr:nth-child(even) { background: var(--info-fundo); }
  tbody tr:hover { background: var(--card); }
  .dir { text-align: right; font-variant-numeric: tabular-nums; }
  .ord { all: unset; cursor: pointer; font-weight: 700; }
  .ord:focus-visible { outline: 2px solid var(--teal-700); outline-offset: 2px; }
  a { color: var(--teal-700); font-weight: 600; text-decoration: underline; }
  .paginas { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
  .paginas span { flex: 1; color: var(--texto-suave); font-size: 0.85rem; }
  .sr { position: absolute; left: -9999px; }
</style>
