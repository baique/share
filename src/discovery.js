import multicastdns from 'multicast-dns';

const SERVICE = '_share._tcp.local';

export function createDiscovery({ id, name, port, httpPort }, { onNode }) {
  const mdns = multicastdns({ multicast: true, interface: '0.0.0.0', port: 5353, reuseAddr: true });

  const answerFor = () => [{
    name: SERVICE, type: 'PTR', ttl: 60, data: `${id}.${SERVICE}`,
  }, {
    name: `${id}.${SERVICE}`, type: 'SRV', ttl: 60,
    data: { port, target: `${id}.local.` },
  }, {
    name: `${id}.${SERVICE}`, type: 'TXT', ttl: 60,
    data: [Buffer.from(`id=${id}`), Buffer.from(`name=${name}`), Buffer.from(`port=${port}`), Buffer.from(`http=${httpPort}`)],
  }];

  mdns.on('query', (q) => {
    const hit = q.questions && q.questions.some(x => x.name === SERVICE);
    if (!hit) return;
    mdns.respond(answerFor());
  });

  mdns.on('response', (res, rinfo) => {
    const txt = res.answers.find(a => a.type === 'TXT' && a.name.endsWith(SERVICE));
    if (!txt) return;
    const data = Object.fromEntries(txt.data.map(b => {
      const s = b.toString(); const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)];
    }));
    if (!data.id || data.id === id) return;
    onNode({
      id: data.id,
      name: data.name || data.id,
      ip: rinfo.address,
      port: data.port ? Number(data.port) : 0,
      httpPort: data.http ? Number(data.http) : 0,
    });
  });

  const tick = () => {
    mdns.respond(answerFor());
    mdns.query({ questions: [{ name: SERVICE, type: 'PTR' }] });
  };
  const timer = setInterval(tick, 10_000);

  return {
    start() { tick(); },
    stop() {
      clearInterval(timer);
      try {
        mdns.respond([{
          name: `${id}.${SERVICE}`, type: 'SRV', ttl: 0,
          data: { port, target: `${id}.local.` },
        }]);
      } catch {}
      mdns.destroy();
    },
  };
}
