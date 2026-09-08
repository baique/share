import net from 'node:net';
import { statSync } from 'node:fs';
import path from 'node:path';

function oneShot(ip, port, payload, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: ip, port });
    let buf = '';
    sock.setEncoding('utf8');
    const done = (ok) => { try { sock.destroy(); } catch {} resolve(ok); };
    sock.on('connect', () => { sock.write(JSON.stringify(payload) + '\n', () => sock.end()); });
    sock.on('data', d => { buf += d; });
    sock.on('end', () => done(true));
    sock.on('error', () => done(false));
    setTimeout(() => done(false), timeoutMs);
  });
}

export async function pushMessage(node, msg) {
  return oneShot(node.ip, node.port, msg);
}

export async function requestSync(node, selfId, selfName, seenIds = []) {
  const { ip, port } = node;
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: ip, port });
    let buf = '';
    let nodeInfo = null;
    let messages = null;
    sock.setEncoding('utf8');
    const finish = () => resolve(nodeInfo && messages ? { node: nodeInfo, messages } : null);
    sock.on('connect', () => sock.write(JSON.stringify({ type: 'sync', id: selfId, name: selfName, seenIds }) + '\n'));
    sock.on('data', (d) => {
      buf += d;
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const raw = buf.slice(0, idx); buf = buf.slice(idx + 1);
        if (!raw.trim()) continue;
        let msg;
        try { msg = JSON.parse(raw); } catch { continue; }
        if (msg.type === 'welcome') nodeInfo = { id: msg.id, name: msg.name, ip, port: msg.port, httpPort: msg.httpPort };
        if (msg.type === 'sync-response') messages = msg.messages;
      }
      if (nodeInfo && messages) sock.end();
    });
    sock.on('end', finish);
    sock.on('error', () => resolve(null));
    setTimeout(() => resolve(null), 2000);
  });
}

export function buildFileInfo(server, fileId, filePath) {
  const st = statSync(filePath);
  if (!st.isFile()) throw new Error('not a file: ' + filePath);
  server.registerFile(fileId, { path: filePath, name: path.basename(filePath), size: st.size });
  return {
    name: path.basename(filePath),
    size: st.size,
    url: `http://${server.ip}:${server.httpPort}/f/${fileId}`,
  };
}
