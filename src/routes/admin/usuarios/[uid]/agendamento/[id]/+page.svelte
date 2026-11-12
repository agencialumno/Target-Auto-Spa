<script lang="ts">
  import { page } from '$app/state';
  import TelaAdmin from '$lib/components/TelaAdmin.svelte';
  import { brlCentavos, rotuloPagamento, rotuloStatus, situacaoPagamento, type Agendamento } from '$lib/agendamentos';
  import { dataExtensa } from '$lib/formato';
  import { carregarAgendamento, nomeDoCondominio } from '$lib/usuario-dados';
  import { duracaoDoCatalogo, linhaDoTempo } from '$lib/usuario-detalhe';

  const uid = $derived(page.params.uid ?? '');
  const id = $derived(page.params.id ?? '');

  let ag = $state<Agendamento | null>(null);
  let condominio = $state('');
  let carregando = $state(true);
  let erro = $state('');
  let naoExiste = $state(false);

  async function carregar() {
    carregando = true;
    erro = '';
    naoExiste = false;
    try {
      const a = await carregarAgendamento(id);
      if (!a) {
        naoExiste = true;
        return;
      }
      ag = a;
      nomeDoCondominio(a.condominioId)
        .then((n) => (condominio = n))
        .catch(() => (condominio = a.condominioId));
    } catch {
      erro = 'Não foi possível carregar o agendamento. Verifique a internet e tente de novo.';
    } finally {
      carregando = false;
    }
  }

  $effect(() => {
    id;
    carregar();
  });

  const quando = (d: Date | null | undefined) => (d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const duracao = $derived(ag ? duracaoDoCatalogo(ag) : null);
  const pg = $derived(ag?.pagamento ?? null);
  const sit = $derived(ag ? situacaoPagamento(ag) : 'nenhuma');
  const tempo = $derived(ag ? linhaDoTempo(ag) : []);
  const somaItens = $derived(ag ? ag.itens.reduce((s, i) => s + i.precoCentavos, 0) : 0);
</script>

<TelaAdmin titulo="Agendamento" sub="Detalhes completos">
  <a class="voltar" href={`/admin/usuarios/${uid}`}>← Voltar ao usuário</a>

  {#if carregando}
    <p class="aviso">Carregando...</p>
  {:else if naoExiste}
    <p class="erro" role="alert">Agendamento não encontrado.</p>
  {:else if erro}
    <p class="erro" role="alert">{erro}</p>
    <button class="btn-secundario" onclick={carregar}>Tentar de novo</button>
  {:else if ag}
    <section class="card bloco">
      <div class="topo">
        <h2>{ag.itens.map((i) => i.nome).join(' + ') || '(sem itens)'}</h2>
        <span class={`selo ${ag.status}`}>{rotuloStatus[ag.status]}</span>
      </div>
      <dl>
        <dt>Cliente</dt><dd>{ag.clienteNome || '—'}</dd>
        <dt>Condomínio</dt><dd>{condominio || ag.condominioId || '—'}</dd>
        <dt>Data</dt><dd>{ag.data ? dataExtensa(ag.data) : '—'}</dd>
        <dt>Horário</dt><dd>{ag.hora || '—'}</dd>
        <dt>Duração</dt><dd>{duracao !== null ? `${duracao} min (catálogo atual)` : 'Indisponível'}</dd>
        <dt>Funcionário</dt><dd>{ag.funcionarioNome || 'Não atribuído'}</dd>
        <dt>Veículo</dt><dd>{ag.veiculo.modelo || '—'}{ag.veiculo.placa ? ` · ${ag.veiculo.placa}` : ''}</dd>
        {#if ag.externo}<dt>Tipo</dt><dd>Insulfilm (profissional externo)</dd>{/if}
      </dl>
      {#if ag.observacoes}<p class="obs"><b>Observações:</b> {ag.observacoes}</p>{/if}
    </section>

    <h3>Itens (preço no momento da compra)</h3>
    <section class="card bloco">
      <ul class="itens">
        {#each ag.itens as i}<li><span>{i.nome}</span><b>{brlCentavos(i.precoCentavos)}</b></li>{/each}
      </ul>
      <div class="total"><span>Total</span><b>{brlCentavos(ag.total)}</b></div>
      {#if somaItens !== ag.total}<p class="erro" role="alert">Atenção: a soma dos itens ({brlCentavos(somaItens)}) difere do total registrado.</p>{/if}
    </section>

    <h3>Pagamento</h3>
    <section class="card bloco">
      {#if pg}
        <dl>
          <dt>Situação</dt><dd>{rotuloPagamento[sit]}</dd>
          <dt>Valor</dt><dd>{brlCentavos(ag.total)}</dd>
          <dt>Pago em</dt><dd>{pg.pagoEm ? quando(pg.pagoEm) : '—'}</dd>
          {#if pg.venceEm && pg.status === 'pendente'}<dt>Vence em</dt><dd>{quando(pg.venceEm)}</dd>{/if}
          {#if pg.revisao}<dt>Revisão</dt><dd>Marcado para conferência</dd>{/if}
        </dl>
      {:else}
        <p class="peq">Sem cobrança registrada neste agendamento.</p>
      {/if}
    </section>

    <h3>Histórico</h3>
    <section class="card bloco">
      {#if tempo.length}
        <ol class="tempo">
          {#each tempo as m}<li><b>{quando(m.em)}</b><span>{m.texto}</span></li>{/each}
        </ol>
      {:else}
        <p class="peq">Sem datas registradas.</p>
      {/if}
      <p class="peq">O app ainda não guarda cada mudança de status: a linha usa as datas registradas no agendamento (status atual: {rotuloStatus[ag.status]}).</p>
    </section>

    <h3>Avaliação</h3>
    <section class="card bloco">
      {#if ag.avaliacao}
        <strong>{'★'.repeat(ag.avaliacao.nota)}{'☆'.repeat(Math.max(0, 5 - ag.avaliacao.nota))} <span class="peq">({ag.avaliacao.nota}/5)</span></strong>
        {#if typeof ag.avaliacao.nps === 'number'}<p class="peq">Indicação: {ag.avaliacao.nps}/10</p>{/if}
        <p>{ag.avaliacao.comentario || 'Sem comentário.'}</p>
        <p class="peq">{quando(ag.avaliacao.em)}</p>
      {:else}
        <p class="peq">Ainda não avaliado.</p>
      {/if}
    </section>
  {/if}
</TelaAdmin>

<style>
  .voltar {
    display: inline-block;
    margin-bottom: 12px;
    color: var(--teal-700);
    font-size: 0.9rem;
    min-height: 44px;
    line-height: 44px;
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  h3 {
    margin: 16px 0 6px;
    font-size: 0.95rem;
  }

  .bloco {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .topo {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: 0.88rem;
  }

  dt,
  .peq {
    color: var(--texto-suave);
  }

  .peq {
    font-size: 0.78rem;
    margin: 0;
  }

  dd {
    margin: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .obs,
  p {
    margin: 0;
    font-size: 0.88rem;
    overflow-wrap: anywhere;
  }

  .itens {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .itens li,
  .total {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.9rem;
  }

  .total {
    border-top: 1px solid var(--card-borda);
    padding-top: 8px;
    font-size: 1rem;
  }

  .tempo {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tempo li {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
  }

  .selo {
    flex: none;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--info-fundo);
    color: var(--teal-700);
  }

  .selo.em_andamento {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
  }

  .selo.finalizado {
    background: var(--ok-fundo);
    color: var(--ok-texto);
  }

  .selo.cancelado {
    background: #fdecea;
    color: #b3261e;
  }

  .erro {
    color: var(--erro);
    font-size: 0.85rem;
  }

  .aviso {
    text-align: center;
    color: var(--texto-suave);
    padding: 16px 0;
  }
</style>
