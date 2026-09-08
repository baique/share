export function createHistory({ ttlMs = 30 * 60 * 1000, now = Date.now } = {}) {
  const messages = [];
  const prune = () => {
    const cutoff = now() - ttlMs;
    while (messages.length && messages[0].time < cutoff) messages.shift();
  };
  return {
    add(msg) {
      messages.push(msg);
      prune();
    },
    getAll() {
      prune();
      return messages.slice();
    },
    prune,
  };
}
