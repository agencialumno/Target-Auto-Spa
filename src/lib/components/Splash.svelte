<script lang="ts">
  import simbolo from '$lib/assets/simbolo.png';
</script>

<div class="splash">
  <div class="brilho"></div>
  <img class="simbolo" src={simbolo} alt="Target Auto Spa" />
  <div class="barra"><span></span></div>
</div>

<style>
  .splash {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, var(--navy-900) 0%, var(--navy-700) 100%);
  }

  .simbolo {
    position: relative;
    width: 128px;
    height: 128px;
    object-fit: contain;
    animation: entrada 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .brilho {
    position: absolute;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(217, 180, 90, 0.28) 0%,
      rgba(217, 180, 90, 0) 70%
    );
    animation: pulsar 2s ease-in-out infinite;
  }

  .barra {
    position: absolute;
    bottom: calc(56px + var(--safe-bottom));
    width: 96px;
    height: 3px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .barra span {
    display: block;
    height: 100%;
    width: 100%;
    background: var(--gold-500);
    transform-origin: left;
    animation: carregar 2s ease-out both;
  }

  @keyframes entrada {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes pulsar {
    0%,
    100% {
      transform: scale(0.9);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.1);
      opacity: 1;
    }
  }

  @keyframes carregar {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }
</style>