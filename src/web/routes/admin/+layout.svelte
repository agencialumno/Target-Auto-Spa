<script lang="ts">
  import Entrada from "../../Entrada.svelte";
  import Shell from "../../Shell.svelte";
  let { children } = $props();
</script>

<Entrada>
  <Shell>
    {@render children()}
  </Shell>
</Entrada>
