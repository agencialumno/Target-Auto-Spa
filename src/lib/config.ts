// Painel de depuração na tela de login (erros do WebView no iPhone, sem Mac).
// Desligado: o painel não aparece e os erros globais não são capturados.
// Para depurar de novo no TestFlight, troque para true.
export const DEPURACAO = false;

// API serverless (Vercel) usada pela tela de admin para criar e remover usuários
export const API_BASE = "https://target-auto-spa-api.vercel.app";

// Login com Google (client IDs OAuth: públicos, não são segredos; o client secret NÃO é usado).
// iOS: client ID do tipo "iOS" (bundle br.com.lumno.targetautospa).
// Android: client ID do tipo "Aplicativo da Web" (o do tipo Android só é conferido pelo Google, por SHA-1).
// Enquanto estiverem vazios, o botão mostra "Login com Google ainda não configurado".
export const GOOGLE_IOS_CLIENT_ID = "";
export const GOOGLE_WEB_CLIENT_ID = "";
