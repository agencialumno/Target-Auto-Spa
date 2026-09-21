<script lang="ts">
  import { goto } from '$app/navigation';
  import Icone from '$lib/components/Icone.svelte';
  import { reserva } from '$lib/reserva.svelte';
  import { app } from '$lib/app.svelte';
  import { dataExtensa } from '$lib/formato';
  import { brl, BUFFER_MIN } from '$lib/mock';
  import {
    proximosDias,
    chaveData,
    horariosLavagem,
    horariosInsulfilm,
    ANTECEDENCIA_INSULFILM_H
  } from '$lib/agenda';

  const agora = new Date();
  const dias = proximosDias(14, agora);

  let dataSel = $state(chaveData(dias[0]));
  let novoId = $state<string | null>(null);

  const diaAtual = $derived(dias.find((d) => chaveData(d) === dataSel) ?? dias[0]);

  const horarios = $derived(
    reserva.avulso
      ? horariosInsulfilm(diaAtual, agora)
      : horariosLavagem(diaAtual, reserva.duracaoTotal, agora)
  );

  const rotuloDia = (d: Date) => ({
    semana: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    numero: d.getDate()
  });

  function escolherDia(d: Date) {
    dataSel = chaveData(d);
    reserva.hora = null;
  }

  function confirmar() {
    if (!reserva.hora || novoId) return;
    reserva.data = dataSel;
    novoId = app.criarAgendamento({
      servicos: reserva.itens.map((s) => s.id),
      data: dataSel,
      hora: reserva.hora,
      total: reserva.total
    });
  }

  async function irPara(caminho: string) {
    await goto(caminho);
    reserva.reiniciar();
  }
</script>

