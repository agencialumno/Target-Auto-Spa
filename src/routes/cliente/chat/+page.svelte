<script lang="ts">
  import { tick, untrack } from 'svelte';
  import Icone from '$lib/components/Icone.svelte';
  import { app, rotuloStatus } from '$lib/app.svelte';
  import { authStore } from '$lib/auth.svelte';
  import { brlCentavos, nomesItens } from '$lib/agendamentos';
  import { dataCurta } from '$lib/formato';
  import { rotuloMensagem, rotuloQuando } from '$lib/chat';

  let texto = $state('');
  let fim = $state<HTMLDivElement>();

  let erro = $state('');

  // Sem condomínio no perfil não há gerente para responder (a conversa nem pode ser criada)
  const semCondominio = $derived(!authStore.perfil?.condominioId);
  // Estado das solicitações do cliente, mais recentes primeiro
  const solicitacoes = $derived(
    app.agendamentos.filter((a) => a.clienteId === authStore.usuario?.uid).slice(0, 3)
  );

  async function enviar() {
    if (semCondominio) {
      erro = 'Seu perfil não está ligado a um condomínio. Entre com o código do condomínio para falar com o gerente.';
      return;
    }
    const t = texto;
    if (!t.trim()) {
      erro = 'Escreva uma mensagem antes de enviar.';
      return;
    }
    texto = '';
    erro = '';
    try {
      await app.enviar(t);
    } catch (e) {
      texto = t;
      erro = `Não foi possível enviar (${(e as { code?: string })?.code ?? 'erro'}).`;
    }
  }

  // Respostas do gerente ainda não lidas ao chegar: ficam destacadas como "Nova" enquanto a tela estiver aberta,
  // mesmo depois de marcadas como lidas no servidor
  let novas = $state<Set<string>>(new Set());
  const novasDoGerente = $derived(app.mensagens.filter((m) => novas.has(m.id)));
  const ultimaNova = $derived(novasDoGerente[novasDoGerente.length - 1]);

  // Marca como lidas ao abrir e sempre que chegar mensagem nova com a conversa aberta
  $effect(() => {
    app.mensagens.length;
    untrack(() => {
      const ids = app.mensagens.filter((m) => m.de === 'gerente' && m.lida === false && !novas.has(m.id)).map((m) => m.id);
      if (ids.length) novas = new Set([...novas, ...ids]);
      app.lerMensagens('cliente');
    });
    tick().then(() => fim?.scrollIntoView({ block: 'end' }));
  });
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <a class="btn-voltar" href="/cliente" aria-label="Voltar">
        <Icone nome="back" />
      </a>
    </div>
    <h1>Gerente do <em>condomínio</em></h1>
  </header>

  <section class="folha conversa">
    <div class="folha-alca"></div>

    {#if solicitacoes.length}
      <div class="solicitacoes" aria-label="Suas solicitações">
        <strong>Suas solicitações</strong>
        {#each solicitacoes as a (a.id)}
          <a href={`/cliente/agendamentos/${a.id}`}>
            <span>{nomesItens(a.itens)} · {dataCurta(a.data)} às {a.hora}</span>
            <small>{rotuloStatus[a.status]} · {brlCentavos(a.total)}</small>
          </a>
        {/each}
      </div>
    {/if}

    {#if ultimaNova}
      <p class="aviso-resposta" role="status">
        O gerente respondeu {rotuloQuando(ultimaNova.criadoEm) ? 'às ' + (ultimaNova.hora || rotuloQuando(ultimaNova.criadoEm)) : ''}
        {novasDoGerente.length > 1 ? `(${novasDoGerente.length} mensagens novas)` : ''}
      </p>
    {/if}

    {#if semCondominio}
      <p class="demo" role="alert">Seu perfil não está ligado a um condomínio, então não há gerente para responder.</p>
    {:else if app.mensagensEstado === 'carregando'}
      <p class="demo" role="status">Carregando mensagens...</p>
    {:else if app.mensagensEstado === 'erro'}
      <p class="demo" role="alert">Não foi possível carregar as mensagens ({app.mensagensErro}).</p>
      <button type="button" class="btn-secundario" onclick={() => app.reabrirConversa()}>Tentar de novo</button>
    {:else if app.mensagens.length === 0}
      <p class="demo">Nenhuma mensagem ainda. Escreva abaixo para falar com o gerente do seu condomínio.</p>
    {/if}

    <div class="mensagens">
      {#each app.mensagens as m (m.id)}
        <div class={`bolha ${m.de}`} class:nova={novas.has(m.id)}>
          <p>{m.texto}</p>
          <small>
            {rotuloMensagem(m.criadoEm, m.hora)}
            {#if novas.has(m.id)}· <b>Nova</b>{/if}
            {#if m.de === 'cliente' && m.lida}· Lida{/if}
          </small>
        </div>
      {/each}
      <div bind:this={fim}></div>
    </div>
    {#if erro}<p class="demo" role="alert">{erro}</p>{/if}
  </section>

  <div class="digitar">
    <input
      placeholder="Escreva uma mensagem"
      bind:value={texto}
      onkeydown={(e) => e.key === 'Enter' && enviar()}
    />
    <button class="enviar" aria-label="Enviar" onclick={enviar}>
      <Icone nome="send" tamanho={20} />
    </button>
  </div>
</div>

<style>
  .aviso-resposta {
    margin: 0 0 10px;
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--gold-500) 16%, var(--card));
    border: 1px solid var(--gold-500);
  }

  .bolha.nova {
    outline: 2px solid var(--gold-500);
  }

  .conversa {
    padding-bottom: calc(96px + var(--safe-bottom));
  }

  .solicitacoes {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
  }

  .solicitacoes a {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--card-borda);
    color: var(--texto);
    font-size: 0.85rem;
  }

  .solicitacoes small {
    color: var(--texto-suave);
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

  .bolha.gerente {
    align-self: flex-start;
    background: var(--card);
    border: 1px solid var(--card-borda);
    border-bottom-left-radius: 6px;
  }

  .bolha.cliente {
    align-self: flex-end;
    background: var(--navy-900);
    color: var(--white);
    border-bottom-right-radius: 6px;
  }

  .demo {
    margin-top: 18px;
    text-align: center;
    font-size: 0.75rem;
    color: var(--texto-suave);
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