<script lang="ts">
  // A raiz da web é o /admin (no servidor há o mesmo redirecionamento)
  import { goto } from '$app/navigation';

  $effect(() => {
    goto('/admin', { replaceState: true });
  });
</script>
