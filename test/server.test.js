import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

function lineSocket(port, payload) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(port, '127.0.0.1');
    let buf = '';
    sock.setEncoding('utf8');
    sock.on('data', d => { buf += d; });
    sock.on('connect', () => sock.write(JSON.stringify(payload) + '\n'));
    sock.on('end', () => resolve(buf));
    sock.on('error', reject);
    setTimeout(() => { sock.end(); resolve(buf); }, 300);
  });
}

test('TCP 收到 text 消息回调 onMessage', async () => {
  const got = [];
  const s = await createServer({ onMessage: m => got.push(m), onSync: () => [] });
  try {
    await lineSocket(s.tcpPort, { type: 'text', id: 'm1', from: 'X', time: 1, text: 'hi' });
    assert.equal(got.length, 1);
    assert.equal(got[0].text, 'hi');
  } finally { await s.close(); }
});

test('TCP sync 请求返回 welcome + 历史', async () => {
  const s = await createServer({ onMessage: () => {}, onSync: () => [{ id: 'm1', type: 'text', from: 'X', time: 1, text: 'hi' }] });
  try {
    const out = await lineSocket(s.tcpPort, { type: 'sync', id: 'n2', name: 'Y', seenIds: [] });
    const lines = out.trim().split('\n').map(l => JSON.parse(l));
    assert.ok(lines.some(l => l.type === 'welcome'));
    const sr = lines.find(l => l.type === 'sync-response');
    assert.equal(sr.messages[0].text, 'hi');
  } finally { await s.close(); }
});

test('HTTP 注册文件并可下载，内容一致', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'share-test-'));
  const f = path.join(dir, 'a.txt');
  await writeFile(f, 'hello file');
  const s = await createServer({ onMessage: () => {}, onSync: () => [] });
  try {
    s.registerFile('fid1', { path: f, name: 'a.txt', size: 10 });
    const res = await fetch(`http://127.0.0.1:${s.httpPort}/f/fid1`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'hello file');
    const cd = res.headers.get('content-disposition') || '';
    assert.ok(cd.includes('a.txt'));
  } finally { await s.close(); await rm(dir, { recursive: true, force: true }); }
});
