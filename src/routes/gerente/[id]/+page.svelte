<script lang="ts">
  import { page } from '$app/state';
  import DetalheOperacao from '$lib/components/DetalheOperacao.svelte';
</script>

<DetalheOperacao id={page.params.id ?? ''} voltar="/gerente" editavel />