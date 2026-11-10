<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '$lib/app.svelte';
  import { rotuloPagamento, situacaoPagamento, type Agendamento } from '$lib/agendamentos';

  // Selo e botão de pagamento de um agendamento. O status vem do Firestore em tempo real (o app
  // nunca confirma pagamento sozinho: quem confirma é o webhook do Asaas, no servidor).
  let { ag }: { ag: Agendamento | undefined } = $props();

  let ocupado = $state(false);
  let erro = $state('');
  let agora = $state(Date.now());

  onMount(() => {
    const t = setInterval(() => (agora = Date.now()), 5000);
    return () => clearInterval(t);
  });

  const sit = $derived(ag ? situacaoPagamento(ag, agora) : 'nenhuma');
  const aberto = $derived(ag?.status === 'agendado');
  const podePagar = $derived(aberto && (sit === 'sem' || sit === 'pendente'));
  const venceAs = $derived(
    ag?.pagamento?.venceEm
      ? ag.pagamento.venceEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : ''
  );

  async function pagar() {
    if (!ag || ocupado) return;
    ocupado = true;
    erro = '';
    try {
      await app.pagar(ag.id);
    } catch (e) {
      erro = (e as Error)?.message || 'Não foi possível abrir o pagamento. Tente novamente.';
    } finally {
      ocupado = false;
    }
  }
</script>

{#if ag && sit !== 'nenhuma'}
  <section class="pagamento card" aria-label="Pagamento">
    <div class="topo">
      <strong>Pagamento</strong>
      <span class={`selo ${sit}`}>{rotuloPagamento[sit]}</span>
    </div>

    {#if sit === 'pago'}
      <p>Pagamento confirmado. Obrigado!</p>
    {:else if sit === 'revisao'}
      <p>Recebemos o seu pagamento e a equipe está conferindo. Você não precisa pagar de novo.</p>
    {:else if sit === 'expirado'}
      <p role="alert">
        O prazo de 15 minutos para pagar terminou. O agendamento foi cancelado e o horário foi liberado.
        Agende de novo para escolher outro horário.
      </p>
    {:else if sit === 'cancelado'}
      <p role="alert">O pagamento foi cancelado e o agendamento também. O horário foi liberado.</p>
    {:else if sit === 'vencido'}
      <p role="alert">O prazo de 15 minutos terminou. Estamos liberando o horário; atualize em instantes.</p>
    {:else if podePagar}
      <p>
        {#if sit === 'pendente' && venceAs}Pague até as {venceAs} para manter o horário.{:else}Você tem 15 minutos para pagar a partir do momento em que abrir o pagamento.{/if}
        Pix ou cartão, em uma página segura do Asaas.
      </p>
      <button class="btn-primario" onclick={pagar} disabled={ocupado}>
        {ocupado ? 'Abrindo...' : 'Pagar'}
      </button>
    {/if}

    {#if erro}<p class="erro" role="alert">{erro}</p>{/if}
  </section>
{/if}

<style>
  .pagamento {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    margin-top: 16px;
  }

  .topo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  p {
    font-size: 0.88rem;
    line-height: 1.4;
    color: var(--texto-suave);
  }

  .erro {
    color: var(--erro);
  }

  .btn-primario {
    min-height: 48px;
  }

  .selo {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    white-space: nowrap;
  }

  .selo.pago {
    background: var(--ok-fundo);
    color: var(--ok-texto);
  }

  .selo.revisao {
    background: var(--info-fundo);
    color: var(--teal-700);
  }

  .selo.expirado,
  .selo.cancelado,
  .selo.vencido {
    background: #fdecea;
    color: #b3261e;
  }
</style>
