// Firestore e Auth falsos em memória, com transações, para testar pagamento e webhook sem rede.
export function criarBanco(inicial = {}) {
  const docs = new Map(Object.entries(inicial));

  const lerCampo = (obj, caminho) => caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  const ref = (caminho) => ({
    path: caminho,
    id: caminho.split('/').pop(),
    async get() {
      return { exists: docs.has(caminho), id: caminho.split('/').pop(), data: () => docs.get(caminho) };
    },
    async set(v, opcoes) {
      docs.set(caminho, opcoes?.merge ? { ...(docs.get(caminho) ?? {}), ...v } : v);
    },
    async update(v) {
      if (!docs.has(caminho)) throw new Error('NOT_FOUND');
      docs.set(caminho, { ...docs.get(caminho), ...v });
    },
    async delete() {
      docs.delete(caminho);
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
    collection: (nome) => consulta(nome),
    async runTransaction(fn) {
      const escritas = [];
      const tx = {
        get: (r) => (r.path ? r.get() : r.get()),
        set: (r, v, o) => void escritas.push(() => r.set(v, o)),
        update: (r, v) => void escritas.push(() => r.update(v)),
        delete: (r) => void escritas.push(() => r.delete())
      };
      const resultado = await fn(tx);
      for (const e of escritas) await e();
      return resultado;
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
