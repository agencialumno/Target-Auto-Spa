// Só para depuração: lê os campos NÃO secretos do payload de um JWT (sem verificar assinatura)
export function resumoToken(jwt: string): { aud?: string; iss?: string; nonce?: string; exp?: number } {
  try {
    const parte = jwt.split('.')[1] ?? '';
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parte.length / 4) * 4, '=');
    const json = decodeURIComponent(
      Array.from(atob(b64), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
    const { aud, iss, nonce, exp } = JSON.parse(json);
    return { aud, iss, nonce, exp };
  } catch {
    return {};
  }
}
