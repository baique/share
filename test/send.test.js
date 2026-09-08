import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFileInfo, pushMessage, requestSync } from '../src/send.js';
import { createServer } from '../src/server.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('pushMessage 送达对端 TCP 服务', async () => {
  const got = [];
  const s = await createServer({ onMessage: m => got.push(m), onSync: () => [] });
  try {
    const ok = await pushMessage({ id: 'n2', name: 'B', ip: '127.0.0.1', port: s.tcpPort },
      { type: 'text', id: 'm1', from: 'A', time: 1, text: 'ping' });
    assert.equal(ok, true);
    await new Promise(r => setTimeout(r, 100));
    assert.equal(got[0]?.text, 'ping');
  } finally { await s.close(); }
});

test('pushMessage 对不可达节点静默失败', async () => {
  const ok = await pushMessage({ id: 'x', name: 'X', ip: '127.0.0.1', port: 1 }, { type: 'text', id: 'm', from: 'A', time: 1, text: 'x' });
  assert.equal(ok, false);
});

test('requestSync 获取 welcome 与历史', async () => {
  const s = await createServer({ onMessage: () => {}, onSync: () => [{ id: 'm1', type: 'text', from: 'B', time: 1, text: 'hi' }] });
  try {
    const r = await requestSync({ ip: '127.0.0.1', port: s.tcpPort }, 'a', 'A', []);
    assert.ok(r);
    assert.equal(r.messages[0].text, 'hi');
    assert.equal(typeof r.node.httpPort, 'number');
  } finally { await s.close(); }
});

test('buildFileInfo 注册文件返回元数据', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'share-test-'));
  const f = path.join(dir, 'b.txt');
  await writeFile(f, 'data');
  const s = await createServer({ onMessage: () => {}, onSync: () => [] });
  try {
    const info = buildFileInfo(s, 'fid', f);
    assert.equal(info.name, 'b.txt');
    assert.equal(info.size, 4);
    assert.ok(info.url.includes(`:${s.httpPort}/f/fid`));
  } finally { await s.close(); await rm(dir, { recursive: true, force: true }); }
});
