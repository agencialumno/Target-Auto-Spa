<script lang="ts">
    import Icone from "$lib/components/Icone.svelte";
    import BotaoChat from "$lib/components/BotaoChat.svelte";
    import { app } from "$lib/app.svelte";
    import { servicos, brl } from "$lib/mock";

    const destaques = servicos.filter((s) => !s.oculto).slice(0, 5);

    const pct = $derived(
        app.proximo
            ? Math.min(100, Math.round((app.gasto / app.proximo.min) * 100))
            : 100,
    );
</script>

<div class="pagina">
    <header class="cab">
        <div class="cab-topo">
            <div class="local">
                <span class="pino"><Icone nome="pin" tamanho={18} /></span>
                <div>
                    <small>Seu condomínio</small>
                    <strong>Residencial Exemplo</strong>
                </div>
            </div>
            <div class="acoes">
                <BotaoChat
                    href="/cliente/chat"
                    contagem={app.msgNaoLidasCliente}
                />
                <a class="avatar" href="/cliente/perfil" aria-label="Perfil">
                    <Icone nome="user" />
                </a>
            </div>
        </div>
        <h1>Seu carro cuidado, <em>sem sair do prédio.</em></h1>
    </header>

    <section class="folha com-barra">
        <div class="folha-alca"></div>

        <a class="busca" href="/cliente/servicos">
            <Icone nome="search" tamanho={20} />
            <span>Buscar serviço</span>
        </a>

        <div class="secao-topo">
            <h2>Serviços</h2>
            <a href="/cliente/servicos">Ver todos</a>
        </div>

        <div class="carrossel">
            {#each destaques as s}
                <a class="cartao" href={`/cliente/servico/${s.id}`}>
                    <span class="icone"><Icone nome={s.icone} /></span>
                    <strong>{s.nome}</strong>
                    <small>{s.duracao} min</small>
                    <b>{brl(s.preco)}</b>
                </a>
            {/each}
        </div>

        <a class="banner-residencial" href="/cliente/residencial">
            <span class="banner-icone"><Icone nome="home" tamanho={26} /></span>
            <span class="banner-textos">
                <strong>Novo! Serviços para o seu lar</strong>
                <small
                    >Estofados, impermeabilização e insulfilm residencial</small
                >
            </span>
            <Icone nome="chevron" tamanho={20} />
        </a>

        <a class="combo" href="/cliente/servico/combo-4-banhos">
            <span class="combo-icone"><Icone nome="star" /></span>
            <span class="combo-texto">
                <strong>Combo 4 lavagens completas</strong>
                <small>Lavagem + secagem + aspiração com 10% de desconto</small>
            </span>
            <Icone nome="chevron" tamanho={20} />
        </a>

        <a class="nivel" href="/cliente/perfil">
            <div class="nivel-topo">
                <span>Seu nível</span>
                <strong>{app.nivel.nome}</strong>
            </div>
            <div class="progresso"><span style={`width: ${pct}%`}></span></div>
            <small>
                {#if app.proximo}
                    {brl(app.gasto)} de {brl(app.proximo.min)} nos últimos 90 dias
                    para chegar à {app.proximo.nome}
                {:else}
                    Você está no nível máximo. Desconto de {app.nivel.desconto}%
                    em todos os serviços.
                {/if}
            </small>
        </a>

        <div class="selos">
            <div class="selo card">
                <Icone nome="leaf" />
                <span>Biodegradável</span>
            </div>
            <div class="selo card">
                <Icone nome="shield" />
                <span>Sem soda cáustica</span>
            </div>
            <div class="selo card">
                <Icone nome="sparkle" />
                <span>Sem cara de lava a jato</span>
            </div>
        </div>
    </section>
</div>

<style>
    .local {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }

    .acoes {
        display: flex;
        gap: 8px;
    }

    .pino,
    .avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.12);
        color: var(--gold-100);
    }

    .local small {
        display: block;
        font-size: 0.72rem;
        color: var(--silver);
        line-height: 1.2;
    }

    .local strong {
        font-size: 0.95rem;
    }

    .carrossel {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        margin: 0 -20px 20px;
        padding: 0 20px 6px;
        scrollbar-width: none;
    }

    .cartao {
        flex: none;
        width: 150px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px;
        background: var(--card);
        border: 1px solid var(--card-borda);
        border-radius: var(--raio);
        color: var(--texto);
    }

    .cartao .icone {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: var(--navy-900);
        color: var(--gold-500);
        margin-bottom: 8px;
    }

    .cartao strong {
        font-size: 0.92rem;
        line-height: 1.25;
    }

    .cartao small {
        color: var(--texto-suave);
        font-size: 0.78rem;
    }

    .cartao b {
        margin-top: 4px;
        font-size: 0.95rem;
    }

    .banner-residencial {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        margin-bottom: 20px;
        border-radius: var(--raio);
        background: linear-gradient(135deg, var(--gold-500), #f0cf7a);
        color: var(--navy-900);
    }

    .banner-icone {
        flex: none;
        width: 46px;
        height: 46px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: rgba(27, 35, 46, 0.15);
    }

    .banner-textos {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.3;
    }

    .banner-textos strong {
        font-size: 0.95rem;
    }

    .banner-textos small {
        font-size: 0.78rem;
        opacity: 0.85;
    }

    .combo {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        margin-bottom: 14px;
        border-radius: var(--raio);
        background: var(--destaque-fundo);
        border: 1px solid var(--gold-500);
        color: var(--texto);
    }

    .combo-icone {
        flex: none;
        width: 42px;
        height: 42px;
        border-radius: 13px;
        display: grid;
        place-items: center;
        background: var(--gold-500);
        color: var(--navy-900);
    }

    .combo-texto {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.3;
    }

    .combo-texto small {
        color: var(--texto-suave);
        font-size: 0.78rem;
    }

    .nivel {
        display: block;
        padding: 18px;
        margin-bottom: 20px;
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

    .nivel-topo strong {
        font-size: 1.2rem;
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
        font-size: 0.76rem;
    }

    .selos {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
    }

    .selo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 14px 8px;
        text-align: center;
        font-size: 0.72rem;
        font-weight: 600;
        line-height: 1.25;
        color: var(--teal-700);
    }
</style>
