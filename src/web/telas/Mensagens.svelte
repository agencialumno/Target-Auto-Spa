<script lang="ts">
  // Supervisão de conversas: SOMENTE LEITURA. Sem campo de envio, sem marcar como lida (nenhuma escrita).
  import { descreverErro, listarConversas, listarMensagens, TETO_MENSAGENS, type ConversaLinha, type MensagemLinha } from '$lib/web/consultas';

  let conversas = $state<ConversaLinha[]>([]);
  let carregando = $state(true);
  let erro = $state('');
  let aberta = $state<ConversaLinha | null>(null);
  let mensagens = $state<MensagemLinha[]>([]);
  let carregandoMsgs = $state(false);
  let erroMsgs = $state('');

  const quando = (d: Date | null) => (d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  async function carregar() {
    carregando = true;
    erro = '';
    try {
      conversas = await listarConversas();
    } catch (e) {
      erro = descreverErro(e, 'as conversas');
    } finally {
      carregando = false;
    }
  }

  async function abrir(c: ConversaLinha) {
    aberta = c;
    mensagens = [];
    erroMsgs = '';
    carregandoMsgs = true;
    try {
      const m = await listarMensagens(c.id);
      if (aberta?.id === c.id) mensagens = m;
    } catch (e) {
      if (aberta?.id === c.id) erroMsgs = descreverErro(e, 'as mensagens');
    } finally {
      if (aberta?.id === c.id) carregandoMsgs = false;
    }
  }

  $effect(() => {
    carregar();
  });
</script>

<h1>Mensagens</h1>
<p class="nota">Modo supervisão: somente leitura. Nada é enviado nem marcado como lido.</p>

{#if erro}
  <p class="erro" role="alert">{erro}</p>
  <button type="button" class="btn" onclick={carregar}>Tentar de novo</button>
{:else if carregando}
  <p class="aviso" role="status">Carregando...</p>
{:else if conversas.length === 0}
  <p class="aviso" role="status">Nenhuma conversa ainda.</p>
{:else}
  <div class="duas">
    <ul class="lista" aria-label="Conversas">
      {#each conversas as c (c.id)}
        <li>
          <button type="button" class:sel={aberta?.id === c.id} onclick={() => abrir(c)}>
            <strong>{c.clienteNome || '(sem nome)'}</strong>
            <small>{quando(c.ultimaHora)} · {c.condominioId}</small>
            <span>{c.ultimaMensagem}</span>
          </button>
        </li>
      {/each}
    </ul>
    <section class="painel" aria-live="polite">
      {#if !aberta}
        <p class="aviso">Escolha uma conversa.</p>
      {:else if erroMsgs}
        <p class="erro" role="alert">{erroMsgs}</p>
        <button type="button" class="btn" onclick={() => aberta && abrir(aberta)}>Tentar de novo</button>
      {:else if carregandoMsgs}
        <p class="aviso" role="status">Carregando...</p>
      {:else if mensagens.length === 0}
        <p class="aviso" role="status">Conversa sem mensagens.</p>
      {:else}
        <h2>{aberta.clienteNome}</h2>
        {#if mensagens.length >= TETO_MENSAGENS}<p class="aviso">Mostrando só as {TETO_MENSAGENS} primeiras mensagens.</p>{/if}
        <ol class="msgs">
          {#each mensagens as m (m.id)}
            <li class={m.de}>
              <small>{m.de === 'gerente' ? 'Gerente' : 'Cliente'} · {quando(m.criadoEm)}</small>
              <p>{m.texto}</p>
            </li>
          {/each}
        </ol>
      {/if}
    </section>
  </div>
{/if}

<style>
  h1 { margin: 0 0 8px; font-size: 1.5rem; }
  h2 { margin: 0 0 12px; font-size: 1.05rem; }
  .nota { color: #556; margin: 0 0 16px; }
  .duas { display: grid; grid-template-columns: 340px 1fr; gap: 16px; align-items: start; }
  .lista { list-style: none; margin: 0; padding: 0; background: #fff; border: 1px solid #d9dde4; border-radius: 10px; max-height: 70vh; overflow-y: auto; }
  .lista button { all: unset; box-sizing: border-box; display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 10px 14px; border-bottom: 1px solid #eceff3; cursor: pointer; }
  .lista button:hover, .lista button.sel { background: #f1f4f9; }
  .lista button:focus-visible { outline: 2px solid #1a73e8; }
  .lista span { color: #556; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .painel { background: #fff; border: 1px solid #d9dde4; border-radius: 10px; padding: 16px; min-height: 200px; }
  .msgs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .msgs li { max-width: 75%; padding: 8px 12px; border-radius: 10px; background: #eef1f5; }
  .msgs li.gerente { align-self: flex-end; background: #e6efe0; }
  .msgs p { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .btn { min-height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #c3c9d3; background: #fff; font: inherit; cursor: pointer; }
  .erro { color: #b3261e; }
  .aviso { color: #556; }
</style>
