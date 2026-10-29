import { describe, it, expect } from 'vitest';
import { erroApple, erroGoogle, mensagemErroApple, mensagemErroGoogle, traduzErro } from './auth-erros';
import { resumoToken } from './jwt';

describe('traduzErro', () => {
  const casos: [string, string][] = [
    ['auth/email-already-in-use', 'Este e-mail já tem uma conta.'],
    ['auth/invalid-email', 'E-mail inválido.'],
    ['auth/weak-password', 'A senha precisa ter pelo menos 6 caracteres.'],
    ['auth/user-not-found', 'E-mail ou senha incorretos.'],
    ['auth/wrong-password', 'E-mail ou senha incorretos.'],
    ['auth/invalid-credential', 'E-mail ou senha incorretos.'],
    ['auth/popup-closed-by-user', 'Login cancelado.'],
    ['apple/cancelado', 'Login cancelado.'],
    ['apple/indisponivel', 'Entrar com Apple só está disponível no app para iPhone.'],
    ['apple/sem-token', 'A Apple não devolveu a credencial. Tente novamente.'],
    ['google/cancelado', 'Login cancelado.'],
    ['google/indisponivel', 'Entrar com Google só está disponível no app para iPhone e Android.'],
    ['google/sem-token', 'O Google não devolveu a credencial. Tente novamente.'],
    ['google/nao-configurado', 'Login com Google ainda não configurado neste app.'],
    ['auth/account-exists-with-different-credential', 'Já existe uma conta com este e-mail por outro método de login.'],
    ['auth/network-request-failed', 'Sem conexão com o Firebase. Verifique a internet.']
  ];

  it.each(casos)('%s', (codigo, mensagem) => {
    expect(traduzErro(codigo)).toBe(mensagem);
  });

  it('timeout mostra a etapa', () => {
    expect(traduzErro('timeout/entrar')).toBe(
      'Tempo esgotado ao falar com o Firebase (timeout/entrar).'
    );
  });

  it('código desconhecido mostra o código', () => {
    expect(traduzErro('auth/algo-novo')).toContain('(auth/algo-novo)');
  });

  it('sem código mostra "erro desconhecido"', () => {
    expect(traduzErro(undefined)).toContain('(erro desconhecido)');
  });
});

describe('erroApple', () => {
  it('usa o code quando o erro vem do Firebase', () => {
    expect(erroApple({ code: 'auth/invalid-credential' })).toBe('auth/invalid-credential');
  });

  it('reconhece o cancelamento nativo (erro 1001)', () => {
    const msg =
      "The operation couldn't be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)";
    expect(erroApple(msg)).toBe('apple/cancelado');
    expect(erroApple(new Error(msg))).toBe('apple/cancelado');
    expect(erroApple('canceled')).toBe('apple/cancelado');
  });

  it('reconhece plugin ausente (fora do iOS)', () => {
    expect(erroApple('Command get_apple_id_credential not found')).toBe('apple/indisponivel');
    expect(erroApple('plugin sign-in-with-apple not allowed')).toBe('apple/indisponivel');
  });

  it('erro qualquer vira apple/erro', () => {
    expect(erroApple('falha estranha')).toBe('apple/erro');
    expect(erroApple(undefined)).toBe('apple/erro');
  });
});

describe('mensagemErroApple', () => {
  it('invalid-credential NÃO vira "e-mail ou senha incorretos" e mostra o código', () => {
    const m = mensagemErroApple('auth/invalid-credential');
    expect(m).not.toMatch(/e-mail ou senha/i);
    expect(m).toContain('auth/invalid-credential');
  });

  it('cancelamento fica só "Login cancelado."', () => {
    expect(mensagemErroApple('apple/cancelado')).toBe('Login cancelado.');
  });

  it('código desconhecido aparece uma única vez', () => {
    const m = mensagemErroApple('auth/algo-novo');
    expect(m.match(/auth\/algo-novo/g)).toHaveLength(1);
  });

  it('código traduzido ganha o código no fim', () => {
    expect(mensagemErroApple('auth/network-request-failed')).toBe(
      'Sem conexão com o Firebase. Verifique a internet. (auth/network-request-failed)'
    );
  });
});

describe('resumoToken', () => {
  const jwt = (payload: object) =>
    ['x', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');

  it('lê aud, iss, nonce e exp', () => {
    expect(
      resumoToken(jwt({ aud: 'br.com.lumno.targetautospa', iss: 'https://appleid.apple.com', nonce: 'abc', exp: 1, email: 'x@y.com' }))
    ).toEqual({ aud: 'br.com.lumno.targetautospa', iss: 'https://appleid.apple.com', nonce: 'abc', exp: 1 });
  });

  it('não devolve e-mail nem outros campos', () => {
    expect(Object.keys(resumoToken(jwt({ aud: 'a', email: 'x@y.com', sub: '123' })))).not.toContain('email');
  });

  it('token malformado devolve objeto vazio', () => {
    expect(resumoToken('lixo')).toEqual({});
    expect(resumoToken('')).toEqual({});
  });
});

describe('erroGoogle', () => {
  it('usa o code quando vem do Firebase', () => {
    expect(erroGoogle({ code: 'auth/invalid-credential' })).toBe('auth/invalid-credential');
  });

  it.each([
    'User cancelled the sign-in flow',
    'Sign-in cancelled: activity is cancelled by the user',
    "The operation couldn't be completed. (com.apple.AuthenticationServices.WebAuthenticationSession error 1.)"
  ])('cancelamento: %s', (msg) => {
    expect(erroGoogle(msg)).toBe('google/cancelado');
    expect(erroGoogle(new Error(msg))).toBe('google/cancelado');
  });

  it('plugin ausente e erro desconhecido', () => {
    expect(erroGoogle('Command sign_in not found')).toBe('google/indisponivel');
    expect(erroGoogle('Developer console is not set up correctly [28444]')).toBe('google/erro');
    expect(erroGoogle(undefined)).toBe('google/erro');
  });
});

describe('mensagemErroGoogle', () => {
  it('invalid-credential mostra o código e não fala de e-mail e senha', () => {
    const m = mensagemErroGoogle('auth/invalid-credential');
    expect(m).toContain('auth/invalid-credential');
    expect(m).not.toMatch(/e-mail ou senha/i);
  });

  it('cancelamento fica só "Login cancelado."', () => {
    expect(mensagemErroGoogle('google/cancelado')).toBe('Login cancelado.');
  });

  it('código desconhecido aparece uma única vez', () => {
    expect(mensagemErroGoogle('google/erro').match(/google\/erro/g)).toHaveLength(1);
  });
});
