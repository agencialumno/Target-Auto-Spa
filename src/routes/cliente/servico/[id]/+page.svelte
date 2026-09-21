<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import Icone from '$lib/components/Icone.svelte';
  import ModalUpsell from '$lib/components/ModalUpsell.svelte';
  import { getServico, avaliacoes, brl } from '$lib/mock';
  import { reserva } from '$lib/reserva.svelte';

  const servico = $derived(getServico(page.params.id ?? ''));

  let modal = $state(false);

  function agendar() {
    if (!servico) return;
    reserva.escolher(servico.id);
    if (servico.avulso) {
      goto('/cliente/agendar'); // insulfilm não tem upsell: agenda própria
    } else {
      modal = true;
    }
  }

  function continuar() {
    modal = false;
    goto('/cliente/agendar');
  }
</script>

<div class="pagina">
  {#if servico}
    {@const s = servico}

    <header class="cab">
      <div class="cab-topo">
        <a class="btn-voltar" href="/cliente/servicos" aria-label="Voltar">
          <Icone nome="back" />
        </a>
      </div>

      <div class="video">
        {#if s.video}
          <video src={s.video} controls playsinline preload="metadata">
            <track kind="captions" />
          </video>
        {:else}
          <div class="video-vazio">
            <span class="play"><Icone nome="play" tamanho={26} /></span>
            <small>Vídeo explicativo em breve</small>
          </div>
        {/if}
      </div>
    </header>

    <section class="folha corpo">
      <div class="folha-alca"></div>

      <h1>{s.nome}</h1>
      <p class="desc">{s.descricao}</p>

      <div class="info">
        <div class="card">
          <small>Preço</small>
          <strong>{brl(s.preco)}</strong>
        </div>
        <div class="card">
          <small>Duração</small>
          <strong>{s.duracao} min</strong>
        </div>
        {#if s.garantia}
          <div class="card">
            <small>Garantia</small>
            <strong>{s.garantia.split(',')[0]}</strong>
          </div>
        {/if}
      </div>

      {#if s.garantia}
        <p class="garantia">
          <Icone nome="shield" tamanho={18} /> Garantia de {s.garantia}.
        </p>
      {/if}

      <p class="selo">
        <Icone nome="leaf" tamanho={18} />
        Produtos biodegradáveis, sem soda cáustica.
      </p>

      <h2>O que está incluso</h2>
      <ul class="inclui">
        {#each s.inclui as item}
          <li>
            <span class="ok"><Icone nome="check" tamanho={14} /></span>
            {item}
          </li>
        {/each}
      </ul>

      <div class="secao-topo">
        <h2>Avaliações</h2>
        <span class="nota"><Icone nome="star" tamanho={16} /> 5,0</span>
      </div>
      {#each avaliacoes as a}
        <div class="aval card">
          <strong>{a.nome}</strong>
          <p>{a.texto}</p>
        </div>
      {/each}
      <p class="demo">Avaliações de exemplo para a demonstração.</p>
    </section>

    <div class="cta">
      <button class="btn-primario" onclick={agendar}>
        Agendar · {brl(s.preco)}
      </button>
    </div>

    <ModalUpsell aberto={modal} onfechar={() => (modal = false)} oncontinuar={continuar} />
  {:else}
    <header class="cab">
      <div class="cab-topo">
        <a class="btn-voltar" href="/cliente/servicos" aria-label="Voltar">
          <Icone nome="back" />
        </a>
      </div>
      <h1>Serviço não encontrado</h1>
    </header>
    <section class="folha"></section>
  {/if}
</div>

<style>
  .video {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--raio);
    overflow: hidden;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .video video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-vazio {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--silver);
  }

  .play {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--gold-500);
    color: var(--navy-900);
  }

  .corpo {
    padding-bottom: calc(110px + var(--safe-bottom));
  }

  h1 {
    font-size: 1.5rem;
  }

  h2 {
    font-size: 1.05rem;
    margin: 22px 0 10px;
  }

  .desc {
    margin-top: 6px;
    color: var(--texto-suave);
  }

  .info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
    gap: 10px;
    margin-top: 18px;
  }

  .info .card {
    padding: 12px;
    display: flex;
    flex-direction: column;
  }

  .info small {
    color: var(--texto-suave);
    font-size: 0.74rem;
  }

  .info strong {
    font-size: 0.95rem;
    line-height: 1.25;
  }

  .garantia,
  .selo {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: var(--raio);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--teal-700);
    background: #eef5f8;
  }

  .inclui {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .inclui li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.92rem;
  }

  .ok {
    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--gold-500);
    color: var(--navy-900);
  }

  .nota {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
    color: var(--gold-500);
  }

  .aval {
    padding: 12px 14px;
    margin-bottom: 8px;
  }

  .aval p {
    margin-top: 2px;
    font-size: 0.88rem;
    color: var(--texto-suave);
  }

  .demo {
    font-size: 0.75rem;
    color: var(--texto-suave);
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
</style>