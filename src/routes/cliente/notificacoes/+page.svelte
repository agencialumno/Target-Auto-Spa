<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import { app, type Notificacao } from '$lib/app.svelte';
  import { tempoRelativo } from '$lib/formato';

  const icones: Record<Notificacao['tipo'], string> = {
    agendamento: 'calendar',
    status: 'clock',
    foto: 'camera',
    mensagem: 'chat'
  };

  const destino = (n: Notificacao) =>
    n.tipo === 'mensagem'
      ? '/cliente/chat'
      : n.agendamentoId
        ? '/cliente/agendamentos/' + n.agendamentoId
        : '/cliente/agendamentos';

  // O id da notificação vem do atributo data-id da própria linha clicada
  function aoClicar(e: MouseEvent) {
    const id = (e.currentTarget as HTMLElement).dataset.id;
    if (id) app.marcarLida(id);
  }
</script>

<div class="pagina">
  <header class="cab">
    <h1>Suas <em>notificações</em></h1>
  </header>

  <section class="folha com-barra">
    <div class="folha-alca"></div>

    {#if app.notificacoes.length === 0}
      <div class="vazio">
        <span class="sino"><Icone nome="bell" tamanho={28} /></span>
        <p>Nenhuma notificação por enquanto.</p>
        <small>
          Aqui aparecem a confirmação dos agendamentos, o andamento do serviço, as fotos e as
          mensagens do gerente.
        </small>
      </div>
    {:else}
      <div class="secao-topo">
        <h2>
          Recentes
          {#if app.naoLidasNotif > 0}<span class="qtd">{app.naoLidasNotif} nova(s)</span>{/if}
        </h2>
        {#if app.naoLidasNotif > 0}
          <button onclick={() => app.marcarTodasLidas()}>Marcar todas como lidas</button>
        {/if}
      </div>

      <div class="lista">
        {#each app.notificacoes as n (n.id)}
          <a class="item card" class:nova={!n.lida} href={destino(n)} data-id={n.id} onclick={aoClicar}>
            <span class="icone"><Icone nome={icones[n.tipo]} /></span>
            <span class="textos">
              <strong>{n.titulo}</strong>
              <small class="corpo">{n.texto}</small>
              <small class="tempo">{tempoRelativo(n.quando)}</small>
            </span>
            {#if !n.lida}<span class="ponto" aria-label="Não lida"></span>{/if}
          </a>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .qtd {
    margin-left: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    background: #fde8e8;
    color: #b3261e;
    font-size: 0.7rem;
    font-weight: 700;
    vertical-align: middle;
  }

  .item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    color: var(--texto);
  }

  .item.nova {
    border-color: var(--gold-500);
    background: #fffaf0;
  }

  .icone {
    flex: none;
    width: 42px;
    height: 42px;
    border-radius: 13px;
    display: grid;
    place-items: center;
    background: var(--navy-900);
    color: var(--gold-500);
  }

  .textos {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.3;
  }

  .textos strong {
    font-size: 0.95rem;
  }

  .corpo {
    color: var(--texto-suave);
    font-size: 0.82rem;
  }

  .tempo {
    margin-top: 2px;
    color: var(--texto-suave);
    font-size: 0.72rem;
    opacity: 0.8;
  }

  .ponto {
    flex: none;
    width: 10px;
    height: 10px;
    margin-top: 6px;
    border-radius: 50%;
    background: #e5484d;
  }

  .vazio {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    padding: 32px 12px;
    color: var(--texto-suave);
  }

  .vazio p {
    font-weight: 600;
    color: var(--texto);
  }

  .vazio small {
    font-size: 0.8rem;
    max-width: 280px;
  }

  .sino {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--card);
    border: 1px solid var(--card-borda);
    color: var(--teal-700);
  }
</style>