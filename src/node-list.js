export function createNodeList({ ttlMs = 60 * 1000, now = Date.now } = {}) {
  const nodes = new Map();
  return {
    upsert(node) {
      const isNew = !nodes.has(node.id);
      nodes.set(node.id, { ...node, lastSeen: now() });
      return isNew;
    },
    get(id) { return nodes.get(id); },
    remove(id) { nodes.delete(id); },
    prune() {
      const cutoff = now() - ttlMs;
      for (const [id, n] of nodes) if (n.lastSeen < cutoff) nodes.delete(id);
    },
    all() { return [...nodes.values()]; },
  };
}
