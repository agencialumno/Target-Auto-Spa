<script lang="ts">
    import { goto } from "$app/navigation";
    import logo from "$lib/assets/logo.png";
    import { authStore } from "$lib/auth.svelte";
    import PainelDepuracao from "$lib/components/PainelDepuracao.svelte";
    import Icone from "$lib/components/Icone.svelte";

    type Modo = "entrar" | "cadastrar";
    let modo: Modo = $state("entrar");

    let nome = $state("");
    let email = $state("");
    let senha = $state("");

    // Critérios da senha forte (só exigidos no cadastro)
    const criterios = $derived([
        { texto: "Mínimo 8 caracteres", ok: senha.length >= 8 },
        { texto: "Pelo menos 1 letra maiúscula", ok: /[A-Z]/.test(senha) },
        { texto: "Pelo menos 1 letra minúscula", ok: /[a-z]/.test(senha) },
        { texto: "Pelo menos 1 número", ok: /[0-9]/.test(senha) },
        {
            texto: "Pelo menos 1 caractere especial (!@#$%^&*)",
            ok: /[^A-Za-z0-9]/.test(senha),
        },
    ]);
    const senhaForte = $derived(criterios.every((c) => c.ok));
    let carregando = $state(false);
    let mostrarSucesso = $state(false);

    // Enquanto o modal de sucesso está aberto, o redirecionamento automático espera
    $effect(() => {
        if (mostrarSucesso) return;
        if (authStore.carregando || !authStore.usuario || !authStore.perfil)
            return;
        const p = authStore.perfil;
        if (p.role === "cliente") {
            goto(p.condominioId ? "/cliente" : "/entrar-condominio");
        } else if (p.role === "gerente") {
            goto("/gerente");
        } else if (p.role === "admin") {
            goto("/admin");
        } else if (p.role === "insulfilm") {
            goto("/insulfilm");
        }
    });

    async function enviar() {
        if (modo === "cadastrar" && !senhaForte) return;
        carregando = true;
        try {
            if (modo === "cadastrar") {
                await authStore.cadastrar(nome, email, senha);
                mostrarSucesso = true;
            } else {
                await authStore.entrar(email, senha);
            }
        } catch {
            // erro já fica em authStore.erro
        } finally {
            carregando = false;
        }
    }

    function fecharSucesso() {
        mostrarSucesso = false;
    }

    async function comGoogle() {
        carregando = true;
        try {
            await authStore.entrarComGoogle();
        } catch {
            //
        } finally {
            carregando = false;
        }
    }

    async function comApple() {
        carregando = true;
        try {
            await authStore.entrarComApple();
        } catch {
            //
        } finally {
            carregando = false;
        }
    }
</script>

