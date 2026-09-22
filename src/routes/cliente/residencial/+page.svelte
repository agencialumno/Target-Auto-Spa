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
                <div class="item card">
                    <span class="icone"><Icone nome={s.icone} /></span>
                    <span class="textos">
                        <strong>{s.nome}</strong>
                        <small>{s.descricao}</small>
                    </span>
                </div>
            {/each}
        </div>

        <a class="cta-chat" href="/cliente/chat">
            <span class="cta-icone"><Icone nome="chat" /></span>
            <span class="cta-textos">
                <strong>Quero saber mais</strong>
                <small
                    >Fale com o gerente do condomínio para preços e agendamento</small
                >
            </span>
            <Icone nome="chevron" tamanho={20} />
        </a>

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
        margin-bottom: 20px;
    }

    .item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
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

    .cta-chat {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border-radius: var(--raio);
        background: #fffaf0;
        border: 1px solid var(--gold-500);
        color: var(--texto);
    }

    .cta-icone {
        flex: none;
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--gold-500);
        color: var(--navy-900);
    }

    .cta-textos {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.3;
    }

    .cta-textos small {
        color: var(--texto-suave);
        font-size: 0.78rem;
    }

    .nota {
        margin-top: 14px;
        text-align: center;
        font-size: 0.78rem;
        color: var(--texto-suave);
    }
</style>
