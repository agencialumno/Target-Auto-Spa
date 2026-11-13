<script lang="ts">
  import Tabela from '../Tabela.svelte';
  import type { Coluna } from '$lib/web/tabela';
  import { descreverErro, listarCondominios, listarUsuarios } from '$lib/web/consultas';
  import { filtrarUsuarios, type UsuarioLinha } from '$lib/web/tabela';

  const PAPEIS: Record<string, string> = { cliente: 'Cliente', gerente: 'Gerente', funcionario: 'Funcionário', admin: 'Administrador' };

  let usuarios = $state<UsuarioLinha[]>([]);
  let condominios = $state<{ id: string; nome: string }[]>([]);
  let carregando = $state(true);
  let erro = $state('');
  let aviso = $state('');
  let busca = $state('');
  let papel = $state('');
  let condominio = $state('');

  const nomeCond = (id: string | null) => (id ? (condominios.find((c) => c.id === id)?.nome ?? id) : '—');
  const lista = $derived(filtrarUsuarios(usuarios, { busca, papel, condominio }));

  const colunas: Coluna<UsuarioLinha>[] = [
    { id: 'nome', titulo: 'Nome', texto: (u) => u.nome || '(sem nome)', chave: (u) => u.nome, link: (u) => `/admin/usuarios/${u.uid}` },
    { id: 'email', titulo: 'E-mail', texto: (u) => u.email, chave: (u) => u.email },
    { id: 'role', titulo: 'Papel', texto: (u) => PAPEIS[u.role] ?? u.role, chave: (u) => u.role },
    { id: 'cond', titulo: 'Condomínio', texto: (u) => nomeCond(u.condominioId), chave: (u) => nomeCond(u.condominioId) }
  ];

  async function carregar() {
    carregando = true;
    erro = '';
    aviso = '';
    try {
      const [u, c] = await Promise.all([listarUsuarios(), listarCondominios().catch(() => [])]);
      usuarios = u.itens;
      condominios = c;
      if (u.cortado) aviso = 'Lista cortada no limite de usuários; refine pela busca.';
    } catch (e) {
      erro = descreverErro(e, 'os usuários');
    } finally {
      carregando = false;
    }
  }
  $effect(() => {
    carregar();
  });
</script>

<h1>Usuários</h1>
<div class="filtros">
  <label>Busca <input type="search" bind:value={busca} placeholder="Nome ou e-mail" /></label>
  <label>
    Papel
    <select bind:value={papel}>
      <option value="">Todos</option>
      {#each Object.entries(PAPEIS) as [id, nome]}<option value={id}>{nome}</option>{/each}
    </select>
  </label>
  <label>
    Condomínio
    <select bind:value={condominio}>
      <option value="">Todos</option>
      {#each condominios as c (c.id)}<option value={c.id}>{c.nome}</option>{/each}
    </select>
  </label>
</div>
{#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}
<Tabela {colunas} linhas={lista} {carregando} {erro} aoTentarDeNovo={carregar} vazio="Nenhum usuário com estes filtros." legenda="Usuários" />

<style>
  h1 { margin: 0 0 16px; font-size: 1.5rem; }
  .filtros { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 16px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #445; }
  input, select { min-height: 36px; padding: 0 10px; font: inherit; border: 1px solid #c3c9d3; border-radius: 8px; background: #fff; }
  .aviso { color: #7a5b00; }
</style>
