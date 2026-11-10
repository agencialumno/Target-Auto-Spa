<script lang="ts">
  import Icone from './Icone.svelte';
  import { criteriosSenha } from '$lib/validacao';

  // Atendidos em verde, em tempo real. Os que faltam ficam em vermelho depois da primeira tentativa.
  let { senha, tentou = false }: { senha: string; tentou?: boolean } = $props();

  const itens = $derived(criteriosSenha(senha));
</script>

<ul class="criterios" aria-label="Requisitos da senha">
  {#each itens as c (c.id)}
    <li class:ok={c.atendido} class:falha={tentou && !c.atendido}>
      <span class="marca" aria-hidden="true">
        {#if c.atendido}<Icone nome="check" tamanho={12} />{:else if tentou}!{/if}
      </span>
      <span>{c.texto}</span>
      <span class="so-leitor">{c.atendido ? 'atendido' : tentou ? 'não atendido' : 'pendente'}</span>
    </li>
  {/each}
</ul>

<style>
  .criterios {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--texto-suave);
  }

  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .marca {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
    border: 1.5px solid var(--card-borda);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
  }

  li.ok {
    color: var(--ok-texto);
  }

  li.ok .marca {
    background: var(--ok-fundo);
    border-color: var(--ok-texto);
  }

  li.falha {
    color: var(--erro);
    font-weight: 600;
  }

  li.falha .marca {
    border-color: var(--erro);
    color: var(--erro);
  }

  .so-leitor {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
