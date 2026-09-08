import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../src/history.js';

test('add 追加并按时间升序', () => {
  const h = createHistory({ now: () => 1000 });
  h.add({ id: 'a', type: 'text', from: 'X', time: 1000, text: 'hi' });
  h.add({ id: 'b', type: 'text', from: 'Y', time: 2000, text: 'yo' });
  assert.deepEqual(h.getAll().map(m => m.id), ['a', 'b']);
});

test('prune 移除超过 30 分钟的消息', () => {
  let t = 0;
  const h = createHistory({ now: () => t });
  h.add({ id: 'old', type: 'text', from: 'X', time: 0, text: 'x' });
  h.add({ id: 'new', type: 'text', from: 'X', time: 2000, text: 'y' }); // 年龄 < 30min，存活
  t = 30 * 60 * 1000 + 1001;
  h.prune();
  assert.deepEqual(h.getAll().map(m => m.id), ['new']);
  h.add({ id: 'z', type: 'text', from: 'X', time: t, text: 'z' });
  assert.deepEqual(h.getAll().map(m => m.id), ['new', 'z']);
});

test('getAll 返回副本，外部修改不影响内部', () => {
  const h = createHistory({ now: () => 1000 });
  h.add({ id: 'a', type: 'text', from: 'X', time: 1000, text: 'hi' });
  const list = h.getAll();
  list.pop();
  assert.equal(h.getAll().length, 1);
});
