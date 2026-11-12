<script lang="ts">
  import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    where,
    type DocumentSnapshot,
    type QueryConstraint
  } from 'firebase/firestore';
  import TelaAdmin from '$lib/components/TelaAdmin.svelte';
  import { db } from '$lib/firebase';
  import {
    POR_PAGINA,
    descreverMudanca,
    lerAtividade,
    normalizarFiltros,
    rotuloAcao,
    type Atividade
  } from '$lib/atividades-consulta';

  let brutos = $state({ atorUid: '', acao: '', alvoId: '', de: '', ate: '' });
  let itens = $state<Atividade[]>([]);
  let cursor: DocumentSnapshot | null = null;
  let temMais = $state(false);
  let carregando = $state(false);
  let erro = $state('');

  // Índices usados (ver docs do lote 3): (atorUid, em desc), (acao, em desc), (alvoId, em desc)
  async function carregar(maisUma = false) {
    if (carregando) return;
    carregando = true;
    erro = '';
    try {
      const f = normalizarFiltros(brutos);
      const r: QueryConstraint[] = [];
      if (f.atorUid) r.push(where('atorUid', '==', f.atorUid));
      if (f.acao) r.push(where('acao', '==', f.acao));
      if (f.alvoId) r.push(where('alvoId', '==', f.alvoId));
      if (f.de) r.push(where('em', '>=', f.de));
      if (f.ate) r.push(where('em', '<=', f.ate));
      r.push(orderBy('em', 'desc'));
      if (maisUma && cursor) r.push(startAfter(cursor));
      r.push(limit(POR_PAGINA));
      const snap = await getDocs(query(collection(db, 'atividades'), ...r));
      const novos = snap.docs.map((d) => lerAtividade(d.id, d.data()));
      itens = maisUma ? [...itens, ...novos] : novos;
      cursor = snap.docs[snap.docs.length - 1] ?? null;
      temMais = snap.docs.length === POR_PAGINA;
    } catch (e) {
      const codigo = (e as { code?: string })?.code;
      erro =
        codigo === 'failed-precondition'
          ? 'Falta um índice do Firestore para esta combinação de filtros. Veja o link no console do navegador.'
          : 'Não foi possível carregar as atividades.';
    } finally {
      carregando = false;
    }
  }

  $effect(() => {
    carregar();
  });

  const quando = (d: Date | null) =>
    d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—';
</script>

<TelaAdmin titulo="Atividades" sub="Histórico imutável de ações">
  <form class="filtros" onsubmit={(e) => (e.preventDefault(), carregar())}>
    <label>
      <span>Usuário (uid do autor)</span>
      <input bind:value={brutos.atorUid} autocapitalize="none" autocomplete="off" />
    </label>
    <label>
      <span>Ação</span>
      <select bind:value={brutos.acao}>
        <option value="">Todas</option>
        {#each Object.entries(rotuloAcao) as [id, nome]}<option value={id}>{nome}</option>{/each}
      </select>
    </label>
    <label>
      <span>Alvo (id)</span>
      <input bind:value={brutos.alvoId} autocapitalize="none" autocomplete="off" />
    </label>
    <label>
      <span>De</span>
      <input type="date" bind:value={brutos.de} />
    </label>
    <label>
      <span>Até</span>
      <input type="date" bind:value={brutos.ate} />
    </label>
    <button class="btn-primario" type="submit" disabled={carregando}>{carregando ? 'Buscando...' : 'Filtrar'}</button>
  </form>

  {#if erro}<p class="erro" role="alert">{erro}</p>{/if}

  {#if !carregando && !erro && itens.length === 0}
    <p class="vazio">Nenhuma atividade encontrada.</p>
  {/if}

  <ul class="lista">
    {#each itens as a (a.id)}
      <li class="card">
        <div class="topo">
          <strong>{rotuloAcao[a.acao] ?? a.acao}</strong>
          <small>{quando(a.em)}</small>
        </div>
        <small>Autor: {a.atorPapel} · {a.atorUid}</small>
        <small>Alvo: {a.alvoTipo} · {a.alvoId}</small>
        {#if a.antes || a.depois}<small class="mudanca">{descreverMudanca(a)}</small>{/if}
        <small class="origem">{a.origem}</small>
      </li>
    {/each}
  </ul>

  {#if temMais}
    <button class="btn-secundario mais" onclick={() => carregar(true)} disabled={carregando}>Carregar mais</button>
  {/if}
</TelaAdmin>

<style>
  .filtros {
    display: grid;
    gap: 10px;
    margin-bottom: 16px;
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

  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
  }

  .topo {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  small {
    color: var(--texto-suave);
    overflow-wrap: anywhere;
  }

  .mudanca {
    color: var(--texto);
  }

  .origem {
    font-size: 0.68rem;
    text-transform: uppercase;
  }

  .erro {
    color: var(--erro);
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
  }

  .mais {
    margin-top: 12px;
    width: 100%;
  }
</style>
