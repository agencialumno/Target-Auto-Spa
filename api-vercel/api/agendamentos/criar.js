import { endpoint } from '../../_lib/http.js';
import { criarAgendamento } from '../../_lib/agendamento.js';

export default endpoint((deps, autorizacao, corpo) => criarAgendamento({ ...deps, agora: () => new Date() }, autorizacao, corpo));
