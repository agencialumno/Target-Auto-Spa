<script lang="ts">
  import GuardaPapel from '$lib/components/GuardaPapel.svelte';

  let { children } = $props();
</script>

<GuardaPapel papel="admin">
  {@render children()}
</GuardaPapel>
