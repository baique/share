import net from 'node:net';
import http from 'node:http';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import { networkInterfaces } from 'node:os';

function localIPv4() {
  for (const ifs of Object.values(networkInterfaces())) {
    for (const iface of ifs || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function listen(server, startPort) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') tryPort(p + 1);
        else throw err;
      });
      server.listen(p, () => resolve(server.address().port));
    };
    tryPort(startPort);
  });
}

export async function createServer({ onMessage, onSync }) {
  const host = localIPv4();
  const files = new Map();
  let tcpPort, httpPort;

  // --- TCP ---
  const tcp = net.createServer((sock) => {
    sock.setEncoding('utf8');
    let buf = '';
    sock.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const raw = buf.slice(0, idx); buf = buf.slice(idx + 1);
        if (!raw.trim()) continue;
        let msg;
        try { msg = JSON.parse(raw); } catch { continue; }
        if (msg.type === 'sync') {
          const history = onSync({ id: msg.id, name: msg.name });
          sock.write(JSON.stringify({
            type: 'welcome', id: os.hostname(), name: os.hostname(),
            port: tcpPort, httpPort,
          }) + '\n');
          sock.write(JSON.stringify({ type: 'sync-response', id: os.hostname(), name: os.hostname(), messages: history }) + '\n');
        } else if (msg.type === 'text' || msg.type === 'file') {
          onMessage(msg);
        }
      }
    });
    sock.on('end', () => sock.end());
    sock.on('error', () => {});
  });

  // --- HTTP ---
  const httpServer = http.createServer((req, res) => {
    const m = /^\/f\/([^/]+)\/?$/.exec(req.url || '');
    if (!m || !files.has(m[1])) { res.writeHead(404); res.end('not found'); return; }
    const { path: filePath, name } = files.get(m[1]);
    res.writeHead(200, {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
    });
    createReadStream(filePath).pipe(res);
  });

  tcpPort = await listen(tcp, 41023);
  httpPort = await listen(httpServer, 41024);

  return {
    ip: host,
    tcpPort,
    httpPort,
    registerFile(id, info) { files.set(id, info); },
    close() {
      return Promise.all([
        new Promise(r => tcp.close(r)),
        new Promise(r => httpServer.close(r)),
      ]);
    },
  };
}
