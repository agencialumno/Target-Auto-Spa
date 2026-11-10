// Páginas de retorno do Checkout (pago, cancelado, expirado). Só informam: não recebem nem mostram dado
// algum, e NÃO confirmam pagamento (quem confirma é o webhook). Sem script e sem recurso externo.
const TEXTOS = {
  pago: { titulo: 'Pagamento enviado', texto: 'Obrigado! A confirmação aparece no aplicativo em instantes. Você já pode fechar esta página e voltar ao app.' },
  cancelado: { titulo: 'Pagamento cancelado', texto: 'O pagamento não foi concluído. Volte ao aplicativo para tentar de novo.' },
  expirado: { titulo: 'Prazo de pagamento encerrado', texto: 'O prazo de 15 minutos terminou e o horário foi liberado. Volte ao aplicativo para agendar novamente.' }
};

export const TIPOS_RETORNO = Object.keys(TEXTOS);

export function paginaRetorno(tipo) {
  // hasOwn: "__proto__", "constructor" etc. não são páginas
  if (typeof tipo !== 'string' || !Object.hasOwn(TEXTOS, tipo)) return null;
  const t = TEXTOS[tipo];
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta name="robots" content="noindex">
<title>${t.titulo} · Target Auto Spa</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1f33;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;box-sizing:border-box}
  main{max-width:420px;text-align:center}
  h1{font-size:1.4rem;margin:0 0 12px;color:#e6b84a}
  p{line-height:1.5;margin:0;opacity:.92}
</style>
</head>
<body>
<main>
<h1>${t.titulo}</h1>
<p>${t.texto}</p>
</main>
</body>
</html>
`;
}
