import { endpoint } from '../../_lib/http.js';
import { criarPagamento } from '../../_lib/pagamento.js';

export default endpoint((deps, autorizacao, corpo) =>
  criarPagamento({ ...deps, env: process.env, agora: () => new Date() }, autorizacao, corpo)
);