{#snippet resumo()}
  <div class="card resumo">
    {#each reserva.itens as item}
      <div class="linha">
        <span>{item.nome}</span>
        <b>{brl(item.preco)}</b>
      </div>
    {/each}
    {#if reserva.valorDesconto > 0}
      <div class="linha desc">
        <span>Desconto {reserva.descontoPct}% ({app.plano ? `plano ${app.plano.nome}` : `nível ${app.nivel.nome}`})</span>
        <b>− {brl(reserva.valorDesconto)}</b>
      </div>
    {/if}
    <div class="linha total">
      <span>Total</span>
      <b>{brl(reserva.total)}</b>
    </div>
  </div>
{/snippet}

<div class="pagina">
  {#if !reserva.principal}
    <header class="cab">
      <div class="cab-topo">
        <a class="btn-voltar" href="/cliente/servicos" aria-label="Voltar">
          <Icone nome="back" />
        </a>
      </div>
      <h1>Agendar</h1>
    </header>
    <section class="folha">
      <div class="folha-alca"></div>
      <p class="vazio">Escolha primeiro um serviço para ver os horários.</p>
      <a class="btn-primario link" href="/cliente/servicos">Ver serviços</a>
    </section>
  {:else if novoId}
    <header class="cab centro">
      <span class="grande-check"><Icone nome="check" tamanho={40} /></span>
      <h1>Agendamento <em>confirmado!</em></h1>
    </header>
    <section class="folha">
      <div class="folha-alca"></div>
      {@render resumo()}
      <p class="quando">
        <Icone nome="calendar" tamanho={18} />
        {dataExtensa(dataSel)} às {reserva.hora}
      </p>
      <p class="demo">Demonstração: o agendamento fica salvo só neste aparelho.</p>
      <div class="botoes">
        <button class="btn-primario" onclick={() => irPara(`/cliente/agendamentos/${novoId}`)}>
          Ver meu agendamento
        </button>
        <button class="btn-secundario" onclick={() => irPara('/cliente')}>Voltar ao início</button>
      </div>
    </section>
  {:else}
    <header class="cab">
      <div class="cab-topo">
        <a class="btn-voltar" href={`/cliente/servico/${reserva.principalId}`} aria-label="Voltar">
          <Icone nome="back" />
        </a>
      </div>
      <h1>Escolha <em>dia e horário</em></h1>
    </header>

    <section class="folha corpo">
      <div class="folha-alca"></div>

      {@render resumo()}

      <p class="regra">
        <Icone nome="clock" tamanho={16} />
        {#if reserva.avulso}
          Agenda própria do insulfilm (profissional externo). Antecedência mínima de
          {ANTECEDENCIA_INSULFILM_H} horas.
        {:else}
          Cada atendimento reserva {reserva.slotTotal} min ({reserva.duracaoTotal} de serviço + {BUFFER_MIN}
          de preparo).
        {/if}
      </p>

      <h2>Dia</h2>
      <div class="dias">
        {#each dias as d}
          {@const r = rotuloDia(d)}
          <button class="dia" class:on={chaveData(d) === dataSel} onclick={() => escolherDia(d)}>
            <small>{r.semana}</small>
            <strong>{r.numero}</strong>
          </button>
        {/each}
      </div>

      <h2>Horário</h2>
      {#if horarios.length}
        <div class="horas">
          {#each horarios as h}
            <button class="hora" class:on={reserva.hora === h} onclick={() => (reserva.hora = h)}>
              {h}
            </button>
          {/each}
        </div>
      {:else}
        <p class="vazio">
          {reserva.avulso
            ? 'Sem horários neste dia. Tente uma data mais à frente.'
            : 'Sem horários livres neste dia. Escolha outra data.'}
        </p>
      {/if}
    </section>

    <div class="cta">
      <button class="btn-primario" disabled={!reserva.hora} onclick={confirmar}>
        {reserva.hora ? `Confirmar às ${reserva.hora}` : 'Escolha um horário'}
      </button>
    </div>
  {/if}
</div>

<style>
  .centro {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: calc(48px + var(--safe-top));
  }

  .grande-check {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    margin-bottom: 18px;
    background: var(--gold-500);
    color: var(--navy-900);
  }

  .corpo {
    padding-bottom: calc(110px + var(--safe-bottom));
  }

  h2 {
    font-size: 1.05rem;
    margin: 20px 0 10px;
  }

  .resumo {
    padding: 14px 16px;
  }

  .linha {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 0;
    font-size: 0.92rem;
  }

  .linha.desc {
    color: var(--teal-700);
    font-size: 0.85rem;
  }

  .linha.total {
    margin-top: 6px;
    padding-top: 10px;
    border-top: 1px solid var(--card-borda);
    font-size: 1rem;
  }

  .regra {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
    font-size: 0.82rem;
    color: var(--teal-700);
  }

  .quando {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 16px 0 6px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .demo {
    font-size: 0.78rem;
    color: var(--texto-suave);
    margin-bottom: 20px;
  }

  .botoes {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .dias {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    margin: 0 -20px;
    padding: 0 20px 6px;
    scrollbar-width: none;
  }

  .dia {
    flex: none;
    width: 56px;
    padding: 10px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--card);
    border: 1px solid var(--card-borda);
    border-radius: var(--raio);
    color: var(--texto);
    text-transform: capitalize;
  }

  .dia small {
    font-size: 0.72rem;
    color: var(--texto-suave);
  }

  .dia strong {
    font-size: 1.15rem;
  }

  .dia.on {
    background: var(--navy-900);
    border-color: var(--navy-900);
    color: var(--white);
  }

  .dia.on small {
    color: var(--silver);
  }

  .horas {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .hora {
    padding: 12px 0;
    background: var(--card);
    border: 1px solid var(--card-borda);
    border-radius: 12px;
    font-weight: 600;
    color: var(--texto);
  }

  .hora.on {
    background: var(--gold-500);
    border-color: var(--gold-500);
    color: var(--navy-900);
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
    padding: 16px 0;
  }

  .link {
    display: block;
    text-align: center;
  }

  .cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    padding: 12px 20px calc(12px + var(--safe-bottom));
    background: var(--white);
    border-top: 1px solid var(--card-borda);
  }

  .btn-primario:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>