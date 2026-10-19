<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import { app, rotuloStatus, type Agendamento } from '$lib/app.svelte';
  import { brl } from '$lib/mock';
  import { dataCurta } from '$lib/formato';

  const lista = $derived(
    app.agendamentos
      .filter((a) => a.servicos.includes('insulfilm'))
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
  );

  const rotuloBotao = (a: Agendamento) =>
    a.status === 'agendado' ? 'Iniciar instalação' : 'Concluir instalação';
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <a class="btn-voltar" href="/" aria-label="Sair">
        <Icone nome="back" />
      </a>
    </div>
    <h1>Agenda do <em>insulfilm</em></h1>
    <p>Profissional externo · agenda separada</p>
  </header>

  <section class="folha corpo">
    <div class="folha-alca"></div>

    <p class="regra">
      <Icone nome="clock" tamanho={16} />
      Os pedidos chegam com no mínimo 36 horas de antecedência.
    </p>

    {#if lista.length === 0}
      <p class="vazio">
        Nenhum agendamento de insulfilm ainda. Entre como cliente e agende com pelo menos 36 horas
        de antecedência.
      </p>
    {/if}

    <div class="lista">
      {#each lista as a (a.id)}
        <div class="item card">
          <div class="topo">
            <span class="hora">{a.hora}</span>
            <span class="textos">
              <strong>Insulfilm</strong>
              <small>
                {dataCurta(a.data)} · {a.cliente ?? 'Cliente'} · {a.carro ?? 'Veículo'} ·
                {a.placa ?? '-'}
              </small>
            </span>
            <b>{brl(a.total)}</b>
          </div>
          <div class="rodape">
            <span class={`selo-status ${a.status}`}>{rotuloStatus[a.status]}</span>
            {#if a.status !== 'finalizado'}
              <button class="acao" onclick={() => app.avancar(a.id)}>{rotuloBotao(a)}</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .corpo {
    padding-bottom: calc(32px + var(--safe-bottom));
  }

  .regra {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 12px 14px;
    border-radius: var(--raio);
    background: var(--info-fundo);
    color: var(--teal-700);
    font-size: 0.82rem;
    font-weight: 600;
  }

  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .item {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .topo {
    display: flex;
    align-items: center;
    gap: 12px;
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
    line-height: 1.3;
  }

  .textos small {
    color: var(--texto-suave);
    font-size: 0.78rem;
    text-transform: capitalize;
  }

  .rodape {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
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

  .acao {
    padding: 10px 16px;
    border-radius: 12px;
    background: var(--gold-500);
    color: var(--navy-900);
    font-weight: 700;
    font-size: 0.85rem;
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
    padding: 24px 0;
  }
</style>