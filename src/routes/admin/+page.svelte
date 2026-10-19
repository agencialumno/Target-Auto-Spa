<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import { app, rotuloStatus, ordemStatus } from '$lib/app.svelte';
  import { servicos, planos, getServico, brl } from '$lib/mock';
  import { niveis } from '$lib/niveis';
  import { dataCurta } from '$lib/formato';

  type Aba = 'resumo' | 'agendamentos' | 'precos' | 'avaliacoes';

  const abas: { id: Aba; nome: string }[] = [
    { id: 'resumo', nome: 'Resumo' },
    { id: 'agendamentos', nome: 'Agendamentos' },
    { id: 'precos', nome: 'Preços' },
    { id: 'avaliacoes', nome: 'Avaliações' }
  ];

  let aba = $state<Aba>('resumo');

  const total = $derived(app.agendamentos.length);
  const ticket = $derived(total ? app.receita / total : 0);
  const porStatus = (st: string) => app.agendamentos.filter((a) => a.status === st).length;

  const nomes = (ids: string[]) =>
    ids
      .map((id) => getServico(id)?.nome)
      .filter(Boolean)
      .join(' + ');
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <a class="btn-voltar" href="/" aria-label="Sair">
        <Icone nome="back" />
      </a>
      <a class="btn-voltar" href="/gerente/chat" aria-label="Ver conversas">
        <Icone nome="chat" />
      </a>
    </div>
    <h1>Painel do <em>administrador</em></h1>
    <p>Visão geral de todos os condomínios</p>
  </header>

  <section class="folha corpo">
    <div class="folha-alca"></div>

    <div class="chips">
      {#each abas as a}
        <button class="chip" class:on={aba === a.id} onclick={() => (aba = a.id)}>{a.nome}</button>
      {/each}
    </div>

    {#if aba === 'resumo'}
      <div class="kpis">
        <div class="kpi card">
          <small>Receita</small>
          <strong>{brl(app.receita)}</strong>
        </div>
        <div class="kpi card">
          <small>Agendamentos</small>
          <strong>{total}</strong>
        </div>
        <div class="kpi card">
          <small>Ticket médio</small>
          <strong>{brl(ticket)}</strong>
        </div>
        <div class="kpi card">
          <small>Nota média</small>
          <strong>{app.notaMedia === null ? '-' : app.notaMedia.toFixed(1).replace('.', ',')}</strong>
        </div>
        <div class="kpi card">
          <small>NPS</small>
          <strong>{app.nps === null ? '-' : app.nps}</strong>
        </div>
        <div class="kpi card">
          <small>Nível do cliente</small>
          <strong>{app.nivel.nome}</strong>
        </div>
      </div>

      <h2>Por status</h2>
      <div class="status-linha">
        {#each ordemStatus as st}
          <div class="card status">
            <strong>{porStatus(st)}</strong>
            <small>{rotuloStatus[st]}</small>
          </div>
        {/each}
      </div>
      <p class="nota">
        Dados da demonstração, salvos neste aparelho. Com o backend, o painel soma todos os
        condomínios e clientes.
      </p>
    {:else if aba === 'agendamentos'}
      {#if app.agendamentos.length === 0}
        <p class="vazio">Nenhum agendamento ainda.</p>
      {/if}
      <div class="lista">
        {#each app.agendamentos as a (a.id)}
          <a class="item card" href={`/admin/agendamentos/${a.id}`}>
            <span class="textos">
              <strong>{nomes(a.servicos)}</strong>
              <small>
                {dataCurta(a.data)} às {a.hora} · {a.placa ?? '-'} · {brl(a.total)}
              </small>
              <span class="tags">
                <span class={`selo-status ${a.status}`}>{rotuloStatus[a.status]}</span>
                {#if a.servicos.includes('insulfilm')}
                  <span class="selo-status ext">Profissional externo</span>
                {/if}
              </span>
            </span>
            <Icone nome="chevron" tamanho={20} />
          </a>
        {/each}
      </div>
    {:else if aba === 'precos'}
      <h2>Serviços</h2>
      <div class="tabela card">
        {#each servicos as s}
          <div class="linha-preco">
            <span>
              <strong>{s.nome}</strong>
              <small>
                {s.duracao} min{s.avulso ? ' · agenda separada' : ''}{s.garantia
                  ? ` · garantia ${s.garantia.split(',')[0]}`
                  : ''}
              </small>
            </span>
            <b>{brl(s.preco)}</b>
          </div>
        {/each}
      </div>

      <h2>Assinatura</h2>
      <div class="tabela card">
        {#each planos as p}
          <div class="linha-preco">
            <span>
              <strong>{p.nome}</strong>
              <small>{p.desconto}% de desconto nos demais serviços</small>
            </span>
            <b>{brl(p.preco)}/mês</b>
          </div>
        {/each}
      </div>

      <h2>Níveis de cliente</h2>
      <div class="tabela card">
        {#each niveis as n}
          <div class="linha-preco">
            <span>
              <strong>{n.nome}</strong>
              <small>{n.min === 0 ? 'Início' : `a partir de ${brl(n.min)} em 90 dias`}</small>
            </span>
            <b>{n.desconto}%</b>
          </div>
        {/each}
      </div>
      <p class="nota">
        Tabela de venda (valores de exemplo). Os preços ficam em <code>src/lib/mock.ts</code>. A
        edição pelo painel entra junto com o backend.
      </p>
    {:else}
      {#if app.avaliados.length === 0}
        <p class="vazio">Nenhuma avaliação ainda. Finalize um serviço como cliente e avalie.</p>
      {/if}
      <div class="lista">
        {#each app.avaliados as a (a.id)}
          <div class="card aval">
            <strong>{nomes(a.servicos)}</strong>
            <small>Nota {a.avaliacao?.nota}/5 · Indicação {a.avaliacao?.nps}/10</small>
            {#if a.avaliacao?.comentario}
              <p>“{a.avaliacao.comentario}”</p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .corpo {
    padding-bottom: calc(32px + var(--safe-bottom));
  }

  h2 {
    font-size: 1.05rem;
    margin: 22px 0 10px;
  }

  .kpis {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .kpi {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kpi small,
  .status small {
    color: var(--texto-suave);
    font-size: 0.75rem;
  }

  .kpi strong {
    font-size: 1.25rem;
  }

  .status-linha {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .status {
    padding: 12px 6px;
    text-align: center;
    display: flex;
    flex-direction: column;
  }

  .status strong {
    font-size: 1.3rem;
    color: var(--teal-700);
  }

  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    color: var(--texto);
  }

  .textos {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.3;
  }

  .textos small,
  .aval small {
    color: var(--texto-suave);
    font-size: 0.8rem;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
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

  .selo-status.ext {
    background: #f0eafa;
    color: #5b3f99;
  }

  .tabela {
    padding: 4px 16px;
  }

  .linha-preco {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--card-borda);
  }

  .linha-preco:last-child {
    border-bottom: none;
  }

  .linha-preco span {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
    min-width: 0;
  }

  .linha-preco small {
    color: var(--texto-suave);
    font-size: 0.76rem;
  }

  .linha-preco b {
    flex: none;
  }

  .aval {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .aval p {
    margin-top: 4px;
    font-size: 0.9rem;
    color: var(--texto-suave);
  }

  .nota {
    margin-top: 12px;
    font-size: 0.75rem;
    color: var(--texto-suave);
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
    padding: 24px 0;
  }
</style>