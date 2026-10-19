<script lang="ts">
  import { goto } from '$app/navigation';
  import Icone from '$lib/components/Icone.svelte';
  import BotaoChat from '$lib/components/BotaoChat.svelte';
  import { app } from '$lib/app.svelte';
  import { reserva } from '$lib/reserva.svelte';
  import { planos, brl } from '$lib/mock';
  import { niveis, JANELA_DIAS } from '$lib/niveis';

  const pct = $derived(
    app.proximo ? Math.min(100, Math.round((app.gasto / app.proximo.min) * 100)) : 100
  );

  let confirmandoSaida = $state(false);

  async function sair() {
    reserva.reiniciar();
    await goto('/');
  }
</script>

<div class="pagina">
  <header class="cab">
    <div class="cab-topo">
      <span class="avatar"><Icone nome="user" tamanho={26} /></span>
      <BotaoChat href="/cliente/chat" contagem={app.msgNaoLidasCliente} />
    </div>
    <h1>Meu <em>perfil</em></h1>
  </header>

  <section class="folha com-barra">
    <div class="folha-alca"></div>

    <div class="nivel">
      <div class="nivel-topo">
        <span><Icone nome="crown" tamanho={18} /> Nível atual</span>
        <strong>{app.nivel.nome}</strong>
      </div>
      <div class="progresso"><span style={`width: ${pct}%`}></span></div>
      <small>
        Gasto nos últimos {JANELA_DIAS} dias: <b>{brl(app.gasto)}</b>.
        {#if app.proximo}
          Faltam {brl(app.proximo.min - app.gasto)} para a {app.proximo.nome}.
        {:else}
          Você está no nível máximo.
        {/if}
      </small>
    </div>

    <h2>Níveis e descontos</h2>
    <div class="faixas">
      {#each niveis as n}
        <div class="faixa card" class:atual={n.id === app.nivel.id}>
          <strong>{n.nome}</strong>
          <small>{n.min === 0 ? 'Início' : `a partir de ${brl(n.min)}`}</small>
          <b>{n.desconto}%</b>
        </div>
      {/each}
    </div>
    <p class="nota">Faixas de exemplo. O total considera os últimos {JANELA_DIAS} dias.</p>

    <h2>Clube de assinatura</h2>
    <div class="planos">
      {#each planos as p}
        {@const ativo = app.planoId === p.id}
        <div class="plano card" class:ativo>
          <div class="plano-topo">
            <strong>{p.nome}</strong>
            <span><b>{brl(p.preco)}</b>/mês</span>
          </div>
          <ul>
            {#each p.inclui as item}
              <li><Icone nome="check" tamanho={14} /> {item}</li>
            {/each}
          </ul>
          {#if ativo}
            <button class="btn-secundario" onclick={() => app.assinar(null)}>
              Cancelar assinatura
            </button>
          {:else}
            <button class="btn-primario" onclick={() => app.assinar(p.id)}>
              Assinar {p.nome}
            </button>
          {/if}
        </div>
      {/each}
    </div>
    <p class="nota">
      Demonstração: sem cobrança real. O desconto do plano e o do nível não se somam; vale o
      maior.
    </p>

    <h2>Ajuda</h2>
    <a class="link-linha card" href="/cliente/chat">
      <Icone nome="chat" />
      <span>Falar com o gerente do condomínio</span>
      {#if app.msgNaoLidasCliente > 0}
        <b class="novas">{app.msgNaoLidasCliente}</b>
      {/if}
      <Icone nome="chevron" tamanho={18} />
    </a>

    <h2>Conta</h2>
    {#if confirmandoSaida}
      <div class="card confirma">
        <p>Deseja sair da sua conta?</p>
        <div class="confirma-botoes">
          <button class="btn-secundario" onclick={() => (confirmandoSaida = false)}>
            Cancelar
          </button>
          <button class="btn-primario" onclick={sair}>Sair</button>
        </div>
      </div>
    {:else}
      <button class="sair card" onclick={() => (confirmandoSaida = true)}>
        <Icone nome="logout" />
        <span>Sair da conta</span>
      </button>
    {/if}

    <button class="zerar" onclick={() => app.resetar()}>Zerar dados da demonstração</button>
  </section>
</div>

<style>
  .avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.12);
    color: var(--gold-100);
  }

  h2 {
    font-size: 1.05rem;
    margin: 22px 0 10px;
  }

  .nivel {
    padding: 18px;
    border-radius: var(--raio);
    background: linear-gradient(135deg, var(--navy-900), var(--navy-700));
    color: var(--white);
  }

  .nivel-topo {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
    font-size: 0.85rem;
    color: var(--silver);
  }

  .nivel-topo span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .nivel-topo strong {
    font-size: 1.3rem;
    color: var(--gold-500);
  }

  .progresso {
    height: 6px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.15);
    overflow: hidden;
    margin-bottom: 10px;
  }

  .progresso span {
    display: block;
    height: 100%;
    background: var(--gold-500);
    border-radius: 6px;
  }

  .nivel small {
    color: var(--silver);
    font-size: 0.78rem;
  }

  .nivel b {
    color: var(--white);
  }

  .faixas {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .faixa {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 12px 6px;
    text-align: center;
  }

  .faixa small {
    font-size: 0.68rem;
    color: var(--texto-suave);
  }

  .faixa b {
    margin-top: 4px;
    font-size: 1.1rem;
    color: var(--teal-700);
  }

  .faixa.atual {
    border-color: var(--gold-500);
    background: var(--destaque-fundo);
  }

  .nota {
    margin-top: 8px;
    font-size: 0.75rem;
    color: var(--texto-suave);
  }

  .planos {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .plano {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .plano.ativo {
    border-color: var(--gold-500);
    background: var(--destaque-fundo);
  }

  .plano-topo {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 1.05rem;
  }

  .plano-topo span {
    font-size: 0.85rem;
    color: var(--texto-suave);
  }

  .plano-topo b {
    font-size: 1.1rem;
    color: var(--texto);
  }

  .plano ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.88rem;
  }

  .plano li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .plano li :global(svg) {
    color: var(--teal-700);
    flex: none;
  }

  .link-linha {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    color: var(--texto);
  }

  .link-linha span {
    flex: 1;
    font-weight: 600;
    font-size: 0.92rem;
  }

  .novas {
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--erro-vivo);
    color: var(--white);
    font-size: 0.72rem;
  }

  .sair {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px;
    color: var(--erro);
    font-weight: 600;
    font-size: 0.92rem;
    text-align: left;
  }

  .confirma {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .confirma p {
    font-weight: 600;
  }

  .confirma-botoes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .zerar {
    display: block;
    margin: 24px auto 0;
    background: none;
    color: var(--texto-suave);
    font-size: 0.82rem;
    text-decoration: underline;
  }
</style>