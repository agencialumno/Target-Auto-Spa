<script lang="ts">
  import { page } from '$app/state';
  import type { DocumentSnapshot } from 'firebase/firestore';
  import TelaAdmin from '$lib/components/TelaAdmin.svelte';
  import { chamarApi } from '$lib/api';
  import { brlCentavos, nomesItens, rotuloPagamento, rotuloStatus, situacaoPagamento, type Agendamento } from '$lib/agendamentos';
  import { dataCurta } from '$lib/formato';
  import { resumoCliente, resumoFuncionario } from '$lib/usuario-resumo';
  import {
    avaliacoesDe,
    emAbertoPrimeiro,
    filtrarAgendamentos,
    pagamentosDe,
    rotuloFiltro,
    type FiltroAgendamentos
  } from '$lib/usuario-detalhe';
  import {
    POR_PAGINA,
    campoDoPapel,
    carregarPagina,
    carregarPerfil,
    contarAgendamentos,
    nomeDoCondominio,
    type PerfilAdmin
  } from '$lib/usuario-dados';

  const uid = $derived(page.params.uid ?? '');
  const papeis: Record<string, string> = { cliente: 'Cliente', gerente: 'Gerente', funcionario: 'Funcionário', admin: 'Administrador' };

  let perfil = $state<PerfilAdmin | null>(null);
  let condominio = $state('');
  let cadastro = $state<Date | null>(null);
  let acesso = $state<Date | null>(null);
  let avisoDatas = $state('');
  let carregandoPerfil = $state(true);
  let erroPerfil = $state('');

  let ags = $state<Agendamento[]>([]);
  let cursor: DocumentSnapshot | null = null;
  let temMais = $state(false);
  let total = $state<number | null>(null);
  let carregandoLista = $state(false);
  let carregouLista = $state(false);
  let erroLista = $state('');

  let secao = $state<'agendamentos' | 'pagamentos' | 'avaliacoes'>('agendamentos');
  let filtro = $state<FiltroAgendamentos>('todos');

  const campo = $derived(perfil ? campoDoPapel(perfil.role) : null);
  const ehFuncionario = $derived(perfil?.role === 'funcionario');

  async function abrirPerfil() {
    carregandoPerfil = true;
    erroPerfil = '';
    avisoDatas = '';
    try {
      const p = await carregarPerfil(uid);
      if (!p) {
        erroPerfil = 'Usuário não encontrado (talvez tenha sido removido).';
        return;
      }
      perfil = p;
      nomeDoCondominio(p.condominioId)
        .then((n) => (condominio = n))
        .catch(() => (condominio = p.condominioId ?? ''));
      chamarApi('detalhe', { uid })
        .then((r) => {
          cadastro = r.criadoEm ? new Date(r.criadoEm) : null;
          acesso = r.ultimoAcesso ? new Date(r.ultimoAcesso) : null;
        })
        .catch((e) => (avisoDatas = (e as Error)?.message || 'Não foi possível consultar cadastro e último acesso.'));
      if (campoDoPapel(p.role)) await carregarMais(true);
    } catch {
      erroPerfil = 'Não foi possível carregar este usuário. Verifique a internet e tente de novo.';
    } finally {
      carregandoPerfil = false;
    }
  }

  async function carregarMais(primeira = false) {
    const c = campo ?? (perfil ? campoDoPapel(perfil.role) : null);
    if (!c || carregandoLista) return;
    carregandoLista = true;
    erroLista = '';
    try {
      const pg = await carregarPagina(c, uid, primeira ? null : cursor);
      ags = primeira ? pg.itens : [...ags, ...pg.itens];
      cursor = pg.cursor;
      temMais = pg.temMais;
      carregouLista = true;
      if (primeira) contarAgendamentos(c, uid).then((n) => (total = n)).catch(() => (total = null));
    } catch (e) {
      const codigo = (e as { code?: string })?.code;
      erroLista =
        codigo === 'failed-precondition'
          ? 'Falta um índice do Firestore para esta lista. O link para criá-lo aparece no console do navegador.'
          : 'Não foi possível carregar os agendamentos. Toque em "Tentar de novo".';
    } finally {
      carregandoLista = false;
    }
  }

  // Resumo de TODOS os agendamentos: carrega as páginas que faltam
  async function carregarTudo() {
    while (temMais && !erroLista) await carregarMais();
  }

  $effect(() => {
    uid;
    abrirPerfil();
  });

  const lista = $derived(filtro === 'todos' ? emAbertoPrimeiro(ags) : filtrarAgendamentos(ags, filtro));
  const resumo = $derived(perfil?.role === 'cliente' ? resumoCliente(ags) : null);
  const func = $derived(ehFuncionario ? resumoFuncionario(ags) : null);
  const pagamentos = $derived(pagamentosDe(ags));
  const avaliacoes = $derived(avaliacoesDe(ags));
  const parcial = $derived(temMais);

  const data = (d: Date | null) => (d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem registro');
  const dia = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR') : '—');
  const link = (id: string) => `/admin/usuarios/${uid}/agendamento/${id}`;
</script>

<TelaAdmin titulo="Usuário" sub="Dados, agendamentos e histórico">
  {#if carregandoPerfil}
    <p class="aviso">Carregando...</p>
  {:else if erroPerfil}
    <p class="erro" role="alert">{erroPerfil}</p>
    <button class="btn-secundario" onclick={abrirPerfil}>Tentar de novo</button>
  {:else if perfil}
    <section class="card ident">
      <h2>{perfil.nome || '(sem nome)'}</h2>
      <dl>
        <dt>E-mail</dt><dd>{perfil.email}</dd>
        <dt>Papel</dt><dd>{papeis[perfil.role] ?? perfil.role}{#if perfil.especialidade === 'insulfilm'} · Insulfilm{/if}</dd>
        <dt>Condomínio</dt><dd>{condominio || (perfil.condominioId ? '...' : 'Sem condomínio')}</dd>
        <dt>Cadastro</dt><dd>{data(cadastro)}</dd>
        <dt>Último acesso</dt><dd>{data(acesso)}</dd>
      </dl>
      {#if avisoDatas}<p class="erro" role="alert">{avisoDatas}</p>{/if}
    </section>

    {#if campo}
      {#if resumo}
        <section class="grade" aria-label="Resumo">
          <div class="kpi card"><small>Total gasto (pagos)</small><strong>{brlCentavos(resumo.pagoCentavos)}</strong></div>
          <div class="kpi card"><small>Nível</small><strong>{resumo.nivel}</strong></div>
          <div class="kpi card">
            <small>Avaliações dadas</small>
            <strong>{resumo.avaliacoes.quantidade}</strong>
            <small>{resumo.avaliacoes.media !== null ? `média ${resumo.avaliacoes.media}` : 'sem avaliações'}</small>
          </div>
        </section>
      {:else if func}
        <section class="grade" aria-label="Resumo">
          <div class="kpi card"><small>Finalizados</small><strong>{func.finalizados}</strong></div>
          <div class="kpi card"><small>Em andamento</small><strong>{func.emAndamento}</strong></div>
        </section>
      {/if}

      {#if carregouLista && parcial}
        <p class="peq" role="status">
          Resumo parcial: {ags.length}{total !== null ? ` de ${total}` : ''} agendamentos carregados.
          <button class="link" onclick={carregarTudo} disabled={carregandoLista}>Carregar tudo para o resumo completo</button>
        </p>
      {/if}

      <nav class="abas" aria-label="Seções">
        <button class:ativa={secao === 'agendamentos'} onclick={() => (secao = 'agendamentos')}>{ehFuncionario ? 'Atendimentos' : 'Agendamentos'}</button>
        {#if !ehFuncionario}
          <button class:ativa={secao === 'pagamentos'} onclick={() => (secao = 'pagamentos')}>Pagamentos</button>
          <button class:ativa={secao === 'avaliacoes'} onclick={() => (secao = 'avaliacoes')}>Avaliações</button>
        {/if}
      </nav>

      {#if erroLista}
        <p class="erro" role="alert">{erroLista}</p>
        <button class="btn-secundario" onclick={() => carregarMais(!carregouLista)}>Tentar de novo</button>
      {/if}

      {#if !carregouLista && carregandoLista}
        <p class="aviso">Carregando...</p>
      {:else if carregouLista}
        {#if secao === 'agendamentos'}
          <div class="filtros" role="group" aria-label="Filtro">
            {#each Object.entries(rotuloFiltro) as [id, nome]}
              <button class:ativa={filtro === id} onclick={() => (filtro = id as FiltroAgendamentos)}>{nome}</button>
            {/each}
          </div>
          {#if lista.length === 0}
            <p class="aviso">{ags.length === 0 ? 'Nenhum agendamento ainda.' : 'Nenhum agendamento neste filtro (entre os carregados).'}</p>
          {:else}
            <ul class="lista">
              {#each lista as a (a.id)}
                <li>
                  <a class="item card" class:destaque={a.status === 'agendado' || a.status === 'em_andamento'} href={link(a.id)}>
                    <strong>{nomesItens(a.itens) || '(sem itens)'}</strong>
                    <small>{dataCurta(a.data)} às {a.hora}{#if ehFuncionario} · {a.clienteNome}{/if}</small>
                    <span class="rodape"><span class={`selo ${a.status}`}>{rotuloStatus[a.status]}</span><b>{brlCentavos(a.total)}</b></span>
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        {:else if secao === 'pagamentos'}
          {#if pagamentos.length === 0}
            <p class="aviso">Nenhum pagamento entre os agendamentos carregados.</p>
          {:else}
            <ul class="lista">
              {#each pagamentos as p (p.agendamentoId)}
                <li>
                  <a class="item card" href={link(p.agendamentoId)}>
                    <strong>{brlCentavos(p.valorCentavos)}</strong>
                    <small>{p.servicos}</small>
                    <span class="rodape">
                      <span class={`selo pg-${p.status}`}>{rotuloPagamento[situacaoPagamento({ status: 'agendado', pagamento: { status: p.status as any, venceEm: null, revisao: false } })]}</span>
                      <small>{p.pagoEm ? `Pago em ${dia(p.pagoEm)}` : 'Sem data de pagamento'}</small>
                    </span>
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
          {#if avaliacoes.length === 0}
            <p class="aviso">Nenhuma avaliação entre os agendamentos carregados.</p>
          {:else}
            <ul class="lista">
              {#each avaliacoes as v (v.agendamentoId)}
                <li class="card item">
                  <strong>{'★'.repeat(v.nota)}{'☆'.repeat(Math.max(0, 5 - v.nota))} <span class="peq">({v.nota}/5)</span></strong>
                  <small>{v.servicos} · {dia(v.em)}{v.nps !== null ? ` · indicação ${v.nps}/10` : ''}</small>
                  <p>{v.comentario || 'Sem comentário.'}</p>
                  <a href={link(v.agendamentoId)}>Ver agendamento</a>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}

        {#if temMais}
          <button class="btn-secundario mais" onclick={() => carregarMais()} disabled={carregandoLista}>
            {carregandoLista ? 'Carregando...' : `Carregar mais (${POR_PAGINA})`}
          </button>
        {/if}
      {/if}
    {:else}
      <p class="peq">Para {papeis[perfil.role]?.toLowerCase() ?? 'este papel'} só a identidade é exibida.</p>
    {/if}
  {/if}
</TelaAdmin>

<style>
  h2 {
    margin: 0 0 8px;
    font-size: 1.1rem;
  }

  .ident {
    padding: 14px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: 0.88rem;
  }

  dt {
    color: var(--texto-suave);
  }

  dd {
    margin: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .grade {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 12px 0;
  }

  .kpi {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
  }

  .kpi strong {
    font-size: 1.2rem;
  }

  small,
  .peq {
    color: var(--texto-suave);
    font-size: 0.78rem;
  }

  .abas,
  .filtros {
    display: flex;
    gap: 6px;
    margin: 12px 0 8px;
    overflow-x: auto;
  }

  .abas button,
  .filtros button {
    flex: none;
    min-height: 40px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--card-borda);
    background: var(--card);
    color: var(--texto);
    font: inherit;
    font-size: 0.85rem;
  }

  .abas button.ativa,
  .filtros button.ativa {
    background: var(--navy-900);
    color: var(--white);
    border-color: var(--navy-900);
  }

  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 12px 14px;
    color: var(--texto);
    min-height: 44px;
  }

  .item.destaque {
    border-left: 4px solid var(--gold-500);
  }

  .item p {
    margin: 4px 0 0;
    font-size: 0.88rem;
    overflow-wrap: anywhere;
  }

  .rodape {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
  }

  .selo {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--info-fundo);
    color: var(--teal-700);
  }

  .selo.em_andamento,
  .selo.pg-pendente {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
  }

  .selo.finalizado,
  .selo.pg-pago {
    background: var(--ok-fundo);
    color: var(--ok-texto);
  }

  .selo.cancelado,
  .selo.pg-expirado,
  .selo.pg-cancelado {
    background: #fdecea;
    color: #b3261e;
  }

  .erro {
    color: var(--erro);
    font-size: 0.85rem;
  }

  .aviso {
    text-align: center;
    color: var(--texto-suave);
    padding: 16px 0;
  }

  .mais {
    width: 100%;
    margin-top: 12px;
  }

  .link {
    background: none;
    border: none;
    padding: 0;
    color: var(--teal-700);
    text-decoration: underline;
    font: inherit;
  }
</style>
