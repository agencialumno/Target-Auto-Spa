// Tradução de erros de login (Firebase e plugin da Apple) para mensagens da tela.

// Erros do plugin chegam como texto (reject do Swift), não como { code }
export function erroApple(e: any): string {
  if (e?.code) return e.code;
  const msg = String(e?.message ?? e ?? '');
  // 1001 = ASAuthorizationError.canceled
  if (/1001|canceled|cancelled/i.test(msg)) return 'apple/cancelado';
  if (/not allowed|command .* not found|plugin/i.test(msg)) return 'apple/indisponivel';
  return 'apple/erro';
}

export function traduzErro(codigo?: string): string {
  const mapa: Record<string, string> = {
    'auth/email-already-in-use': 'Este e-mail já tem uma conta.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'apple/cancelado': 'Login cancelado.',
    'apple/indisponivel': 'Entrar com Apple só está disponível no app para iPhone.',
    'apple/sem-token': 'A Apple não devolveu a credencial. Tente novamente.',
    'google/cancelado': 'Login cancelado.',
    'google/indisponivel': 'Entrar com Google só está disponível no app para iPhone e Android.',
    'google/sem-token': 'O Google não devolveu a credencial. Tente novamente.',
    'google/nao-configurado': 'Login com Google ainda não configurado neste app.',
    'auth/account-exists-with-different-credential': 'Já existe uma conta com este e-mail por outro método de login.',
    'auth/network-request-failed': 'Sem conexão com o Firebase. Verifique a internet.'
  };
  if (codigo?.startsWith('timeout/')) {
    return `Tempo esgotado ao falar com o Firebase (${codigo}).`;
  }
  const texto = mapa[codigo ?? ''];
  if (texto) return texto;
  return `Não foi possível completar. Tente novamente. (${codigo ?? 'erro desconhecido'})`;
}

// No login com Apple "e-mail ou senha incorretos" não faz sentido: mostra a causa real e o código
export function mensagemErroApple(codigo: string): string {
  if (codigo === 'auth/invalid-credential') {
    return 'O Firebase recusou a credencial da Apple (auth/invalid-credential). Verifique o app iOS e o provedor Apple no Firebase.';
  }
  const base = traduzErro(codigo);
  const semCodigo = codigo === 'apple/cancelado' || base.includes(`(${codigo})`);
  return semCodigo ? base : `${base} (${codigo})`;
}

// Erros do plugin do Google chegam como texto (reject do Swift/Kotlin), não como { code }
export function erroGoogle(e: any): string {
  if (e?.code) return e.code;
  const msg = String(e?.message ?? e ?? '');
  // Android: "User cancelled"/"Sign-in cancelled"; iOS: ASWebAuthenticationSession error 1 (canceledLogin)
  if (/cancel/i.test(msg) || /WebAuthenticationSession error 1\b/.test(msg)) return 'google/cancelado';
  if (/not allowed|command .* not found|plugin/i.test(msg)) return 'google/indisponivel';
  return 'google/erro';
}

// Mostra a causa real e o código; "e-mail ou senha" não faz sentido no login social
export function mensagemErroGoogle(codigo: string): string {
  if (codigo === 'auth/invalid-credential') {
    return 'O Firebase recusou a credencial do Google (auth/invalid-credential). Verifique o provedor Google e os client IDs no Firebase.';
  }
  const base = traduzErro(codigo);
  const semCodigo = codigo === 'google/cancelado' || base.includes(`(${codigo})`);
  return semCodigo ? base : `${base} (${codigo})`;
}
