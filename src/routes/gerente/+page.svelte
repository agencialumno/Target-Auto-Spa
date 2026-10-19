<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import BotaoChat from '$lib/components/BotaoChat.svelte';
  import { app, rotuloStatus, type Agendamento } from '$lib/app.svelte';
  import { getServico, brl, angulos360 } from '$lib/mock';
  import { chaveData } from '$lib/agenda';
  import { dataCurta } from '$lib/formato';

  const hoje = chaveData(new Date());

  // O insulfilm é feito pelo profissional externo, então não entra na agenda do gerente
  const doGerente = $derived(app.agendamentos.filter((a) => !a.servicos.includes('insulfilm')));

  const ordenar = (lista: Agendamento[]) =>
    [...lista].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

  const abertos = $derived(ordenar(doGerente.filter((a) => a.status !== 'finalizado')));
  const concluidos = $derived(ordenar(doGerente.filter((a) => a.status === 'finalizado')));
  const qtdInsulfilm = $derived(
    app.agendamentos.filter((a) => a.servicos.includes('insulfilm')).length
  );

  const nomes = (a: Agendamento) =>
    a.servicos
      .map((id) => getServico(id)?.nome)
      .filter(Boolean)
      .join(' + ');
</script>

{#snippet cartao(a: Agendamento)}
  <a class="item card" href={`/gerente/${a.id}`}>
    <span class="hora">{a.hora}</span>
    <span class="textos">
      <strong>{nomes(a)}</strong>
      <small>
        {a.data === hoje ? 'Hoje' : dataCurta(a.data)} · {a.placa ?? '-'} · {brl(a.total)}
      </small>
      <span class="rodape">
        <span class={`selo-status ${a.status}`}>{rotuloStatus[a.status]}</span>
        <small>
          Fotos: {app.fotosFeitas(a, 'antes')}/{angulos360.length} antes ·
          {app.fotosFeitas(a, 'depois')}/{angulos360.length} depois
        </small>
      </span>
    </span>
    <Icone nome="chevron" tamanho={20} />
  </a>
{/snippet}

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <a class="btn-voltar" href="/" aria-label="Sair">
        <Icone nome="back" />
      </a>
      <BotaoChat
        href="/gerente/chat"
        contagem={app.msgNaoLidasGerente}
        rotulo="Chat com clientes"
      />
    </div>
    <h1>Agenda do <em>dia</em></h1>
    <p>Residencial Exemplo</p>
  </header>

  <section class="folha corpo">
    <div class="folha-alca"></div>

    {#if doGerente.length === 0}
      <p class="vazio">
        Nenhum agendamento ainda. Entre como cliente, agende um serviço e volte aqui.
      </p>
    {/if}

    {#if abertos.length}
      <div class="secao-topo"><h2>Para atender</h2></div>
      <div class="lista">
        {#each abertos as a (a.id)}
          {@render cartao(a)}
        {/each}
      </div>
    {/if}

    {#if concluidos.length}
      <div class="secao-topo espaco"><h2>Concluídos</h2></div>
      <div class="lista">
        {#each concluidos as a (a.id)}
          {@render cartao(a)}
        {/each}
      </div>
    {/if}

    {#if qtdInsulfilm > 0}
      <p class="aviso-insulfilm">
        <Icone nome="layers" tamanho={16} />
        {qtdInsulfilm} agendamento(s) de insulfilm estão na agenda do profissional externo.
      </p>
    {/if}
  </section>
</div>

<style>
  .corpo {
    padding-bottom: calc(32px + var(--safe-bottom));
  }

  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .espaco {
    margin-top: 22px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    color: var(--texto);
  }

  .hora {
    flex: none;
    width: 54px;
    padding: 8px 0;
    text-align: center;
    border-radius: 12px;
    background: var(--navy-900);
    color: var(--gold-500);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .textos {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.3;
  }

  .textos > small {
    color: var(--texto-suave);
    font-size: 0.8rem;
    text-transform: capitalize;
  }

  .rodape {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    margin-top: 6px;
  }

  .rodape small {
    color: var(--texto-suave);
    font-size: 0.72rem;
  }

  .selo-status {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--info-fundo);
    color: var(--teal-700);
  }

  .selo-status.em-atendimento {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
  }

  .selo-status.finalizado {
    background: var(--ok-fundo);
    color: var(--ok-texto);
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
    padding: 24px 0;
  }

  .aviso-insulfilm {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 22px;
    padding: 12px 14px;
    border-radius: var(--raio);
    background: var(--info-fundo);
    color: var(--teal-700);
    font-size: 0.82rem;
    font-weight: 600;
  }
</style>