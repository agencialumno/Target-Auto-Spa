<script lang="ts">
  import {
    criarCondominio,
    listarCondominios,
    removerCondominio,
    renomearCondominio,
    type Condominio
  } from '$lib/condominios-admin';
  import { idDoCondominio, validarNome } from '$lib/condominio';

  let condominios = $state<Condominio[]>([]);
  let carregando = $state(true);
  let erroLista = $state('');

  // formulário compartilhado entre "novo" e "editar"
  let formAberto = $state(false);
  let editando = $state<Condominio | null>(null);
  let nome = $state('');
  let salvando = $state(false);
  let erroForm = $state('');

  let removendo = $state<Condominio | null>(null);
  let apagando = $state(false);
  let erroRemover = $state('');

  const idPrevisto = $derived(idDoCondominio(nome));
  const podeSalvar = $derived(validarNome(nome) === null && !salvando);

  async function carregar() {
    carregando = true;
    erroLista = '';
    try {
      condominios = await listarCondominios();
    } catch {
      erroLista = 'Não foi possível carregar os condomínios.';
    } finally {
      carregando = false;
    }
  }

  $effect(() => {
    carregar();
  });

  function abrirNovo() {
    editando = null;
    nome = '';
    erroForm = '';
    formAberto = true;
  }

  function abrirEdicao(c: Condominio) {
    editando = c;
    nome = c.nome;
    erroForm = '';
    formAberto = true;
  }

  async function salvar() {
    if (!podeSalvar) return;
    salvando = true;
    erroForm = '';
    try {
      if (editando) await renomearCondominio(editando.id, nome);
      else await criarCondominio(nome);
      formAberto = false;
      await carregar();
    } catch (e: any) {
      erroForm = e?.message || 'Não foi possível salvar.';
    } finally {
      salvando = false;
    }
  }

  async function remover() {
    if (!removendo) return;
    apagando = true;
    erroRemover = '';
    try {
      await removerCondominio(removendo.id);
      removendo = null;
      await carregar();
    } catch (e: any) {
      erroRemover = e?.message || 'Não foi possível remover.';
    } finally {
      apagando = false;
    }
  }
</script>

<div class="topo">
  <h2>Condomínios ({condominios.length})</h2>
  <button class="btn-primario novo" onclick={abrirNovo}>Novo condomínio</button>
</div>

{#if carregando}
  <p class="aviso">Carregando...</p>
{:else if erroLista}
  <p class="erro">{erroLista}</p>
{:else if condominios.length === 0}
  <p class="aviso">Nenhum condomínio cadastrado. Crie o primeiro para os moradores poderem entrar.</p>
{:else}
  <div class="lista">
    {#each condominios as c (c.id)}
      <div class="item card">
        <div class="dados">
          <strong>{c.nome}</strong>
          <small>{c.moradores} {c.moradores === 1 ? 'morador' : 'moradores'} · {c.agendamentos} {c.agendamentos === 1 ? 'agendamento' : 'agendamentos'}</small>
          <small>
            Gerente:
            {#if c.gerentes.length}{c.gerentes.map((g) => g.nome).join(', ')}{:else}nenhum vinculado{/if}
          </small>
        </div>
        <div class="acoes">
          <button class="sec" aria-label={`Editar ${c.nome}`} onclick={() => abrirEdicao(c)}>Editar</button>
          <button class="remover" aria-label={`Remover ${c.nome}`} onclick={() => ((erroRemover = ''), (removendo = c))}>Remover</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

{#if formAberto}
  <div class="camada" role="dialog" aria-modal="true" aria-label={editando ? 'Editar condomínio' : 'Novo condomínio'}>
    <form class="caixa" onsubmit={(e) => (e.preventDefault(), salvar())}>
      <h2>{editando ? 'Editar condomínio' : 'Novo condomínio'}</h2>
      <label class="campo">
        <span>Nome do condomínio</span>
        <input type="text" bind:value={nome} maxlength="100" required />
        {#if editando}
          <small>O identificador ({editando.id}) não muda ao renomear; moradores e agendamentos continuam vinculados.</small>
        {:else if idPrevisto}
          <small>Identificador: {idPrevisto}</small>
        {/if}
      </label>
      {#if erroForm}<p class="erro">{erroForm}</p>{/if}
      <button class="btn-primario" type="submit" disabled={!podeSalvar}>
        {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar condomínio'}
      </button>
      <button class="btn-secundario" type="button" onclick={() => (formAberto = false)}>Cancelar</button>
    </form>
  </div>
{/if}

{#if removendo}
  <div class="camada" role="dialog" aria-modal="true" aria-label="Confirmar remoção">
    <div class="caixa">
      <h2>Remover condomínio?</h2>
      <p>{removendo.nome} será apagado. Só é possível se não houver usuários nem agendamentos vinculados.</p>
      {#if erroRemover}<p class="erro">{erroRemover}</p>{/if}
      <button class="btn-primario perigo" onclick={remover} disabled={apagando}>
        {apagando ? 'Removendo...' : 'Remover'}
      </button>
      <button class="btn-secundario" onclick={() => (removendo = null)} disabled={apagando}>Cancelar</button>
    </div>
  </div>
{/if}

<style>
  .topo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .topo h2 {
    font-size: 1.05rem;
  }

  .novo {
    width: auto;
    padding: 10px 14px;
    font-size: 0.85rem;
  }

  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px;
  }

  .dados {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .dados small {
    color: var(--texto-suave);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }

  .acoes {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sec,
  .remover {
    padding: 8px 12px;
    border-radius: 999px;
    background: transparent;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .sec {
    border: 1px solid var(--card-borda);
    color: var(--texto);
  }

  .remover {
    border: 1px solid var(--erro);
    color: var(--erro);
  }

  .aviso {
    color: var(--texto-suave);
  }

  .erro {
    color: var(--erro);
    font-size: 0.85rem;
  }

  .camada {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--veu);
  }

  .caixa {
    width: 100%;
    max-width: 380px;
    max-height: 90dvh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    background: var(--folha);
    color: var(--texto);
    border-radius: var(--raio-grande);
  }

  .caixa h2 {
    margin: 0;
  }

  .campo {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .campo span {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--texto-suave);
  }

  .campo input {
    padding: 13px 14px;
    border-radius: var(--raio);
    border: 1px solid var(--card-borda);
    background: var(--card);
    color: var(--texto);
    font: inherit;
  }

  .campo small {
    font-size: 0.75rem;
    color: var(--texto-suave);
  }

  .perigo {
    background: var(--erro);
    color: var(--white);
  }
</style>
