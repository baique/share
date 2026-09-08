import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/index.js';
import { pushMessage } from '../src/send.js';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('双实例端到端：A 发文本，B 收到并入库', async () => {
  const a = await createApp();
  const b = await createApp();
  try {
    b.nodes.upsert({ id: 'a', name: 'A', ip: '127.0.0.1', port: a.server.tcpPort });
    a.nodes.upsert({ id: 'b', name: 'B', ip: '127.0.0.1', port: b.server.tcpPort });

    const msg = { id: 'm1', type: 'text', from: 'A', time: Date.now(), text: '你好局域网' };
    a.history.add(msg);
    for (const n of a.nodes.all()) await pushMessage(n, msg);

    await new Promise(r => setTimeout(r, 200));
    assert.ok(b.history.getAll().some(x => x.text === '你好局域网'));
  } finally {
    await a.runtime.quit(true);
    await b.runtime.quit(true);
  }
});

test('文件传输：A 注册文件发元数据，B 下载内容一致', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'share-int-'));
  const f = path.join(dir, 'demo.txt');
  await writeFile(f, '集成测试内容');

  const a = await createApp();
  const b = await createApp();
  try {
    const info = a.runtime.sendFileInternal(f);
    const msg = { id: 'm2', type: 'file', from: 'A', time: Date.now(), file: info };
    a.history.add(msg);
    b.history.add(msg);

    // 对端通过 HTTP 直接拉取
    const res = await fetch(info.url);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '集成测试内容');

    // 通过 b.runtime.download 下载到当前目录
    const oldCwd = process.cwd();
    process.chdir(dir);
    try { await b.runtime.download(msg); } finally { process.chdir(oldCwd); }
    assert.equal(await readFile(path.join(dir, 'demo.txt'), 'utf8'), '集成测试内容');
  } finally {
    await a.runtime.quit(true);
    await b.runtime.quit(true);
    await rm(dir, { recursive: true, force: true });
  }
});

test('文件名冲突：已存在时追加 (1) 后缀', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'share-int-'));
  const srcDir = path.join(dir, 'src');
  await mkdir(srcDir);
  const srcF = path.join(srcDir, 'conflict.txt');
  await writeFile(srcF, 'src');
  // cwd=dir 已存在同名 conflict.txt
  await writeFile(path.join(dir, 'conflict.txt'), 'exist');

  const a = await createApp();
  try {
    const info = a.runtime.sendFileInternal(srcF);
    const msg = { id: 'm3', type: 'file', from: 'A', time: Date.now(), file: info };
    const oldCwd = process.cwd();
    process.chdir(dir);
    try { await a.runtime.download(msg); } finally { process.chdir(oldCwd); }
    assert.equal(await readFile(path.join(dir, 'conflict (1).txt'), 'utf8'), 'src');
    assert.equal(await readFile(path.join(dir, 'conflict.txt'), 'utf8'), 'exist');
  } finally {
    await a.runtime.quit(true);
    await rm(dir, { recursive: true, force: true });
  }
});
