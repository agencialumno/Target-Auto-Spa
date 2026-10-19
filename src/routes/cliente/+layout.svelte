<script lang="ts">
    import { page } from "$app/state";
    import Icone from "$lib/components/Icone.svelte";
    import { app } from "$lib/app.svelte";
    import GuardaPapel from "$lib/components/GuardaPapel.svelte";

    let { children } = $props();

    const caminho = $derived(page.url.pathname.replace(/\/$/, ""));

    // Nas telas com botão de ação fixo ou campo de digitar, a barra some
    const esconder = $derived(
        caminho.startsWith("/cliente/servico/") ||
            caminho.startsWith("/cliente/agendar") ||
            caminho.startsWith("/cliente/agendamentos/") ||
            caminho.startsWith("/cliente/chat"),
    );

    const ativa = (prefixo: string) =>
        prefixo === "/cliente"
            ? caminho === "/cliente"
            : caminho.startsWith(prefixo);
</script>

<GuardaPapel papel="cliente">
{@render children()}

{#if !esconder}
    <nav class="barra" aria-label="Navegação principal">
        <a class="aba" class:ativa={ativa("/cliente")} href="/cliente">
            <Icone nome="home" />
            <span>Início</span>
        </a>
        <a
            class="aba"
            class:ativa={ativa("/cliente/agendamentos")}
            href="/cliente/agendamentos"
        >
            <Icone nome="calendar" />
            <span>Agenda</span>
        </a>
        <a class="mais" href="/cliente/servicos" aria-label="Novo agendamento">
            <Icone nome="plus" tamanho={26} />
        </a>
        <a
            class="aba"
            class:ativa={ativa("/cliente/notificacoes")}
            href="/cliente/notificacoes"
        >
            <span class="icone-aba">
                <Icone nome="bell" />
                {#if app.naoLidasNotif > 0}
                    <span class="selo"
                        >{app.naoLidasNotif > 9
                            ? "9+"
                            : app.naoLidasNotif}</span
                    >
                {/if}
            </span>
            <span>Avisos</span>
        </a>
        <a
            class="aba"
            class:ativa={ativa("/cliente/perfil")}
            href="/cliente/perfil"
        >
            <Icone nome="user" />
            <span>Perfil</span>
        </a>
    </nav>
{/if}
</GuardaPapel>

<style>
    .barra {
        position: fixed;
        left: 12px;
        right: 12px;
        bottom: calc(12px + var(--safe-bottom));
        max-width: 480px;
        margin: 0 auto;
        z-index: 20;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        align-items: center;
        padding: 8px 6px;
        background: var(--superficie);
        border: 1px solid var(--superficie-borda);
        border-radius: 28px;
        box-shadow: 0 12px 32px rgba(8, 12, 18, 0.35);
    }

    .aba {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 6px 0;
        font-size: 0.68rem;
        color: var(--texto-claro-suave);
    }

    .aba.ativa {
        color: var(--gold-500);
        font-weight: 700;
    }

    .icone-aba {
        position: relative;
        display: grid;
        place-items: center;
    }

    .selo {
        position: absolute;
        top: -6px;
        right: -10px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--erro-vivo);
        color: var(--white);
        border: 2px solid var(--superficie);
        font-size: 0.62rem;
        font-weight: 700;
        line-height: 1;
    }

    .mais {
        width: 56px;
        height: 56px;
        margin: -30px auto 0;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--gold-500);
        color: var(--navy-900);
        box-shadow: 0 8px 20px rgba(217, 180, 90, 0.45);
    }

    /* Estilos compartilhados pelas telas do cliente */
    :global(.pagina) {
        width: 100%;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
        background: linear-gradient(
            160deg,
            var(--navy-900) 0%,
            var(--navy-700) 100%
        );
    }

    :global(.pagina .folha) {
        flex: 1;
    }

    :global(.com-barra) {
        padding-bottom: calc(112px + var(--safe-bottom)) !important;
    }

    :global(.cab) {
        padding: calc(16px + var(--safe-top)) 20px 26px;
        color: var(--white);
    }

    :global(.cab-topo) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 20px;
    }

    :global(.cab h1) {
        font-size: 1.7rem;
        max-width: 320px;
    }

    :global(.cab h1 em) {
        font-style: normal;
        color: var(--gold-500);
    }

    :global(.btn-voltar) {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.12);
        color: var(--white);
    }

    :global(.busca) {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 14px 16px;
        margin-bottom: 20px;
        background: var(--card);
        border: 1px solid var(--card-borda);
        border-radius: 999px;
        color: var(--texto-suave);
        font-size: 0.95rem;
    }

    :global(.busca input) {
        flex: 1;
        min-width: 0;
        border: none;
        outline: none;
        background: transparent;
        font: inherit;
        color: var(--texto);
    }

    :global(.secao-topo) {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin: 4px 0 12px;
    }

    :global(.secao-topo h2) {
        font-size: 1.1rem;
    }

    :global(.secao-topo a),
    :global(.secao-topo button) {
        font-size: 0.85rem;
        color: var(--teal-700);
        font-weight: 600;
        background: none;
    }

    :global(.chips) {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
        margin-bottom: 16px;
        scrollbar-width: none;
    }

    :global(.chip) {
        flex: none;
        padding: 9px 16px;
        border-radius: 999px;
        background: var(--card);
        border: 1px solid var(--card-borda);
        color: var(--texto);
        font-size: 0.85rem;
        font-weight: 600;
    }

    :global(.chip.on) {
        background: var(--navy-900);
        border-color: var(--navy-900);
        color: var(--white);
    }
</style>
