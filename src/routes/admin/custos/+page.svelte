<script lang="ts">
  import { collection, getDocs } from 'firebase/firestore';
  import TelaAdmin from '$lib/components/TelaAdmin.svelte';
  import { db } from '$lib/firebase';
  import { brlCentavos } from '$lib/agendamentos';
  import { CATEGORIAS, nomeCategoria, ocorrenciasNoPeriodo, somarCustos, validarCusto, type Custo, type EntradaCusto } from '$lib/custos';
  import { listarCustos, removerCusto, salvarCusto } from '$lib/custos-admin';

  const mesAtual = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  let custos = $state<Custo[]>([]);
  let condominios = $state<{ id: string; nome: string }[]>([]);
  let carregando = $state(true);
  let erroLista = $state('');

  let de = $state(mesAtual());
  let ate = $state(mesAtual());
  let escopoFiltro = $state('');

  let formAberto = $state(false);
  let editando = $state<Custo | null>(null);
  let form = $state<EntradaCusto>(vazio());
  let salvando = $state(false);
  let erroForm = $state('');
  let removendo = $state<Custo | null>(null);
  let erroRemover = $state('');

  function vazio(): EntradaCusto {
    return { categoria: 'produtos', descricao: '', valor: '', competencia: mesAtual(), tipo: 'avulso', fim: '', escopo: 'geral' };
  }

  const nomeEscopo = (id: string) => (id === 'geral' ? 'Geral' : (condominios.find((c) => c.id === id)?.nome ?? id));

  async function carregar() {
    carregando = true;
    erroLista = '';
    try {
      custos = await listarCustos();
      const snap = await getDocs(collection(db, 'condominios'));
      condominios = snap.docs
        .map((d) => ({ id: d.id, nome: String((d.data() as { nome?: string }).nome ?? d.id) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    } catch {
      erroLista = 'Não foi possível carregar os custos.';
    } finally {
      carregando = false;
    }
  }

  $effect(() => {
    carregar();
  });

  const resumo = $derived(somarCustos(custos, de, ate, escopoFiltro || undefined));
  const doPeriodo = $derived(
    custos.filter(
      (c) => ocorrenciasNoPeriodo(c, de, ate) > 0 && (!escopoFiltro || c.escopo === 'geral' || c.escopo === escopoFiltro)
    )
  );

  function abrir(c?: Custo) {
    editando = c ?? null;
    form = c
      ? { categoria: c.categoria, descricao: c.descricao, valor: (c.valorCentavos / 100).toFixed(2).replace('.', ','), competencia: c.competencia.slice(0, 7), tipo: c.tipo, fim: c.fim?.slice(0, 7) ?? '', escopo: c.escopo }
      : vazio();
    erroForm = '';
    formAberto = true;
  }

  async function salvar() {
    if (salvando) return;
    salvando = true;
    erroForm = '';
    try {
      const problema = validarCusto(form);
      if (problema) {
        erroForm = problema.mensagem;
        return;
      }
      await salvarCusto(form, editando ?? undefined);
      formAberto = false;
      await carregar();
    } catch (e) {
      erroForm = (e as Error)?.message || 'Não foi possível salvar o custo.';
    } finally {
      salvando = false;
    }
  }

  async function remover() {
    if (!removendo) return;
    erroRemover = '';
    try {
      await removerCusto(removendo);
      removendo = null;
      await carregar();
    } catch (e) {
      erroRemover = (e as Error)?.message || 'Não foi possível remover o custo.';
    }
  }
</script>

<TelaAdmin titulo="Custos" sub="Custos operacionais por competência">
  <div class="filtros">
    <label><span>De</span><input type="month" bind:value={de} /></label>
    <label><span>Até</span><input type="month" bind:value={ate} /></label>
    <label>
      <span>Escopo</span>
      <select bind:value={escopoFiltro}>
        <option value="">Todos</option>
        <option value="geral">Só gerais</option>
        {#each condominios as c}<option value={c.id}>{c.nome}</option>{/each}
      </select>
    </label>
  </div>

  <div class="total card">
    <small>Custos no período</small>
    <strong>{brlCentavos(resumo.totalCentavos)}</strong>
    {#each Object.entries(resumo.porCategoria) as [cat, v]}
      <small>{nomeCategoria(cat)}: {brlCentavos(v)}</small>
    {/each}
  </div>

  <button class="btn-primario" onclick={() => abrir()}>Novo custo</button>

  {#if carregando}
    <p class="aviso">Carregando...</p>
  {:else if erroLista}
    <p class="erro" role="alert">{erroLista}</p>
  {:else if doPeriodo.length === 0}
    <p class="aviso">Nenhum custo neste período.</p>
  {:else}
    <ul class="lista">
      {#each doPeriodo as c (c.id)}
        <li class="card">
          <div class="topo">
            <strong>{c.descricao}</strong>
            <b>{brlCentavos(c.valorCentavos)}</b>
          </div>
          <small>
            {nomeCategoria(c.categoria)} · {c.tipo === 'recorrente' ? 'Mensal' : 'Avulso'} · {c.competencia.slice(0, 7)}{#if c.tipo === 'recorrente'} até {c.fim ? c.fim.slice(0, 7) : 'sem fim'}{/if} · {nomeEscopo(c.escopo)}
          </small>
          <div class="acoes">
            <button class="sec" onclick={() => abrir(c)}>Editar</button>
            <button class="sec perigo" onclick={() => ((erroRemover = ''), (removendo = c))}>Remover</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if formAberto}
    <div class="camada" role="dialog" aria-modal="true" aria-label={editando ? 'Editar custo' : 'Novo custo'}>
      <form class="caixa" novalidate onsubmit={(e) => (e.preventDefault(), salvar())}>
        <h2>{editando ? 'Editar custo' : 'Novo custo'}</h2>
        <label><span>Categoria</span>
          <select bind:value={form.categoria}>{#each CATEGORIAS as c}<option value={c.id}>{c.nome}</option>{/each}</select>
        </label>
        <label><span>Descrição</span><input bind:value={form.descricao} maxlength="120" /></label>
        <label><span>Valor (R$)</span><input bind:value={form.valor} inputmode="decimal" placeholder="1.250,00" /></label>
        <label><span>Tipo</span>
          <select bind:value={form.tipo}>
            <option value="avulso">Avulso</option>
            <option value="recorrente">Recorrente (mensal)</option>
          </select>
        </label>
        <label><span>Competência (mês)</span><input type="month" bind:value={form.competencia} /></label>
        {#if form.tipo === 'recorrente'}
          <label><span>Último mês (vazio = sem fim)</span><input type="month" bind:value={form.fim} /></label>
        {/if}
        <label><span>Escopo</span>
          <select bind:value={form.escopo}>
            <option value="geral">Geral</option>
            {#each condominios as c}<option value={c.id}>{c.nome}</option>{/each}
          </select>
        </label>
        {#if erroForm}<p class="erro" role="alert">{erroForm}</p>{/if}
        <button class="btn-primario" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        <button class="btn-secundario" type="button" onclick={() => (formAberto = false)}>Cancelar</button>
      </form>
    </div>
  {/if}

  {#if removendo}
    <div class="camada" role="dialog" aria-modal="true" aria-label="Confirmar remoção">
      <div class="caixa">
        <h2>Remover custo?</h2>
        <p>{removendo.descricao} ({brlCentavos(removendo.valorCentavos)}) deixa de contar em todos os períodos. A remoção fica registrada em Atividades.</p>
        {#if erroRemover}<p class="erro" role="alert">{erroRemover}</p>{/if}
        <button class="btn-primario" onclick={remover}>Remover</button>
        <button class="btn-secundario" onclick={() => (removendo = null)}>Cancelar</button>
      </div>
    </div>
  {/if}
</TelaAdmin>

<style>
  .filtros {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }

  .filtros label:last-child {
    grid-column: 1 / -1;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--texto-suave);
  }

  input,
  select {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--card-borda);
    background: var(--card);
    font: inherit;
    color: var(--texto);
  }

  .total {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px;
    margin-bottom: 12px;
  }

  .total strong {
    font-size: 1.4rem;
  }

  .lista {
    list-style: none;
    padding: 0;
    margin: 14px 0 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
  }

  .topo {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  small {
    color: var(--texto-suave);
  }

  .acoes {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .perigo {
    color: var(--erro);
  }

  .erro {
    color: var(--erro);
  }

  .aviso {
    text-align: center;
    color: var(--texto-suave);
  }

  .camada {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.45);
  }

  .caixa {
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    border-radius: 16px;
    background: var(--white);
  }
</style>
