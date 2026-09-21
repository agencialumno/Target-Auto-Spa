<script lang="ts">
  import { page } from '$app/state';
  import Icone from '$lib/components/Icone.svelte';
  import BotaoChat from '$lib/components/BotaoChat.svelte';
  import Checklist360 from '$lib/components/Checklist360.svelte';
  import { app, ordemStatus, rotuloStatus } from '$lib/app.svelte';
  import { getServico, brl } from '$lib/mock';
  import { dataExtensa } from '$lib/formato';

  const ag = $derived(app.agendamentos.find((a) => a.id === page.params.id));

  const idx = $derived(ag ? ordemStatus.indexOf(ag.status) : 0);

  const nomes = $derived(
    ag
      ? ag.servicos
          .map((id) => getServico(id)?.nome)
          .filter(Boolean)
          .join(' + ')
      : ''
  );

  const descricaoStatus = $derived({
    agendado: ag ? `Confirmado para ${dataExtensa(ag.data)} às ${ag.hora}` : '',
    'em-atendimento': 'Nossa equipe está cuidando do seu carro',
    finalizado: 'Serviço concluído. Aproveite!'
  });

  let nota = $state(0);
  let nps = $state<number | null>(null);
  let comentario = $state('');

  function enviarAvaliacao() {
    if (!ag || nota === 0 || nps === null) return;
    app.avaliar(ag.id, { nota, nps, comentario: comentario.trim() });
  }
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <a class="btn-voltar" href="/cliente/agendamentos" aria-label="Voltar">
        <Icone nome="back" />
      </a>
      <BotaoChat href="/cliente/chat" contagem={app.msgNaoLidasCliente} />
    </div>
    <h1>{ag ? nomes : 'Agendamento não encontrado'}</h1>
  </header>

  <section class="folha corpo">
    <div class="folha-alca"></div>

    {#if ag}
      <h2>Andamento</h2>
      <ol class="linha-tempo">
        {#each ordemStatus as st, i}
          <li class:feito={i < idx} class:atual={i === idx}>
            <span class="bolinha">
              {#if i < idx || (i === idx && st === 'finalizado')}
                <Icone nome="check" tamanho={14} />
              {/if}
            </span>
            <span class="texto">
              <strong>{rotuloStatus[st]}</strong>
              {#if i === idx}<small>{descricaoStatus[st]}</small>{/if}
            </span>
          </li>
        {/each}
      </ol>

      {#if ag.status !== 'finalizado'}
        <button class="btn-secundario demo-btn" onclick={() => app.avancar(ag.id)}>
          Demo: avançar status
        </button>
        <p class="nota-demo">
          Botão só para testar. Na versão real, o gerente atualiza o status pela tela dele.
        </p>
      {/if}

      <h2>Checklist do veículo (360º)</h2>
      <Checklist360 {ag} />

      <div class="card resumo">
        <div class="linha">
          <span>Total</span>
          <b>{brl(ag.total)}</b>
        </div>
      </div>

      {#if ag.status === 'finalizado'}
        <h2>Como foi o serviço?</h2>
        {#if ag.avaliacao}
          <div class="card obrigado">
            <div class="estrelas fixas">
              {#each [1, 2, 3, 4, 5] as n}
                <span class="estrela" class:on={n <= ag.avaliacao.nota}>
                  <Icone nome="star" tamanho={22} />
                </span>
              {/each}
            </div>
            <p>Obrigado pela avaliação! Indicação: {ag.avaliacao.nps}/10.</p>
            {#if ag.avaliacao.comentario}
              <small>“{ag.avaliacao.comentario}”</small>
            {/if}
          </div>
        {:else}
          <div class="estrelas">
            {#each [1, 2, 3, 4, 5] as n}
              <button
                class="estrela"
                class:on={n <= nota}
                aria-label={`${n} estrelas`}
                onclick={() => (nota = n)}
              >
                <Icone nome="star" tamanho={30} />
              </button>
            {/each}
          </div>

          <p class="pergunta">De 0 a 10, o quanto você indicaria a Target Auto Spa?</p>
          <div class="nps">
            {#each Array.from({ length: 11 }, (_, i) => i) as n}
              <button class="nps-btn" class:on={nps === n} onclick={() => (nps = n)}>{n}</button>
            {/each}
          </div>

          <textarea
            class="comentario"
            rows="3"
            placeholder="Deixe um comentário (opcional)"
            bind:value={comentario}
          ></textarea>

          <button
            class="btn-primario"
            disabled={nota === 0 || nps === null}
            onclick={enviarAvaliacao}
          >
            Enviar avaliação
          </button>
        {/if}
      {/if}
    {:else}
      <p class="vazio">Não encontramos este agendamento.</p>
      <a class="btn-primario link" href="/cliente/agendamentos">Voltar</a>
    {/if}
  </section>
</div>

<style>
  .corpo {
    padding-bottom: calc(32px + var(--safe-bottom));
  }

  h2 {
    font-size: 1.05rem;
    margin: 20px 0 12px;
  }

  h2:first-of-type {
    margin-top: 4px;
  }

  .linha-tempo {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 18px;
    position: relative;
  }

  .linha-tempo li {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    position: relative;
    color: var(--texto-suave);
  }

  .linha-tempo li:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 11px;
    top: 26px;
    width: 2px;
    height: calc(100% - 4px);
    background: var(--card-borda);
  }

  .linha-tempo li.feito:not(:last-child)::after {
    background: var(--gold-500);
  }

  .bolinha {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--white);
    border: 2px solid var(--card-borda);
    color: var(--navy-900);
  }

  li.feito .bolinha,
  li.atual .bolinha {
    background: var(--gold-500);
    border-color: var(--gold-500);
  }

  .texto {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  li.feito,
  li.atual {
    color: var(--texto);
  }

  .texto small {
    color: var(--texto-suave);
    text-transform: capitalize;
  }

  .demo-btn {
    margin-top: 18px;
  }

  .nota-demo {
    margin-top: 8px;
    font-size: 0.75rem;
    color: var(--texto-suave);
  }

  .resumo {
    padding: 14px 16px;
    margin-top: 20px;
  }

  .linha {
    display: flex;
    justify-content: space-between;
    font-size: 1rem;
  }

  .estrelas {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
  }

  .estrela {
    background: none;
    color: var(--card-borda);
  }

  .estrela.on {
    color: var(--gold-500);
  }

  .estrela :global(svg) {
    fill: none;
  }

  .estrela.on :global(svg) {
    fill: var(--gold-500);
  }

  .pergunta {
    font-size: 0.9rem;
    margin-bottom: 10px;
  }

  .nps {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 4px;
    margin-bottom: 16px;
  }

  .nps-btn {
    padding: 10px 0;
    border-radius: 8px;
    background: var(--card);
    border: 1px solid var(--card-borda);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--texto);
  }

  .nps-btn.on {
    background: var(--navy-900);
    border-color: var(--navy-900);
    color: var(--white);
  }

  .comentario {
    width: 100%;
    margin-bottom: 14px;
    padding: 12px 14px;
    border-radius: var(--raio);
    border: 1px solid var(--card-borda);
    background: var(--card);
    font: inherit;
    color: var(--texto);
    resize: none;
    outline: none;
  }

  .obrigado {
    padding: 16px;
    text-align: center;
  }

  .obrigado p {
    margin-top: 6px;
    font-weight: 600;
  }

  .obrigado small {
    color: var(--texto-suave);
  }

  .fixas {
    justify-content: center;
    margin-bottom: 4px;
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

  .btn-primario:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>