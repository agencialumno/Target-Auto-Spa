<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import { servicos, nomesCategorias, brl, type Categoria } from '$lib/mock';

  type Filtro = 'todos' | Categoria;

  let filtro: Filtro = $state('todos');
  let texto = $state('');

  const filtros: { id: Filtro; nome: string }[] = [
    { id: 'todos', nome: 'Todos' },
    ...(Object.entries(nomesCategorias) as [Categoria, string][]).map(([id, nome]) => ({
      id,
      nome
    }))
  ];

  const lista = $derived(
    servicos.filter((s) => {
      const buscaOk =
        s.nome.toLowerCase().includes(texto.trim().toLowerCase()) ||
        s.codigo.toLowerCase().includes(texto.trim().toLowerCase());
      return !s.oculto && (filtro === 'todos' || s.categoria === filtro) && buscaOk;
    })
  );
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <a class="btn-voltar" href="/cliente" aria-label="Voltar">
        <Icone nome="back" />
      </a>
    </div>
    <h1>Escolha o <em>serviço</em></h1>
  </header>

  <section class="folha com-barra">
    <div class="folha-alca"></div>

    <label class="busca">
      <Icone nome="search" tamanho={20} />
      <input placeholder="Buscar serviço" bind:value={texto} />
    </label>

    <div class="chips">
      {#each filtros as f}
        <button class="chip" class:on={filtro === f.id} onclick={() => (filtro = f.id)}>
          {f.nome}
        </button>
      {/each}
    </div>

    <div class="lista">
      {#each lista as s}
        <a class="item card" href={`/cliente/servico/${s.id}`}>
          <span class="icone"><Icone nome={s.icone} /></span>
          <span class="textos">
            <strong>{s.nome}</strong>
            <small>{s.descricao}</small>
            <span class="meta">
              {#if s.avulso}
                <em>Agenda separada</em>
              {:else}
                {s.duracao} min
              {/if}
              · <b>{brl(s.preco)}</b>
            </span>
          </span>
          <Icone nome="chevron" tamanho={20} />
        </a>
      {:else}
        <p class="vazio">Nenhum serviço encontrado.</p>
      {/each}
    </div>
  </section>
</div>

<style>
  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px;
    color: var(--texto);
  }

  .icone {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 15px;
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
    margin-top: 2px;
  }

  .meta {
    margin-top: 6px;
    font-size: 0.82rem;
    color: var(--texto-suave);
  }

  .meta em {
    font-style: normal;
    color: var(--teal-700);
    font-weight: 600;
  }

  .meta b {
    color: var(--texto);
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
    padding: 24px 0;
  }
</style>
