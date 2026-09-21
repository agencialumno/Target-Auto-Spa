<script lang="ts">
  import { tick, untrack } from 'svelte';
  import Icone from '$lib/components/Icone.svelte';
  import { app } from '$lib/app.svelte';

  let texto = $state('');
  let fim = $state<HTMLDivElement>();

  function enviar() {
    if (!texto.trim()) return;
    app.responder(texto);
    texto = '';
  }

  $effect(() => {
    app.mensagens.length;
    untrack(() => app.lerMensagens('gerente'));
    tick().then(() => fim?.scrollIntoView({ block: 'end' }));
  });
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <a class="btn-voltar" href="/gerente" aria-label="Voltar">
        <Icone nome="back" />
      </a>
    </div>
    <h1>Conversa com o <em>cliente</em></h1>
  </header>

  <section class="folha conversa">
    <div class="folha-alca"></div>

    <div class="mensagens">
      {#each app.mensagens as m}
        <div class={`bolha ${m.de}`}>
          <p>{m.texto}</p>
          <small>{m.hora}</small>
        </div>
      {/each}
      <div bind:this={fim}></div>
    </div>
  </section>

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
</div>

<style>
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