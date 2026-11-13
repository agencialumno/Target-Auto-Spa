<script lang="ts">
  import Entrada from '../../Entrada.svelte';
  let { children } = $props();
</script>

<Entrada>
  {@render children()}
</Entrada>
