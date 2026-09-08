export function createHistory({ ttlMs = 30 * 60 * 1000, now = Date.now } = {}) {
  const messages = [];
  const seen = new Set();
  const prune = () => {
    const cutoff = now() - ttlMs;
    while (messages.length && messages[0].time < cutoff) messages.shift();
  };
  return {
    add(msg) {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      messages.push(msg);
      prune();
      return true;
    },
    getAll() {
      prune();
      return messages.slice();
    },
    prune,
  };
}
