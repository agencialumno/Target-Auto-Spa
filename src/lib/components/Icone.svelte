<script lang="ts">
  let { nome, tamanho = 22 }: { nome: string; tamanho?: number } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={tamanho}
  height={tamanho}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if nome === 'home'}
    <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  {:else if nome === 'grid'}
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  {:else if nome === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if nome === 'calendar'}
    <rect x="3.5" y="5" width="17" height="16" rx="3" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
  {:else if nome === 'user'}
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  {:else if nome === 'search'}
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  {:else if nome === 'clock'}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  {:else if nome === 'shield'}
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
  {:else if nome === 'leaf'}
    <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" />
    <path d="M5 19c3-5 6-8 10-10" />
  {:else if nome === 'check'}
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  {:else if nome === 'play'}
    <path d="M8 5l11 7-11 7z" />
  {:else if nome === 'chevron'}
    <path d="M9 6l6 6-6 6" />
  {:else if nome === 'back'}
    <path d="M15 6l-6 6 6 6" />
  {:else if nome === 'drop'}
    <path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" />
  {:else if nome === 'sparkle'}
    <path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z" />
  {:else if nome === 'car'}
    <path d="M5 16V12l2-5h10l2 5v4M3 16h18v3H3zM7 12h10" />
  {:else if nome === 'layers'}
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  {:else if nome === 'pin'}
    <path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  {:else if nome === 'star'}
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
  {:else if nome === 'chat'}
    <path d="M4 5h16v11H9l-5 4z" />
  {:else if nome === 'camera'}
    <path d="M4 8h3l2-3h6l2 3h3v12H4z" />
    <circle cx="12" cy="13.5" r="3.5" />
  {:else if nome === 'crown'}
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
  {:else if nome === 'send'}
    <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />
  {:else if nome === 'bell'}
    <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" />
    <path d="M10 21h4" />
  {:else if nome === 'logout'}
    <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
    <path d="M16 8l4 4-4 4M20 12H9" />
  {/if}
</svg>