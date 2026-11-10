<script lang="ts">
  import TelaAdmin from '$lib/components/TelaAdmin.svelte';
  import { brl } from '$lib/mock';
  import {
    servicos,
    alternarServico,
    publicarCatalogoInicial,
    salvarPrecoServico
  } from '$lib/catalogo.svelte';

  let msgPrecos = $state('');
  let editando = $state<string | null>(null);
  let valorEdicao = $state('');
  let ocupado = $state(false);
  const naoPublicados = $derived(servicos.filter((s) => !s.publicado).length);

  async function tentar(fn: () => Promise<unknown>, ok: string) {
    ocupado = true;
    msgPrecos = '';
    try {
      await fn();
      msgPrecos = ok;
    } catch (e) {
      msgPrecos = `Não foi possível salvar (${(e as { code?: string })?.code ?? (e as Error)?.message ?? 'erro'}).`;
    } finally {
      ocupado = false;
    }
  }

  const publicar = () =>
    tentar(async () => {
      const n = await publicarCatalogoInicial();
      msgPrecos = `${n} serviço(s) publicado(s).`;
    }, '');

  function editar(id: string, precoCentavos: number) {
    editando = id;
    valorEdicao = (precoCentavos / 100).toFixed(2).replace('.', ',');
  }

  async function salvarPreco(id: string) {
    const centavos = Math.round(Number(valorEdicao.replace(/\./g, '').replace(',', '.')) * 100);
    await tentar(() => salvarPrecoServico(id, centavos), 'Preço salvo.');
    if (!msgPrecos.startsWith('Não')) editando = null;
  }
</script>

<TelaAdmin titulo="Preços" sub="Catálogo de serviços">
  {#if naoPublicados > 0}
    <div class="card aviso-pub">
      <p>{naoPublicados} serviço(s) ainda não estão no Firestore e não podem ser contratados.</p>
      <button class="btn-primario" onclick={publicar} disabled={ocupado}>Publicar catálogo inicial</button>
    </div>
  {/if}
  {#if msgPrecos}<p class="nota" role="status">{msgPrecos}</p>{/if}
  <div class="tabela card">
    {#each servicos as s (s.id)}
      <div class="linha-preco">
        <span class="nome">
          <strong>{s.nome}</strong>
          <small>
            {s.duracao} min{s.avulso ? ' · agenda separada' : ''}{s.publicado
              ? s.ativo === false ? ' · desativado' : ''
              : ' · não publicado'}
          </small>
        </span>
        {#if editando === s.id}
          <span class="edicao">
            <input inputmode="decimal" bind:value={valorEdicao} aria-label={`Novo preço de ${s.nome}`} />
            <button class="mini" onclick={() => salvarPreco(s.id)} disabled={ocupado}>Salvar</button>
            <button class="mini" onclick={() => (editando = null)}>Cancelar</button>
          </span>
        {:else}
          <b>{brl(s.preco)}</b>
          {#if s.publicado}
            <span class="acoes">
              <button class="mini" onclick={() => editar(s.id, s.precoCentavos)}>Editar</button>
              <button class="mini" onclick={() => tentar(() => alternarServico(s.id, s.ativo === false), 'Salvo.')} disabled={ocupado}>
                {s.ativo === false ? 'Ativar' : 'Desativar'}
              </button>
            </span>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
  <p class="nota">
    O preço do Firestore é o que vale: os agendamentos gravam o preço do serviço no momento da
    contratação.
  </p>
</TelaAdmin>

<style>
  .aviso-pub {
    padding: 14px 16px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 0.9rem;
  }

  .tabela {
    padding: 4px 16px;
  }

  .linha-preco {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--card-borda);
  }

  .linha-preco:last-child {
    border-bottom: none;
  }

  .nome {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
    min-width: 0;
    flex: 1 1 200px;
  }

  .nome small {
    color: var(--texto-suave);
    font-size: 0.76rem;
  }

  .linha-preco b {
    flex: none;
  }

  .acoes,
  .edicao {
    display: flex;
    gap: 6px;
    align-items: center;
    flex: none;
  }

  .edicao input {
    width: 90px;
    min-height: 40px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid var(--card-borda);
    font: inherit;
    font-size: 16px; /* evita o zoom automático do iOS ao focar */
  }

  .mini {
    min-height: 40px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--card-borda);
    background: var(--white);
    font-size: 0.78rem;
  }

  .nota {
    margin-top: 12px;
    font-size: 0.75rem;
    color: var(--texto-suave);
  }
</style>
