<script lang="ts">
    import { page } from "$app/state";
    import Icone from "$lib/components/Icone.svelte";
    import { servicosResidenciais } from "$lib/mock";

    const servico = $derived(
        servicosResidenciais.find((s) => s.id === page.params.id),
    );
</script>

<div class="pagina">
    {#if servico}
        {@const s = servico}
        <header class="cab">
            <div class="cab-topo">
                <a
                    class="btn-voltar"
                    href="/cliente/residencial"
                    aria-label="Voltar"
                >
                    <Icone nome="back" />
                </a>
            </div>
            <div class="icone-grande">
                <Icone nome={s.icone} tamanho={30} />
            </div>
            <h1>{s.nome}</h1>
        </header>

        <section class="folha corpo">
            <div class="folha-alca"></div>

            <p class="desc">{s.descricao}</p>

            <p class="preco-aviso">
                <Icone nome="chat" tamanho={18} />
                Preço sob consulta — fale com o gerente do condomínio.
            </p>

            <h2>Benefícios</h2>
            <ul class="lista-beneficios">
                {#each s.beneficios as b}
                    <li>
                        <span class="ok"
                            ><Icone nome="check" tamanho={14} /></span
                        >
                        {b}
                    </li>
                {/each}
            </ul>
        </section>

        <div class="cta">
            <a class="btn-primario" href="/cliente/chat">Falar com o gerente</a>
        </div>
    {:else}
        <header class="cab">
            <div class="cab-topo">
                <a
                    class="btn-voltar"
                    href="/cliente/residencial"
                    aria-label="Voltar"
                >
                    <Icone nome="back" />
                </a>
            </div>
            <h1>Serviço não encontrado</h1>
        </header>
        <section class="folha"></section>
    {/if}
</div>

<style>
    .icone-grande {
        width: 60px;
        height: 60px;
        margin-bottom: 14px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.12);
        color: var(--gold-500);
    }

    .corpo {
        padding-bottom: calc(150px + var(--safe-bottom));
    }

    .desc {
        color: var(--texto-suave);
        font-size: 0.95rem;
    }

    .preco-aviso {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: var(--raio);
        background: var(--info-fundo);
        color: var(--teal-700);
        font-size: 0.85rem;
        font-weight: 600;
    }

    h2 {
        font-size: 1.05rem;
        margin: 22px 0 12px;
    }

    .lista-beneficios {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .lista-beneficios li {
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

    .cta {
        position: fixed;
        left: 12px;
        right: 12px;
        bottom: calc(88px + var(--safe-bottom));
        z-index: 15;
        max-width: 480px;
        margin: 0 auto;
    }
</style>
