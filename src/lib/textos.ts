// Textos que se repetem em várias telas e podem mudar (um só lugar para trocar).
// O nome do papel hoje é "gerente"; vai mudar depois, então nenhuma tela escreve o texto direto.
export const FALE_COM_GERENTE = 'Fale com o gerente';

// "Preço sob consulta — fale com o gerente" (mesma constante, com a inicial minúscula no meio da frase)
export const fraseFaleComGerente = () => FALE_COM_GERENTE.charAt(0).toLowerCase() + FALE_COM_GERENTE.slice(1);
