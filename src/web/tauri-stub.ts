// Substitui @tauri-apps/api/core no build web (o navegador não tem o Tauri).
export async function invoke(): Promise<never> {
  throw new Error('Recurso disponível só no aplicativo.');
}
