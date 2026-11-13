<script lang="ts">
  import { goto } from '$app/navigation';

  // O dashboard agora é a página inicial do admin
  $effect(() => {
    goto('/admin', { replaceState: true });
  });
</script>

<p style="padding: 24px">Abrindo o painel... <a href="/admin">Ir para o painel</a></p>
