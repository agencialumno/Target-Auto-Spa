<script lang="ts">
  import {
    CAPACIDADE_MAX,
    capacidadeValida,
    criarCondominio,
    definirCapacidade,
    lerCapacidadeInsulfilm,
    listarCondominios,
    salvarCapacidadeInsulfilm,
    removerCondominio,
    renomearCondominio,
    type Condominio
  } from '$lib/condominios-admin';
  import { idDoCondominio, validarNome } from '$lib/condominio';
  import { rolarAte } from '$lib/validacao';

  let condominios = $state<Condominio[]>([]);
  let carregando = $state(true);
  let erroLista = $state('');

  // formulário compartilhado entre "novo" e "editar"
  let formAberto = $state(false);
  let editando = $state<Condominio | null>(null);
  let nome = $state('');
  let capacidade = $state(1);
  let salvando = $state(false);

  // Insulfilm: agenda externa única, com capacidade própria (config/insulfilm)
  let capIns = $state(1);
  let capInsSalvando = $state(false);
  let capInsMsg = $state('');
  let capInsErro = $state(false);
  let erroForm = $state('');

  let removendo = $state<Condominio | null>(null);
  let apagando = $state(false);
  let erroRemover = $state('');

  const limpoNome = (n: string) => n.trim().replace(/\s+/g, ' ');
  const idPrevisto = $derived(idDoCondominio(nome));
  type Campo = 'nome' | 'capacidade';
  let campoInvalido = $state<Campo | ''>('');
  const refs: Partial<Record<Campo, HTMLElement>> = {};
  const MENSAGENS_NOME = {
    vazio: 'Informe o nome do condomínio.',
    longo: 'O nome pode ter no máximo 100 caracteres.',
    invalido: 'O nome precisa ter letras ou números.'
  } as const;

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
    lerCapacidadeInsulfilm().then((n) => (capIns = n)).catch(() => {});
  });

  async function salvarCapIns() {
    capInsSalvando = true;
    capInsMsg = '';
    capInsErro = false;
    try {
      if (!capacidadeValida(Number(capIns))) {
        capInsMsg = `A capacidade deve ser um número inteiro de 1 a ${CAPACIDADE_MAX}.`;
        capInsErro = true;
        return;
      }
      await salvarCapacidadeInsulfilm(Number(capIns));
      capInsMsg = 'Capacidade do insulfilm salva.';
    } catch (e: any) {
      capInsMsg = e?.message || 'Não foi possível salvar.';
      capInsErro = true;
    } finally {
      capInsSalvando = false;
    }
  }

  function abrirNovo() {
    editando = null;
    nome = '';
    erroForm = '';
    campoInvalido = '';
    formAberto = true;
  }

  function abrirEdicao(c: Condominio) {
    editando = c;
    nome = c.nome;
    capacidade = c.capacidade;
    erroForm = '';
    campoInvalido = '';
    formAberto = true;
  }

  async function salvar() {
    if (salvando) return;
    // O estado de carregando vem ANTES de qualquer outro passo
    salvando = true;
    erroForm = '';
    campoInvalido = '';
    try {
      const erroNome = validarNome(nome);
      if (erroNome) {
        erroForm = MENSAGENS_NOME[erroNome];
        campoInvalido = 'nome';
        rolarAte(refs.nome);
        return;
      }
      if (editando && !capacidadeValida(Number(capacidade))) {
        erroForm = `A capacidade deve ser um número inteiro de 1 a ${CAPACIDADE_MAX}.`;
        campoInvalido = 'capacidade';
        rolarAte(refs.capacidade);
        return;
      }
      if (editando) {
        if (limpoNome(nome) !== editando.nome) await renomearCondominio(editando.id, nome);
        if (Number(capacidade) !== editando.capacidade) await definirCapacidade(editando.id, Number(capacidade));
      }
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

<section class="card cartao-ins" aria-label="Insulfilm">
  <h3>Insulfilm</h3>
  <p>Quantos atendimentos de insulfilm cabem no mesmo horário, valendo para todos os condomínios.</p>
  <label class="campo" for="cap-insulfilm">
    <span>Vagas por horário</span>
  </label>
  <div class="linha-ins">
    <input id="cap-insulfilm" aria-invalid={capInsErro} type="number" min="1" max={CAPACIDADE_MAX} step="1" inputmode="numeric" bind:value={capIns} aria-label="Capacidade do insulfilm" />
    <button class="btn-primario" onclick={salvarCapIns} disabled={capInsSalvando}>
      {capInsSalvando ? 'Salvando...' : 'Salvar'}
    </button>
  </div>
  {#if capInsMsg}<p class={capInsErro ? 'erro-form' : 'ok-form'} role={capInsErro ? 'alert' : 'status'}>{capInsMsg}</p>{/if}
</section>

<div class="topo">
  <h2>Lista ({condominios.length})</h2>
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
    <!-- novalidate: a validação nativa não mostra nada no WKWebView -->
    <form class="caixa" novalidate onsubmit={(e) => (e.preventDefault(), salvar())}>
      <h2>{editando ? 'Editar condomínio' : 'Novo condomínio'}</h2>
      <label class="campo">
        <span>Nome do condomínio</span>
        <input type="text" bind:value={nome} bind:this={refs.nome} aria-invalid={campoInvalido === 'nome'} maxlength="100" />
        {#if editando}
          <small>O identificador ({editando.id}) não muda ao renomear; moradores e agendamentos continuam vinculados.</small>
        {:else if idPrevisto}
          <small>Identificador: {idPrevisto}</small>
        {/if}
      </label>
      {#if editando}
        <label class="campo">
          <span>Vagas por horário (capacidade)</span>
          <input type="number" min="1" max={CAPACIDADE_MAX} step="1" inputmode="numeric" bind:value={capacidade} bind:this={refs.capacidade} aria-invalid={campoInvalido === 'capacidade'} />
          <small>Quantos agendamentos cabem no mesmo horário neste condomínio (1 a {CAPACIDADE_MAX}).</small>
        </label>
      {/if}
      {#if erroForm}<p class="erro-form" role="alert">{erroForm}</p>{/if}
      <button class="btn-primario" type="submit" disabled={salvando} aria-busy={salvando}>
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
  .cartao-ins {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    margin-bottom: 22px;
  }

  .cartao-ins h3 {
    font-size: 1.05rem;
  }

  .cartao-ins p {
    font-size: 0.85rem;
    color: var(--texto-suave);
    line-height: 1.35;
  }

  .cartao-ins small {
    color: var(--texto-suave);
  }

  .linha-ins {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }

  .linha-ins input {
    flex: 1;
    min-width: 0;
    min-height: 48px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--card-borda);
    font: inherit;
    font-size: 16px; /* evita o zoom automático do iOS ao focar */
  }

  .linha-ins button {
    width: auto;
    min-height: 48px;
    padding: 0 22px;
  }

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
