import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, useInput, useStdout, render } from 'ink';
import { existsSync } from 'node:fs';

const h = React.createElement;
const fmtTime = (t) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : n >= 1024 ? (n / 1024).toFixed(0) + 'KB' : n + 'B';
const truncate = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;

function App({ runtime }) {
  const [focus, setFocus] = useState('input'); // 'input' | 'list'
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState([]);
  const [, setTick] = useState(0);
  const { stdout } = useStdout();

  const messages = runtime.messages;
  const viewport = Math.max((stdout.rows || 24) - 5, 5);

  // 全部可变状态走 ref，供稳定的按键 handler 读取
  const stateRef = useRef({ focus: 'input', input: '', messages: [], selected: 0 });
  stateRef.current = { focus, input, messages, selected };

  const pushStatus = useCallback((s) => setStatus(prev => [...prev, s].slice(-2)), []);

  const operate = useCallback((action) => {
    const { messages: msgs, selected: sel } = stateRef.current;
    const m = msgs[sel];
    if (!m) return;
    if (action === 'copy' && m.type === 'text') {
      runtime.copyText(m.text).then(() => {
        pushStatus(`已复制: ${truncate(m.text, 24)}`);
      }).catch(e => {
        pushStatus(`复制失败: ${e.message}`);
      });
    } else if (action === 'download' && m.type === 'file') {
      runtime.download(m).then(() => {
        pushStatus(`下载完成 → ./${m.file.name}`);
      }).catch(e => {
        pushStatus(`下载失败: ${e.message}`);
      });
    } else {
      pushStatus(action === 'copy' ? '该消息不是文本' : '该消息不是文件');
    }
  }, [runtime, pushStatus]);

  const submit = useCallback(async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput('');
    if (existsSync(trimmed)) {
      const r = await runtime.sendFile(trimmed);
      pushStatus(r.ok ? `已发送文件 ${trimmed}` : `发送失败: ${r.msg}`);
    } else {
      await runtime.sendText(trimmed);
    }
  }, [runtime, pushStatus]);

  // 稳定 handler：只在 runtime 变化时重注册，避免按键事件丢失
  const handler = useCallback((ch, key) => {
    const s = stateRef.current;
    if (key.ctrl && ch === 'c') { runtime.quit(); return; }

    // 方向键：任意焦点下进入选择模式并移动（快速选择）
    if (key.upArrow || key.downArrow) {
      setFocus('list');
      setSelected(x => key.upArrow
        ? Math.max(x - 1, 0)
        : Math.min(x + 1, s.messages.length - 1));
      return;
    }

    if (s.focus === 'list') {
      if (ch === 'q') { runtime.quit(); return; }
      if (ch === 'c') { operate('copy'); return; }
      if (ch === 'd') { operate('download'); return; }
      if (key.tab || key.escape) { setFocus('input'); return; }
      // 其他可打印字符 → 自动回输入模式并输入
      if (ch && !key.ctrl && !key.meta) { setFocus('input'); setInput(v => v + ch); return; }
      return;
    }

    // focus === 'input'
    if (key.tab) { setFocus('list'); return; }
    if (key.return) { submit(s.input); return; }
    if (key.backspace || key.delete) { setInput(v => v.slice(0, -1)); return; }
    if (key.escape) { return; }
    if (ch && !key.ctrl && !key.meta) { setInput(v => v + ch); return; }
  }, [runtime, operate, submit]);

  useInput(handler);

  // 新消息到达：输入模式下自动跳到最新；选择模式保持浏览位置
  useEffect(() => {
    if (!runtime.events) return;
    const onUpdate = () => {
      setTick(t => t + 1);
      if (stateRef.current.focus === 'input') setSelected(Math.max(runtime.messages.length - 1, 0));
    };
    runtime.events.on('update', onUpdate);
    return () => runtime.events.off('update', onUpdate);
  }, [runtime]);

  const total = messages.length;
  const offset = Math.min(Math.max(selected - Math.floor(viewport / 2), 0), Math.max(total - viewport, 0));
  const visible = messages.slice(offset, offset + viewport);

  const rowFor = (m, idx) => {
    const isSel = idx === selected;
    const body = m.type === 'file'
      ? `[${fmtTime(m.time)}] ${m.from}: [文件] ${m.file.name}(${fmtSize(m.file.size)})`
      : `[${fmtTime(m.time)}] ${m.from}: ${m.text}`;
    const props = { key: m.id };
    if (isSel) props.inverse = true;
    return h(Text, props, body);
  };

  return h(Box, { flexDirection: 'column' },
    h(Box, null,
      h(Text, { bold: true, color: 'green' }, `LAN Share — ${runtime.nodes.length} 台设备在线`),
      h(Text, { color: focus === 'list' ? 'yellow' : 'gray' }, focus === 'list' ? '  [选择]' : '')),
    h(Box, { flexDirection: 'column', flexGrow: 1, marginTop: 1 },
      ...visible.map((m, v) => rowFor(m, offset + v)),
      ...status.map((s, i) => h(Text, { key: 'st' + i, color: 'cyan' }, s))),
    h(Box, null,
      h(Text, { color: 'gray' }, focus === 'list'
        ? '↑/↓ 选择 · c 复制 · d 下载 · q 退出 · 字符回输入'
        : '输入文本或文件路径回车发送 · ↑↓ 选择 · Ctrl+C 退出')),
    h(Box, null,
      h(Text, { color: 'gray' }, '› '),
      h(Text, { bold: true }, input)));
}

export function renderUI(runtime) {
  return render(h(App, { runtime }), { exitOnCtrlC: false });
}
