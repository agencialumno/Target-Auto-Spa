<script lang="ts">
    import { goto } from "$app/navigation";
    import Icone from "$lib/components/Icone.svelte";
    import { authStore } from "$lib/auth.svelte";

    let nome = $state("");
    let carregando = $state(false);
    let erro = $state("");

    async function confirmar() {
        if (!nome.trim()) return;
        carregando = true;
        erro = "";
        try {
            const resultado = await authStore.entrarNoCondominio(nome);
            if (resultado === "ok") {
                goto("/cliente");
            } else {
                erro =
                    "Condomínio não encontrado. Confira o nome ou fale com a administração.";
            }
        } finally {
            carregando = false;
        }
    }
</script>

<div class="pagina">
    <header class="cab">
        <h1>Qual é o seu <em>condomínio?</em></h1>
        <p>Assim conseguimos direcionar o atendimento certo até você.</p>
    </header>

    <section class="folha">
        <div class="folha-alca"></div>

        <label class="campo">
            <span>Nome do condomínio</span>
            <input
                type="text"
                bind:value={nome}
                placeholder="Ex: Residencial Exemplo"
            />
        </label>

        {#if erro}<p class="erro">{erro}</p>{/if}

        <button
            class="btn-primario"
            disabled={carregando || !nome.trim()}
            onclick={confirmar}
        >
            {carregando ? "Buscando..." : "Confirmar"}
        </button>
    </section>
</div>

<style>
    .cab p {
        margin-top: 6px;
        color: var(--silver);
        font-size: 0.9rem;
    }

    .campo {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 14px;
    }

    .campo span {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--texto-suave);
    }

    .campo input {
        padding: 13px 14px;
        border-radius: var(--raio);
        border: 1px solid var(--card-borda);
        background: var(--card);
        font: inherit;
        color: var(--texto);
        outline: none;
    }

    .erro {
        margin-bottom: 12px;
        font-size: 0.85rem;
        color: #b3261e;
    }
</style>
