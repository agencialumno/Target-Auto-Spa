<script lang="ts">
  import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
  import { db } from '$lib/firebase';
  import { chamarApi } from '$lib/api';
  import { brlCentavos, lerAgendamento, rotuloStatus, type Agendamento } from '$lib/agendamentos';
  import { resumoCliente, resumoFuncionario, type ResumoCliente, type ResumoFuncionario } from '$lib/usuario-resumo';

  type Usuario = {
    uid: string;
    nome: string;
    email: string;
    role: string;
    condominioId: string | null;
    especialidade?: string | null;
  };

  let {
    usuario,
    papel,
    condominio,
    onfechar
  }: { usuario: Usuario; papel: string; condominio: string; onfechar: () => void } = $props();

  let carregando = $state(true);
  let erro = $state('');
  let cadastro = $state<string | null>(null);
  let acesso = $state<string | null>(null);
  let cliente = $state<ResumoCliente | null>(null);
  let funcionario = $state<ResumoFuncionario | null>(null);

  const data = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem registro';

  // Consultas que já têm índice: agendamentos por (clienteId, inicio desc) e (funcionarioId, inicio asc)
  async function agendamentosDe(campo: 'clienteId' | 'funcionarioId') {
    const q = query(
      collection(db, 'agendamentos'),
      where(campo, '==', usuario.uid),
      orderBy('inicio', campo === 'clienteId' ? 'desc' : 'asc'),
      limit(500)
    );
    return (await getDocs(q)).docs.map((d) => lerAgendamento(d.id, d.data()) as Agendamento);
  }

  $effect(() => {
    let vivo = true;
    (async () => {
      carregando = true;
      erro = '';
      try {
        const [datas, ags] = await Promise.all([
          chamarApi('detalhe', { uid: usuario.uid }).catch(() => null),
          usuario.role === 'cliente'
            ? agendamentosDe('clienteId')
            : usuario.role === 'funcionario'
              ? agendamentosDe('funcionarioId')
              : Promise.resolve([] as Agendamento[])
        ]);
        if (!vivo) return;
        cadastro = datas?.criadoEm ?? null;
        acesso = datas?.ultimoAcesso ?? null;
        if (usuario.role === 'cliente') cliente = resumoCliente(ags);
        if (usuario.role === 'funcionario') funcionario = resumoFuncionario(ags);
      } catch {
        if (vivo) erro = 'Não foi possível carregar o resumo deste usuário.';
      } finally {
        if (vivo) carregando = false;
      }
    })();
    return () => (vivo = false);
  });
</script>

<div class="camada" role="dialog" aria-modal="true" aria-label="Detalhes do usuário">
  <div class="caixa">
    <h2>{usuario.nome || '(sem nome)'}</h2>
    <dl>
      <dt>E-mail</dt><dd>{usuario.email}</dd>
      <dt>Papel</dt><dd>{papel}{#if usuario.especialidade === 'insulfilm'} · Insulfilm{/if}</dd>
      <dt>Condomínio</dt><dd>{condominio || 'Sem condomínio'}</dd>
      <dt>Cadastro</dt><dd>{carregando ? '...' : data(cadastro)}</dd>
      <dt>Último acesso</dt><dd>{carregando ? '...' : data(acesso)}</dd>
    </dl>

    {#if erro}<p class="erro" role="alert">{erro}</p>{/if}

    {#if cliente}
      <h3>Agendamentos ({cliente.total})</h3>
      <ul>
        {#each Object.entries(cliente.porStatus) as [st, n]}
          <li>{rotuloStatus[st as keyof typeof rotuloStatus]}: <b>{n}</b></li>
        {/each}
      </ul>
      <dl>
        <dt>Total gasto (pagos)</dt><dd>{brlCentavos(cliente.pagoCentavos)}</dd>
        <dt>Nível</dt><dd>{cliente.nivel}</dd>
        <dt>Avaliações dadas</dt>
        <dd>{cliente.avaliacoes.quantidade}{#if cliente.avaliacoes.media !== null} · média {cliente.avaliacoes.media}{/if}</dd>
      </dl>
      <h3>Serviços mais usados</h3>
      {#if cliente.maisUsados.length}
        <ul>{#each cliente.maisUsados as s}<li>{s.nome}: <b>{s.vezes}</b></li>{/each}</ul>
      {:else}
        <p class="aviso">Nenhum serviço ainda.</p>
      {/if}
    {/if}

    {#if funcionario}
      <h3>Atendimentos</h3>
      <dl>
        <dt>Finalizados</dt><dd>{funcionario.finalizados}</dd>
        <dt>Em andamento</dt><dd>{funcionario.emAndamento}</dd>
      </dl>
    {/if}

    <button class="btn-secundario" type="button" onclick={onfechar}>Fechar</button>
  </div>
</div>

<style>
  .camada {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.45);
  }

  .caixa {
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    border-radius: 16px;
    background: var(--white);
  }

  h3 {
    margin-top: 6px;
    font-size: 0.95rem;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
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

  ul {
    margin: 0;
    padding-left: 18px;
    font-size: 0.88rem;
  }

  .erro {
    color: var(--erro);
    font-size: 0.85rem;
  }

  .aviso {
    font-size: 0.85rem;
    color: var(--texto-suave);
  }
</style>
