import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNodeList } from '../src/node-list.js';

test('upsert 同 id 去重并刷新 lastSeen', () => {
  let t = 0;
  const nl = createNodeList({ now: () => t });
  assert.equal(nl.upsert({ id: 'a', name: 'X', ip: '1.1.1.1', port: 1 }), true);
  t = 5000;
  assert.equal(nl.upsert({ id: 'a', name: 'X2', ip: '1.1.1.2', port: 2 }), false);
  assert.equal(nl.all().length, 1);
  assert.equal(nl.all()[0].name, 'X2');
  assert.equal(nl.all()[0].lastSeen, 5000);
});

test('prune 移除超时节点', () => {
  let t = 0;
  const nl = createNodeList({ now: () => t });
  nl.upsert({ id: 'a', name: 'X', ip: '1.1.1.1', port: 1 });
  t = 61 * 1000;
  nl.prune();
  assert.equal(nl.all().length, 0);
});

test('get/remove 基础操作', () => {
  const nl = createNodeList({ now: () => 0 });
  nl.upsert({ id: 'a', name: 'X', ip: '1.1.1.1', port: 1 });
  assert.equal(nl.get('a').name, 'X');
  nl.remove('a');
  assert.equal(nl.get('a'), undefined);
});
