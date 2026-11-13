<script lang="ts">
  import { tick, untrack } from 'svelte';
  import Icone from '$lib/components/Icone.svelte';
  import { app } from '$lib/app.svelte';
  import { contadorNovas, ordenarConversas, resumir, rotuloMensagem, rotuloQuando, textoNovas } from '$lib/chat';

  let texto = $state('');
  let fim = $state<HTMLDivElement>();

  let erro = $state('');

  async function enviar() {
    const t = texto;
    if (!t.trim()) {
      erro = 'Escreva uma mensagem antes de enviar.';
      return;
    }
    texto = '';
    erro = '';
    try {
      await app.responder(t);
    } catch (e) {
      texto = t;
      erro = `Não foi possível enviar (${(e as { code?: string })?.code ?? 'erro'}).`;
    }
  }

  const ordenadas = $derived(ordenarConversas(app.conversas));
  const conversa = $derived(app.conversas.find((c) => c.id === app.conversaAtiva));

  // Sai da conversa ao deixar a tela (para não ficar ouvindo mensagens em segundo plano)
  $effect(() => () => app.fecharConversa());

  $effect(() => {
    app.mensagens.length;
    if (app.conversaAtiva) untrack(() => app.lerMensagens('gerente'));
    tick().then(() => fim?.scrollIntoView({ block: 'end' }));
  });
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      {#if app.conversaAtiva}
        <button type="button" class="btn-voltar" aria-label="Voltar às conversas" onclick={() => app.fecharConversa()}>
          <Icone nome="back" />
        </button>
      {:else}
        <a class="btn-voltar" href="/gerente" aria-label="Voltar">
          <Icone nome="back" />
        </a>
      {/if}
    </div>
    <h1>
      {#if app.conversaAtiva}Conversa com <em>{conversa?.clienteNome || 'o cliente'}</em>{:else}Conversas dos <em>clientes</em>{/if}
    </h1>
  </header>

  <section class="folha conversa">
    <div class="folha-alca"></div>

    {#if !app.conversaAtiva}
      {#if app.conversasEstado === 'carregando'}
        <p class="demo" role="status">Carregando conversas...</p>
      {:else if app.conversasEstado === 'erro'}
        <p class="demo" role="alert">Não foi possível carregar as conversas ({app.conversasErro}).</p>
        <button type="button" class="btn-secundario" onclick={() => app.ouvirConversas()}>Tentar de novo</button>
      {:else if ordenadas.length === 0}
        <p class="demo">Nenhum cliente enviou mensagem ainda.</p>
      {:else}
        {#if app.msgNaoLidasGerente > 0}
          <p class="aviso-novas" role="status">{textoNovas(app.msgNaoLidasGerente)}</p>
        {/if}
        <div class="lista-conversas">
          {#each ordenadas as c (c.id)}
            <button
              type="button"
              class="conversa-item"
              class:nao-lida={c.naoLidasGerente > 0}
              aria-label={`${c.clienteNome || 'Cliente'}${c.naoLidasGerente > 0 ? ', ' + textoNovas(c.naoLidasGerente) : ''}`}
              onclick={() => app.abrirConversa(c.id)}
            >
              <span class="linha">
                <strong>{c.clienteNome || 'Cliente'}</strong>
                <time>{rotuloQuando(c.ultimaHora)}</time>
              </span>
              <small class="condo">{app.condominioNome || 'Condomínio'}</small>
              <small class="previa">{resumir(c.ultimaMensagem) || 'Sem mensagens'}</small>
              {#if c.naoLidasGerente > 0}<b class="novas">{contadorNovas(c.naoLidasGerente)}</b>{/if}
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      {#if app.mensagensEstado === 'carregando'}
        <p class="demo" role="status">Carregando mensagens...</p>
      {:else if app.mensagensEstado === 'erro'}
        <p class="demo" role="alert">Não foi possível carregar as mensagens ({app.mensagensErro}).</p>
        <button type="button" class="btn-secundario" onclick={() => app.reabrirConversa()}>Tentar de novo</button>
      {:else if app.mensagens.length === 0}
        <p class="demo">Nenhuma mensagem nesta conversa.</p>
      {/if}
      <div class="mensagens">
        {#each app.mensagens as m (m.id)}
          <div class={`bolha ${m.de}`}>
            <p>{m.texto}</p>
            <small>{rotuloMensagem(m.criadoEm, m.hora)}</small>
          </div>
        {/each}
        <div bind:this={fim}></div>
      </div>
      {#if erro}<p class="demo" role="alert">{erro}</p>{/if}
    {/if}
  </section>

  {#if app.conversaAtiva}
    <div class="digitar">
      <input
        placeholder="Responder ao cliente"
        bind:value={texto}
        onkeydown={(e) => e.key === 'Enter' && enviar()}
      />
      <button class="enviar" aria-label="Enviar" onclick={enviar}>
        <Icone nome="send" tamanho={20} />
      </button>
    </div>
  {/if}
</div>

<style>
  .lista-conversas {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .conversa-item {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    padding: 12px 44px 12px 14px;
    border-radius: 14px;
    background: var(--card);
    border: 1px solid var(--card-borda);
  }

  .linha {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .linha time {
    font-size: 0.75rem;
    opacity: 0.7;
    flex: none;
  }

  .conversa-item.nao-lida {
    border-color: var(--gold-500);
    background: color-mix(in srgb, var(--gold-500) 12%, var(--card));
  }

  .conversa-item.nao-lida strong,
  .conversa-item.nao-lida .previa {
    font-weight: 700;
    opacity: 1;
  }

  .aviso-novas {
    margin: 0 0 8px;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .conversa-item small {
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .novas {
    position: absolute;
    right: 12px;
    bottom: 12px;
    min-width: 22px;
    padding: 2px 6px;
    border-radius: 11px;
    text-align: center;
    font-size: 0.75rem;
    background: var(--gold-500);
    color: var(--navy-900);
  }

  .conversa {
    padding-bottom: calc(96px + var(--safe-bottom));
  }

  .mensagens {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bolha {
    max-width: 82%;
    padding: 10px 14px;
    border-radius: 18px;
    line-height: 1.35;
  }

  .bolha small {
    display: block;
    margin-top: 2px;
    font-size: 0.68rem;
    opacity: 0.6;
  }

  /* Do ponto de vista do gerente: as mensagens dele ficam à direita */
  .bolha.cliente {
    align-self: flex-start;
    background: var(--card);
    border: 1px solid var(--card-borda);
    border-bottom-left-radius: 6px;
  }

  .bolha.gerente {
    align-self: flex-end;
    background: var(--navy-900);
    color: var(--white);
    border-bottom-right-radius: 6px;
  }

  .digitar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    display: flex;
    gap: 10px;
    padding: 12px 16px calc(12px + var(--safe-bottom));
    background: var(--white);
    border-top: 1px solid var(--card-borda);
  }

  .digitar input {
    flex: 1;
    min-width: 0;
    padding: 13px 16px;
    border-radius: 999px;
    border: 1px solid var(--card-borda);
    background: var(--card);
    font: inherit;
    color: var(--texto);
    outline: none;
  }

  .enviar {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--gold-500);
    color: var(--navy-900);
  }
</style>