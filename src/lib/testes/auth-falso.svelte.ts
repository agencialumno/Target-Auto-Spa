// Auth falso para testes de componente: os campos são $state (como no authStore real), então a tela
// reage quando um método muda `erro`. Só existe nos testes.
import { vi } from 'vitest';

export class AuthFalso {
  carregando = $state(false);
  usuario = $state<unknown>(null);
  perfil = $state<unknown>(null);
  erro = $state('');
  entrar = vi.fn();
  cadastrar = vi.fn();
  entrarComGoogle = vi.fn();
  entrarComApple = vi.fn();
  entrarNoCondominio = vi.fn();
  sair = vi.fn();
}
