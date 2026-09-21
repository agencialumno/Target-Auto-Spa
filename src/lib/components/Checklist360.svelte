<script lang="ts">
  import Icone from './Icone.svelte';
  import { app, type Agendamento, type Fase } from '$lib/app.svelte';
  import { angulos360 } from '$lib/mock';
  import { fotoComMarcaDagua, carimboDataHora } from '$lib/foto';

  let { ag, editavel = false }: { ag: Agendamento; editavel?: boolean } = $props();

  let fase = $state<Fase>('antes');
  let zoom = $state<string | null>(null);
  let erro = $state('');
  let processando = $state<string | null>(null);
  let input = $state<HTMLInputElement>();
  let alvo: string | null = null;

  const total = angulos360.length;
  const feitasAntes = $derived(app.fotosFeitas(ag, 'antes'));
  const feitasDepois = $derived(app.fotosFeitas(ag, 'depois'));

  const rotuloFase = (f: Fase) => (f === 'antes' ? 'Como chegou' : 'Como saiu');

  function abrir(angulo: string) {
    alvo = angulo;
    erro = '';
    input?.click();
  }

  async function aoEscolher(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const arquivo = el.files?.[0];
    el.value = '';
    const angulo = alvo;
    const faseAtual = fase;
    if (!arquivo || !angulo) return;

    processando = angulo;
    try {
      const imagem = await fotoComMarcaDagua(arquivo, [
        carimboDataHora(),
        `Placa ${ag.placa ?? '-'} · ${rotuloFase(faseAtual)}`,
        `${angulo} · Target Auto Spa`
      ]);
      app.salvarFoto(ag.id, faseAtual, angulo, imagem);
    } catch {
      erro = 'Não foi possível processar a foto. Tente de novo.';
    } finally {
      processando = null;
    }
  }
</script>

<div class="chips">
  <button class="chip" class:on={fase === 'antes'} onclick={() => (fase = 'antes')}>
    Como chegou ({feitasAntes}/{total})
  </button>
  <button class="chip" class:on={fase === 'depois'} onclick={() => (fase = 'depois')}>
    Como saiu ({feitasDepois}/{total})
  </button>
</div>

<div class="fotos">
  {#each angulos360 as angulo}
    {@const imagem = ag.fotos?.[`${fase}:${angulo}`]}
    {#if imagem}
      <div class="foto tem">
        <button class="ver" aria-label={`Ampliar ${angulo}`} onclick={() => (zoom = imagem)}>
          <img src={imagem} alt={`${rotuloFase(fase)} - ${angulo}`} />
        </button>
        <small>{angulo}</small>
        {#if editavel}
          <button class="refazer" aria-label={`Refazer ${angulo}`} onclick={() => abrir(angulo)}>
            <Icone nome="camera" tamanho={14} />
          </button>
        {/if}
      </div>
    {:else if editavel}
      <button class="foto vazia editar" onclick={() => abrir(angulo)} disabled={processando !== null}>
        <Icone nome="camera" tamanho={20} />
        <small>{processando === angulo ? 'Salvando...' : angulo}</small>
      </button>
    {:else}
      <div class="foto vazia">
        <Icone nome="camera" tamanho={20} />
        <small>{angulo}</small>
      </div>
    {/if}
  {/each}
</div>

{#if erro}<p class="erro">{erro}</p>{/if}

<p class="nota">
  {#if editavel}
    Toque em um quadrado para abrir a câmera. A data e a hora ficam gravadas na foto.
  {:else}
    Fotos registradas pela equipe, com data e hora na imagem.
  {/if}
</p>

<input
  bind:this={input}
  type="file"
  accept="image/*"
  capture="environment"
  hidden
  onchange={aoEscolher}
/>

{#if zoom}
  <button class="zoom" aria-label="Fechar imagem" onclick={() => (zoom = null)}>
    <img src={zoom} alt="Foto ampliada" />
  </button>
{/if}

<style>
  .fotos {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .foto {
    position: relative;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
  }

  .foto.vazia {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px;
    text-align: center;
    border: 1.5px dashed var(--card-borda);
    background: var(--card);
    color: var(--texto-suave);
  }

  .foto.editar {
    border-color: var(--gold-500);
    color: var(--teal-700);
  }

  .foto small {
    font-size: 0.62rem;
    line-height: 1.15;
  }

  .foto.tem .ver {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    background: none;
  }

  .foto.tem img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .foto.tem small {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    padding: 3px 4px;
    color: var(--white);
    background: linear-gradient(rgba(0, 0, 0, 0.55), transparent);
    pointer-events: none;
  }

  .refazer {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.6);
    color: var(--white);
  }

  .nota {
    margin-top: 8px;
    font-size: 0.75rem;
    color: var(--texto-suave);
  }

  .erro {
    margin-top: 8px;
    font-size: 0.82rem;
    color: #b3261e;
  }

  .zoom {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(8, 12, 18, 0.92);
  }

  .zoom img {
    max-width: 100%;
    max-height: 100%;
    border-radius: 12px;
  }
</style>