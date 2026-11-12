import { endpoint } from '../../_lib/http.js';
import { consultarStatus } from '../../_lib/pagamento.js';

export default endpoint((deps, autorizacao, corpo) =>
  consultarStatus({ ...deps, env: process.env, agora: () => new Date() }, autorizacao, corpo)
);
