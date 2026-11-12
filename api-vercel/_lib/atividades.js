// Log de atividades (coleção "atividades"): só o servidor grava por aqui (Admin SDK). O app grava preço,
// status e login de admin pelas regras (create-only). Em todos os casos o documento tem o mesmo formato
// e NUNCA carrega e-mail, nome, CPF, telefone nem link de pagamento: só campos de uma lista por ação.
import { randomUUID } from 'node:crypto';

// Ação -> tipo do alvo e campos permitidos em antes/depois. Qualquer outro campo é descartado.
export const ACOES = {
  login_admin: { alvoTipo: 'usuario', campos: [] },
  usuario_criado: { alvoTipo: 'usuario', campos: ['papel', 'condominioId'] },
  usuario_removido: { alvoTipo: 'usuario', campos: ['papel', 'condominioId'] },
  condominio_vinculado: { alvoTipo: 'usuario', campos: ['condominioId'] },
  papel_alterado: { alvoTipo: 'usuario', campos: ['papel'] },
  preco_alterado: { alvoTipo: 'servico', campos: ['precoCentavos'] },
  status_agendamento: { alvoTipo: 'agendamento', campos: ['status'] },
  pagamento_confirmado: { alvoTipo: 'agendamento', campos: ['status', 'valorCentavos'] },
  pagamento_divergente: { alvoTipo: 'agendamento', campos: ['status', 'valorCentavos'] },
  pagamento_expirado: { alvoTipo: 'agendamento', campos: ['status', 'valorCentavos'] },
  pagamento_cancelado: { alvoTipo: 'agendamento', campos: ['status', 'valorCentavos'] }
};

export const ATOR_SISTEMA = { atorUid: 'asaas', atorPapel: 'sistema:asaas' };

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const TEXTO_RE = /^[A-Za-z0-9_:-]{1,100}$/;
const PAPEIS_ATOR = ['cliente', 'gerente', 'funcionario', 'admin', 'sistema:asaas'];
const CENTAVOS = ['precoCentavos', 'valorCentavos'];

// Só os campos permitidos, com tipo válido (texto curto simples ou centavos inteiros)
export function limparCampos(campos, obj) {
  if (!obj || typeof obj !== 'object') return null;
  const saida = {};
  for (const c of campos) {
    const v = obj[c];
    if (v === undefined) continue;
    if (CENTAVOS.includes(c)) {
      if (Number.isInteger(v) && v >= 0) saida[c] = v;
    } else if (v === null || (typeof v === 'string' && TEXTO_RE.test(v))) {
      saida[c] = v;
    }
  }
  return Object.keys(saida).length ? saida : null;
}

// Monta o documento ou devolve null se algo não bate (nunca lança: o log não pode derrubar a ação)
export function montarAtividade({ em, atorUid, atorPapel, acao, alvoId, antes = null, depois = null, origem = 'api' }) {
  const def = ACOES[acao];
  if (!def || !em) return null;
  if (typeof atorUid !== 'string' || !ID_RE.test(atorUid) || !PAPEIS_ATOR.includes(atorPapel)) return null;
  if (typeof alvoId !== 'string' || !ID_RE.test(alvoId)) return null;
  return {
    em,
    atorUid,
    atorPapel,
    acao,
    alvoTipo: def.alvoTipo,
    alvoId,
    antes: limparCampos(def.campos, antes),
    depois: limparCampos(def.campos, depois),
    origem: ['api', 'webhook', 'consulta', 'app'].includes(origem) ? origem : 'api'
  };
}

const novoId = () => randomUUID().replaceAll('-', '');

// Fora de transação: melhor esforço (falha só vai para o log, sem dados)
export async function registrarAtividade(db, dados) {
  try {
    const valor = montarAtividade(dados);
    if (!valor) return false;
    await db.doc(`atividades/${novoId()}`).set(valor);
    return true;
  } catch (e) {
    console.error('atividade nao gravada:', e?.name);
    return false;
  }
}

// Dentro de transação: entra no mesmo commit da mudança que descreve
export function registrarNaTransacao(tx, db, dados) {
  const valor = montarAtividade(dados);
  if (!valor) return false;
  tx.set(db.doc(`atividades/${novoId()}`), valor);
  return true;
}
