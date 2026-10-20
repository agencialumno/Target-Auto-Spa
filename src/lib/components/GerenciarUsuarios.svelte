<script lang="ts">
  import { collection, getDocs } from 'firebase/firestore';
  import { httpsCallable } from 'firebase/functions';
  import { db, functions } from '$lib/firebase';
  import { authStore, type Papel } from '$lib/auth.svelte';
  import Icone from '$lib/components/Icone.svelte';

  type Usuario = {
    uid: string;
    nome: string;
    email: string;
    role: Papel;
    condominioId: string | null;
  };

  const papeis: { id: Papel; nome: string }[] = [
    { id: 'cliente', nome: 'Cliente' },
    { id: 'gerente', nome: 'Gerente' },
    { id: 'admin', nome: 'Administrador' },
    { id: 'insulfilm', nome: 'Insulfilm' }
  ];
  const nomePapel = (p: string) => papeis.find((x) => x.id === p)?.nome ?? p;

  let usuarios = $state<Usuario[]>([]);
  let carregando = $state(true);
  let erroLista = $state('');

  let formAberto = $state(false);
  let nome = $state('');
  let email = $state('');
  let senha = $state('');
  let role = $state<Papel>('cliente');
  let condominioId = $state('');
  let salvando = $state(false);
  let erroForm = $state('');

  let removendo = $state<Usuario | null>(null);
  let apagando = $state(false);
  let erroRemover = $state('');

  const precisaCondominio = $derived(role === 'cliente' || role === 'gerente');

  const criterios = $derived([
    senha.length >= 8,
    /[A-Z]/.test(senha),
    /[a-z]/.test(senha),
    /[0-9]/.test(senha),
    /[^A-Za-z0-9]/.test(senha)
  ]);
  const senhaForte = $derived(criterios.every(Boolean));
  const podeCriar = $derived(!!nome.trim() && !!email.trim() && senhaForte && !salvando);

  async function carregar() {
    carregando = true;
    erroLista = '';
    try {
      const snap = await getDocs(collection(db, 'users'));
      usuarios = snap.docs
        .map((d) => ({ uid: d.id, ...(d.data() as Omit<Usuario, 'uid'>) }))
        .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''));
    } catch {
      erroLista = 'Não foi possível carregar os usuários.';
    } finally {
      carregando = false;
    }
  }

  $effect(() => {
    carregar();
  });

  function abrirForm() {
    nome = '';
    email = '';
    senha = '';
    role = 'cliente';
    condominioId = '';
    erroForm = '';
    formAberto = true;
  }

  // Mensagem do servidor (HttpsError) quando houver; senão uma genérica
  const mensagem = (e: any, padrao: string) =>
    e?.code === 'functions/not-found' || e?.code === 'functions/unavailable'
      ? 'O serviço de usuários ainda não está disponível. Tente mais tarde.'
      : e?.message && !String(e.message).startsWith('internal')
        ? e.message
        : padrao;

  async function criar() {
    if (!podeCriar) return;
    salvando = true;
    erroForm = '';
    try {
      await httpsCallable(functions, 'criarUsuario')({
        nome,
        email,
        senha,
        role,
        condominioId: precisaCondominio ? condominioId : null
      });
      formAberto = false;
      await carregar();
    } catch (e) {
      erroForm = mensagem(e, 'Não foi possível criar o usuário.');
    } finally {
      salvando = false;
    }
  }

  async function remover() {
    if (!removendo) return;
    apagando = true;
    erroRemover = '';
    try {
      await httpsCallable(functions, 'removerUsuario')({ uid: removendo.uid });
      removendo = null;
      await carregar();
    } catch (e) {
      erroRemover = mensagem(e, 'Não foi possível remover o usuário.');
    } finally {
      apagando = false;
    }
  }
</script>

<div class="topo">
  <h2>Usuários ({usuarios.length})</h2>
  <button class="btn-primario novo" onclick={abrirForm}>Novo usuário</button>
</div>

{#if carregando}
  <p class="aviso">Carregando...</p>
{:else if erroLista}
  <p class="erro">{erroLista}</p>
{:else}
  <div class="lista">
    {#each usuarios as u (u.uid)}
      <div class="linha card">
        <div class="dados">
          <strong>{u.nome || '(sem nome)'}</strong>
          <small>{u.email}</small>
          <small>
            <span class="papel">{nomePapel(u.role)}</span>
            {#if u.condominioId}· {u.condominioId}{/if}
          </small>
        </div>
        {#if u.uid !== authStore.usuario?.uid}
          <button
            class="remover"
            aria-label={`Remover ${u.nome || u.email}`}
            onclick={() => ((erroRemover = ''), (removendo = u))}
          >
            Remover
          </button>
        {:else}
          <span class="voce">Você</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}

{#if formAberto}
  <div class="camada" role="dialog" aria-modal="true" aria-label="Novo usuário">
    <form class="caixa" onsubmit={(e) => (e.preventDefault(), criar())}>
      <h2>Novo usuário</h2>

      <label class="campo">
        <span>Nome</span>
        <input type="text" bind:value={nome} required />
      </label>
      <label class="campo">
        <span>E-mail</span>
        <input type="email" bind:value={email} required />
      </label>
      <label class="campo">
        <span>Senha temporária</span>
        <input type="text" bind:value={senha} required autocomplete="off" />
        <small class:ok={senhaForte}>
          8+ caracteres, maiúscula, minúscula, número e caractere especial
          {#if senhaForte}<Icone nome="check" tamanho={12} />{/if}
        </small>
      </label>
      <label class="campo">
        <span>Papel</span>
        <select bind:value={role}>
          {#each papeis as p}<option value={p.id}>{p.nome}</option>{/each}
        </select>
      </label>
      {#if precisaCondominio}
        <label class="campo">
          <span>Condomínio (id)</span>
          <input type="text" bind:value={condominioId} placeholder="Ex: condominio-teste" />
        </label>
      {/if}

      {#if erroForm}<p class="erro">{erroForm}</p>{/if}

      <button class="btn-primario" type="submit" disabled={!podeCriar}>
        {salvando ? 'Criando...' : 'Criar usuário'}
      </button>
      <button class="btn-secundario" type="button" onclick={() => (formAberto = false)}>
        Cancelar
      </button>
    </form>
  </div>
{/if}

{#if removendo}
  <div class="camada" role="dialog" aria-modal="true" aria-label="Confirmar remoção">
    <div class="caixa">
      <h2>Remover usuário?</h2>
      <p>
        {removendo.nome || removendo.email} ({nomePapel(removendo.role)}) perde o acesso e o perfil é
        apagado. Isso não pode ser desfeito.
      </p>
      {#if erroRemover}<p class="erro">{erroRemover}</p>{/if}
      <button class="btn-primario perigo" onclick={remover} disabled={apagando}>
        {apagando ? 'Removendo...' : 'Remover'}
      </button>
      <button class="btn-secundario" onclick={() => (removendo = null)} disabled={apagando}>
        Cancelar
      </button>
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

  .linha {
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

  .papel {
    font-weight: 700;
    color: var(--teal-700);
  }

  .remover {
    flex: none;
    padding: 8px 12px;
    border-radius: 999px;
    background: transparent;
    border: 1px solid var(--erro);
    color: var(--erro);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .voce {
    font-size: 0.78rem;
    color: var(--texto-suave);
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

  .campo input,
  .campo select {
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

  .campo small.ok {
    color: var(--ok-texto);
  }

  .perigo {
    background: var(--erro);
    color: var(--white);
  }
</style>
