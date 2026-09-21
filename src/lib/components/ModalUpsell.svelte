<script lang="ts">
  import Icone from './Icone.svelte';
  import { reserva } from '$lib/reserva.svelte';
  import { upsellPor, getServico, brl, type Servico } from '$lib/mock';

  let {
    aberto,
    onfechar,
    oncontinuar
  }: { aberto: boolean; onfechar: () => void; oncontinuar: () => void } = $props();

  const sugestoes = $derived(
    (upsellPor[reserva.principalId ?? ''] ?? [])
      .map(getServico)
      .filter((s): s is Servico => !!s)
  );
</script>

{#if aberto}
  <div class="camada">
    <button class="fundo" aria-label="Fechar" onclick={onfechar}></button>

    <div class="modal" role="dialog" aria-modal="true" aria-label="Sugestões">
      <div class="alca"></div>
      <h2>Complete o cuidado do seu carro</h2>
      <p class="sub">Adicione ao mesmo agendamento e aproveite a visita.</p>

      <div class="lista">
        {#each sugestoes as s}
          {@const marcado = reserva.extras.includes(s.id)}
          <button class="item" class:marcado onclick={() => reserva.alternarExtra(s.id)}>
            <span class="icone"><Icone nome={s.icone} /></span>
            <span class="textos">
              <strong>{s.nome}</strong>
              <small>{s.descricao}</small>
            </span>
            <span class="preco">
              <b>+ {brl(s.preco)}</b>
              <span class="check" class:on={marcado}>
                {#if marcado}<Icone nome="check" tamanho={14} />{/if}
              </span>
            </span>
          </button>
        {/each}
      </div>

      <button class="btn-primario" onclick={oncontinuar}>
        Continuar · {brl(reserva.total)}
      </button>
      <button class="pular" onclick={oncontinuar}>Continuar sem adicionar</button>
    </div>
  </div>
{/if}

<style>
  .camada {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .fundo {
    position: absolute;
    inset: 0;
    background: rgba(10, 15, 22, 0.6);
    animation: aparecer 0.2s both;
  }

  .modal {
    position: relative;
    width: 100%;
    max-width: 520px;
    background: var(--folha);
    color: var(--texto);
    border-radius: var(--raio-grande) var(--raio-grande) 0 0;
    padding: 12px 20px calc(20px + var(--safe-bottom));
    animation: subir 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .alca {
    width: 40px;
    height: 4px;
    border-radius: 4px;
    background: var(--card-borda);
    margin: 0 auto 18px;
  }

  h2 {
    font-size: 1.2rem;
  }

  .sub {
    color: var(--texto-suave);
    font-size: 0.9rem;
    margin: 6px 0 16px;
  }

  .lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    text-align: left;
    background: var(--card);
    border: 1px solid var(--card-borda);
    border-radius: var(--raio);
    color: var(--texto);
  }

  .item.marcado {
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
    line-height: 1.3;
  }

  .textos small {
    color: var(--texto-suave);
    font-size: 0.78rem;
  }

  .preco {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    font-size: 0.85rem;
  }

  .check {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--card-borda);
    display: grid;
    place-items: center;
    color: var(--navy-900);
  }

  .check.on {
    background: var(--gold-500);
    border-color: var(--gold-500);
  }

  .pular {
    width: 100%;
    margin-top: 8px;
    padding: 12px;
    background: transparent;
    color: var(--texto-suave);
    font-size: 0.9rem;
  }

  @keyframes subir {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes aparecer {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>