// Firestore e Auth falsos em memória, com transações, para testar pagamento e webhook sem rede.
export function criarBanco(inicial = {}) {
  const docs = new Map(Object.entries(inicial));
  // Versão por documento: a transação confere se o que leu mudou antes de gravar (como o Firestore)
  const versoes = new Map();
  const versao = (c) => versoes.get(c) ?? 0;
  const gravarSync = (c, v) => (docs.set(c, v), versoes.set(c, versao(c) + 1));
  const apagarSync = (c) => (docs.delete(c), versoes.set(c, versao(c) + 1));
  let seq = 0;

  const lerCampo = (obj, caminho) => caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  const ref = (caminho) => ({
    path: caminho,
    id: caminho.split('/').pop(),
    async get() {
      return { exists: docs.has(caminho), id: caminho.split('/').pop(), data: () => docs.get(caminho) };
    },
    async set(v, opcoes) {
      gravarSync(caminho, opcoes?.merge ? { ...(docs.get(caminho) ?? {}), ...v } : v);
    },
    async update(v) {
      if (!docs.has(caminho)) throw new Error('NOT_FOUND');
      gravarSync(caminho, { ...docs.get(caminho), ...v });
    },
    async delete() {
      apagarSync(caminho);
    }
  });

  const consulta = (colecao, filtros = [], max = Infinity) => ({
    where: (campo, _op, valor) => consulta(colecao, [...filtros, { campo, valor }], max),
    limit: (n) => consulta(colecao, filtros, n),
    async get() {
      const lista = [...docs.entries()]
        .filter(([k]) => k.startsWith(colecao + '/') && !k.slice(colecao.length + 1).includes('/'))
        .filter(([, v]) => filtros.every((f) => lerCampo(v, f.campo) === f.valor))
        .slice(0, max)
        .map(([k, v]) => ({ id: k.split('/').pop(), exists: true, data: () => v }));
      return { docs: lista };
    }
  });

  return {
    docs,
    doc: ref,
    collection: (nome) => ({ ...consulta(nome), doc: (id) => ref(`${nome}/${id ?? 'auto' + ++seq}`) }),
    // Transação otimista: se um documento lido mudou até o commit, repete (como o Firestore)
    async runTransaction(fn) {
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const lidos = new Map();
        const escritas = [];
        const tx = {
          async get(r) {
            lidos.set(r.path, versao(r.path));
            return r.get();
          },
          set: (r, v, o) => void escritas.push(() => gravarSync(r.path, o?.merge ? { ...(docs.get(r.path) ?? {}), ...v } : v)),
          update: (r, v) => void escritas.push(() => gravarSync(r.path, { ...docs.get(r.path), ...v })),
          delete: (r) => void escritas.push(() => apagarSync(r.path))
        };
        const resultado = await fn(tx);
        if ([...lidos].some(([c, v]) => versao(c) !== v)) continue;
        for (const e of escritas) e(); // conferência e gravação sem pausa: atômico
        return resultado;
      }
      throw new Error('transação abortada por conflito');
    }
  };
}

export function criarAuth(tokens = { 'tok-ana': 'ana', 'tok-bia': 'bia' }) {
  return {
    async verifyIdToken(token) {
      if (!(token in tokens)) throw new Error('token ruim');
      return { uid: tokens[token] };
    }
  };
}

export const bearer = (t) => `Bearer ${t}`;
export const status = (p) => p.then(() => 0, (e) => e.status ?? -1);
