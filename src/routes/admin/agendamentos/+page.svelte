<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import TelaAdmin from '$lib/components/TelaAdmin.svelte';
  import { app, rotuloStatus } from '$lib/app.svelte';
  import { brlCentavos, nomesItens } from '$lib/agendamentos';
  import { dataCurta } from '$lib/formato';
</script>

<TelaAdmin titulo="Agendamentos" sub="Todos os condomínios">
  {#if app.agendamentos.length === 0}
    <p class="vazio">Nenhum agendamento ainda.</p>
  {/if}
  <div class="lista">
    {#each app.agendamentos as a (a.id)}
      <a class="item card" href={`/admin/agendamentos/${a.id}`}>
        <span class="textos">
          <strong>{nomesItens(a.itens)}</strong>
          <small>
            {dataCurta(a.data)} às {a.hora} · {a.veiculo.placa || '-'} · {brlCentavos(a.total)}
          </small>
          <span class="tags">
            <span class={`selo-status ${a.status}`}>{rotuloStatus[a.status]}</span>
            {#if a.externo}
              <span class="selo-status ext">Insulfilm</span>
            {/if}
            {#if a.pagamento?.status === 'pago'}
              <span class="selo-status finalizado">Pago</span>
            {:else if a.pagamento?.status === 'pago_apos_cancelamento' || a.pagamento?.status === 'divergente'}
              <span class="selo-status revisar">Revisar pagamento</span>
            {/if}
          </span>
        </span>
        <Icone nome="chevron" tamanho={20} />
      </a>
    {/each}
  </div>
</TelaAdmin>

<style>
  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 14px;
    color: var(--texto);
    text-decoration: none;
  }

  .textos {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.3;
  }

  .textos small {
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

  .selo-status.em_andamento {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
  }

  .selo-status.finalizado {
    background: var(--ok-fundo);
    color: var(--ok-texto);
  }

  .selo-status.revisar {
    background: #fdecea;
    color: #b3261e;
  }

  .selo-status.ext {
    background: #f0eafa;
    color: #5b3f99;
  }

  .vazio {
    text-align: center;
    color: var(--texto-suave);
    padding: 24px 0;
  }
</style>
