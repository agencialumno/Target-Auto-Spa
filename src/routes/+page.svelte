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
                class="btn-secundario social"
                onclick={comGoogle}
                disabled
                title="Em breve"
            >
                <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
                    <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                </svg>
                Google
            </button>
            <button
                class="btn-secundario social"
                onclick={comApple}
                disabled={carregando}
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path
                        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                    />
                </svg>
                Apple
            </button>
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

    .social {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

    .social:disabled {
        opacity: 0.55;
        cursor: not-allowed;
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
