<script lang="ts">
    import Icone from "$lib/components/Icone.svelte";
    import { servicosResidenciais } from "$lib/mock";
</script>

<div class="pagina">
    <header class="cab">
        <div class="cab-topo">
            <a class="btn-voltar" href="/cliente" aria-label="Voltar">
                <Icone nome="back" />
            </a>
        </div>
        <h1>Serviços para o <em>seu lar</em></h1>
        <p>
            Home Spa Target — cuidado para estofados, cortinas e vidros da sua
            casa.
        </p>
    </header>

    <section class="folha com-barra">
        <div class="folha-alca"></div>

        <div class="lista">
            {#each servicosResidenciais as s}
                <a class="item card" href={`/cliente/residencial/${s.id}`}>
                    <span class="icone"><Icone nome={s.icone} /></span>
                    <span class="textos">
                        <strong>{s.nome}</strong>
                        <small>{s.descricao}</small>
                    </span>
                    <Icone nome="chevron" tamanho={20} />
                </a>
            {/each}
        </div>

        <p class="nota">
            Em breve os serviços residenciais poderão ser agendados direto pelo
            app, como os automotivos.
        </p>
    </section>
</div>

<style>
    .cab p {
        margin-top: 8px;
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
        gap: 14px;
        padding: 14px;
        color: var(--texto);
    }

    .icone {
        flex: none;
        width: 48px;
        height: 48px;
        border-radius: 15px;
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

    .textos strong {
        font-size: 0.96rem;
    }

    .textos small {
        color: var(--texto-suave);
        font-size: 0.8rem;
        margin-top: 2px;
    }

    .nota {
        margin-top: 4px;
        text-align: center;
        font-size: 0.78rem;
        color: var(--texto-suave);
    }
</style>