<main class="tela">
    <section class="cabecalho">
        {#if modo === "cadastrar"}
            <button
                type="button"
                class="btn-voltar voltar-login"
                aria-label="Voltar para entrar"
                onclick={() => (modo = "entrar")}
            >
                <Icone nome="back" />
            </button>
        {/if}
        <img class="logo" src={logo} alt="Grupo Target Auto Spa" />
        <h1>
            O cuidado que seu carro merece,
            <span class="destaque">a poucos passos da sua porta.</span>
        </h1>
    </section>

    <section class="folha">
        <div class="folha-alca"></div>

        <div class="abas">
            <button
                class="aba"
                class:on={modo === "entrar"}
                onclick={() => (modo = "entrar")}
            >
                Entrar
            </button>
            <button
                class="aba"
                class:on={modo === "cadastrar"}
                onclick={() => (modo = "cadastrar")}
            >
                Criar conta
            </button>
        </div>

        <form class="form" onsubmit={(e) => (e.preventDefault(), enviar())}>
            {#if modo === "cadastrar"}
                <label class="campo">
                    <span>Nome</span>
                    <input
                        type="text"
                        bind:value={nome}
                        required
                        placeholder="Seu nome"
                    />
                </label>
            {/if}

            <label class="campo">
                <span>E-mail</span>
                <input
                    type="email"
                    bind:value={email}
                    required
                    placeholder="voce@exemplo.com"
                />
            </label>

            <label class="campo">
                <span>Senha</span>
                <input
                    type="password"
                    bind:value={senha}
                    required
                    minlength={modo === "cadastrar" ? 8 : 6}
                    placeholder="••••••••"
                />
            </label>

            {#if modo === "cadastrar"}
                <ul class="criterios" aria-label="Requisitos da senha">
                    {#each criterios as c}
                        <li class:ok={c.ok}>
                            <span class="marca" aria-hidden="true">
                                {#if c.ok}<Icone nome="check" tamanho={12} />{/if}
                            </span>
                            <span>{c.texto}</span>
                            <span class="so-leitor"
                                >{c.ok ? "atendido" : "pendente"}</span
                            >
                        </li>
                    {/each}
                </ul>
            {/if}

            {#if authStore.erro}
                <p class="erro">{authStore.erro}</p>
            {/if}

            <button
                class="btn-primario"
                type="submit"
                disabled={carregando || (modo === "cadastrar" && !senhaForte)}
            >
                {carregando
                    ? "Aguarde..."
                    : modo === "cadastrar"
                      ? "Criar conta"
                      : "Entrar"}
            </button>
        </form>

        <div class="separador"><span>ou continue com</span></div>

        <div class="sociais">
            <button
                class="btn-secundario"
                onclick={comGoogle}
                disabled
                title="Em breve">Google</button
            >
            <button
                class="btn-secundario"
                onclick={comApple}
                disabled
                title="Em breve">Apple</button
            >
        </div>
    </section>
</main>

<PainelDepuracao />

{#if mostrarSucesso}
    <div class="modal-camada">
        <div class="modal-caixa">
            <span class="modal-icone"><span class="check">✓</span></span>
            <h2>Cadastro realizado com sucesso</h2>
            <p>
                Sua conta foi criada. Agora vamos vincular você ao seu
                condomínio.
            </p>
            <button class="btn-primario" onclick={fecharSucesso}>OK</button>
        </div>
    </div>
{/if}

<style>
    .tela {
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

    .cabecalho {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        position: relative;
        padding: calc(28px + var(--safe-top)) 20px 20px;
    }

    .logo {
        width: min(60%, 220px);
        height: auto;
        margin-bottom: 20px;
    }

    .cabecalho h1 {
        max-width: 340px;
        font-size: 1.2rem;
        line-height: 1.25;
        color: var(--white);
    }

    .destaque {
        color: var(--gold-500);
    }

    .folha {
        flex: 1;
    }

    .abas {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
        padding: 4px;
        background: var(--card);
        border-radius: 999px;
    }

    .aba {
        flex: 1;
        padding: 10px 0;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.9rem;
        color: var(--texto-suave);
        background: transparent;
    }

    .aba.on {
        background: var(--navy-900);
        color: var(--white);
    }

    .form {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .campo {
        display: flex;
        flex-direction: column;
        gap: 6px;
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
        font-size: 0.85rem;
        color: var(--erro);
    }

    .voltar-login {
        position: absolute;
        top: calc(12px + var(--safe-top));
        left: 16px;
    }

    .criterios {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 14px;
        background: var(--card);
        border: 1px solid var(--card-borda);
        border-left: 3px solid var(--gold-500);
        border-radius: var(--raio);
        font-size: 0.82rem;
        color: var(--texto-suave);
    }

    .criterios li {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .criterios li.ok {
        color: var(--ok-texto);
        font-weight: 600;
    }

    .marca {
        flex: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        border: 1.5px solid var(--card-borda);
        background: var(--white);
    }

    .criterios li.ok .marca {
        background: var(--ok-texto);
        border-color: var(--ok-texto);
        color: var(--white);
    }

    .so-leitor {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
    }

    .separador {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 20px 0 14px;
        color: var(--texto-suave);
        font-size: 0.8rem;
    }

    .separador::before,
    .separador::after {
        content: "";
        flex: 1;
        height: 1px;
        background: var(--card-borda);
    }

    .sociais {
        display: flex;
        gap: 10px;
    }

    .modal-camada {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: var(--veu);
    }

    .modal-caixa {
        width: 100%;
        max-width: 340px;
        padding: 28px 24px 24px;
        border-radius: var(--raio-grande);
        background: var(--white);
        color: var(--texto);
        text-align: center;
    }

    .modal-icone {
        display: inline-flex;
        width: 56px;
        height: 56px;
        margin-bottom: 16px;
        border-radius: 50%;
        align-items: center;
        justify-content: center;
        background: var(--ok-fundo);
    }

    .check {
        color: var(--ok-texto);
        font-size: 1.6rem;
        font-weight: 700;
    }

    .modal-caixa h2 {
        font-size: 1.1rem;
        margin-bottom: 8px;
    }

    .modal-caixa p {
        font-size: 0.88rem;
        color: var(--texto-suave);
        margin-bottom: 20px;
    }
</style>
