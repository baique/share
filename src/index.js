import os from 'node:os';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { writeFile, statSync } from 'node:fs';
import { createHistory } from './history.js';
import { createNodeList } from './node-list.js';
import { createServer } from './server.js';
import { createDiscovery } from './discovery.js';
import { pushMessage, requestSync, buildFileInfo } from './send.js';
import { renderUI } from './ui.js';

function basenameNoExt(n) { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(0, i) : n; }
function ext(n) { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i) : ''; }

function uniqueName(name) {
  let target = name;
  let i = 1;
  while (statSync(target, { throwIfNoEntry: false })) {
    target = `${basenameNoExt(name)} (${i++})${ext(name)}`;
  }
  return target;
}

export async function createApp({ directIp } = {}) {
  const selfId = crypto.randomUUID().slice(0, 8);
  const selfName = os.hostname();

  const history = createHistory();
  const nodes = createNodeList();
  const events = new EventEmitter();
  let lastFileSeq = 0;
  const fileSeq = new Map();

  const refresh = () => events.emit('update');

  const server = await createServer({
    onMessage(msg) {
      history.add(msg);
      if (msg.type === 'file' && !fileSeq.has(msg.id)) fileSeq.set(msg.id, ++lastFileSeq);
      refresh();
    },
    onSync() { return history.getAll(); },
  });

  const discovery = createDiscovery(
    { id: selfId, name: selfName, port: server.tcpPort, httpPort: server.httpPort },
    {
      onNode(node) {
        if (nodes.upsert(node)) {
          refresh();
          requestSync(node, selfId, selfName, []).then((r) => {
            if (!r) return;
            nodes.upsert(r.node);
            const known = new Set(history.getAll().map(m => m.id));
            for (const m of r.messages) if (!known.has(m.id)) history.add(m);
            refresh();
          });
        }
      },
    },
  );
  discovery.start();

  if (directIp) {
    const [ip, port] = directIp.split(':');
    requestSync({ ip, port: Number(port) || 41023 }, selfId, selfName, []).then((r) => {
      if (!r) { console.error(`无法连接 ${directIp}`); return; }
      nodes.upsert(r.node);
      const known = new Set(history.getAll().map(m => m.id));
      for (const m of r.messages) if (!known.has(m.id)) history.add(m);
      refresh();
    });
  }

  const pruneTimer = setInterval(() => { nodes.prune(); history.prune(); refresh(); }, 10_000);

  let quitSilent = false;
  const runtime = {
    events,
    get messages() { return history.getAll(); },
    get nodes() { return nodes.all(); },

    sendText(text) {
      const msg = { id: crypto.randomUUID(), type: 'text', from: selfName, time: Date.now(), text };
      history.add(msg);
      refresh();
      for (const n of nodes.all()) pushMessage(n, msg);
    },

    sendFile(filePath) {
      try {
        const fileId = crypto.randomUUID().slice(0, 8);
        const info = buildFileInfo(server, fileId, filePath);
        const msg = { id: crypto.randomUUID(), type: 'file', from: selfName, time: Date.now(), file: info };
        history.add(msg);
        fileSeq.set(msg.id, ++lastFileSeq);
        refresh();
        for (const n of nodes.all()) pushMessage(n, msg);
        return { ok: true };
      } catch (e) {
        return { ok: false, msg: e.message };
      }
    },

    // 测试辅助：注册文件返回元数据，不广播
    sendFileInternal(filePath) {
      const fileId = crypto.randomUUID().slice(0, 8);
      return buildFileInfo(server, fileId, filePath);
    },

    async download(fileMsg) {
      const res = await fetch(fileMsg.file.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const target = uniqueName(fileMsg.file.name);
      await writeFile(target, buf);
    },

    quit(silent) {
      if (quitSilent) return;
      quitSilent = true;
      try { discovery.stop(); } catch {}
      server.close();
      clearInterval(pruneTimer);
      if (!silent) process.exit(0);
    },
  };

  return { history, nodes, server, discovery, runtime };
}

export async function main(argv) {
  const ci = argv.indexOf('-c');
  const directIp = ci !== -1 && argv[ci + 1] ? argv[ci + 1] : undefined;
  const app = await createApp({ directIp });
  renderUI(app.runtime);
  return app;
}
