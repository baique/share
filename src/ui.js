import React, { useEffect, useRef, useState } from 'react';
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
  const focusRef = useRef(focus);
  const inputRef = useRef(input);
  focusRef.current = focus;
  inputRef.current = input;

  const messages = runtime.messages;
  const viewport = Math.max((stdout.rows || 24) - 4, 5);

  // 新消息到达时，输入模式下自动跳到最新；选择模式保持浏览位置
  useEffect(() => {
    if (!runtime.events) return;
    const handler = () => {
      setTick(t => t + 1);
      if (focusRef.current === 'input') setSelected(Math.max(runtime.messages.length - 1, 0));
    };
    runtime.events.on('update', handler);
    return () => runtime.events.off('update', handler);
  }, [runtime]);

  const pushStatus = (s) => setStatus(prev => [...prev, s].slice(-5));

  const operate = (action) => {
    const m = messages[selected];
    if (!m) return;
    if (action === 'copy' && m.type === 'text') {
      try {
        runtime.copyText(m.text);
        pushStatus(`已复制: ${truncate(m.text, 24)}`);
      } catch (e) {
        pushStatus(`复制失败: ${e.message}`);
      }
    } else if (action === 'download' && m.type === 'file') {
      runtime.download(m).then(() => {
        pushStatus(`下载完成 → ./${m.file.name}`);
      }).catch(e => {
        pushStatus(`下载失败: ${e.message}`);
      });
    } else {
      pushStatus(action === 'copy' ? '该消息不是文本' : '该消息不是文件');
    }
  };

  const submit = async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput('');
    if (existsSync(trimmed)) {
      const r = await runtime.sendFile(trimmed);
      pushStatus(r.ok ? `已发送文件 ${trimmed}` : `发送失败: ${r.msg}`);
    } else {
      await runtime.sendText(trimmed);
    }
  };

  useInput((ch, key) => {
    // 全局：Ctrl+C 退出
    if (key.ctrl && ch === 'c') { runtime.quit(); return; }

    if (focus === 'list') {
      if (ch === 'q') { runtime.quit(); return; }
      if (key.upArrow) { setSelected(s => Math.max(s - 1, 0)); return; }
      if (key.downArrow) { setSelected(s => Math.min(s + 1, messages.length - 1)); return; }
      if (ch === 'c') { operate('copy'); return; }
      if (ch === 'd') { operate('download'); return; }
      if (key.tab || key.escape) { setFocus('input'); return; }
      return; // 列表模式忽略其余按键
    }

    // focus === 'input'
    if (key.tab) { setFocus('list'); return; }
    if (key.return) { submit(input); return; }
    if (key.backspace) { setInput(v => v.slice(0, -1)); return; }
    if (key.escape) { return; }
    if (ch && !key.ctrl && !key.meta) { setInput(v => v + ch); return; }
  });

  // 消息列表视口裁剪，保证选中项可见
  const total = messages.length;
  let offset = Math.min(Math.max(selected - Math.floor(viewport / 2), 0), Math.max(total - viewport, 0));
  const visible = messages.slice(offset, offset + viewport);

  const rowFor = (m, idx) => {
    const isSel = idx === selected;
    const body = m.type === 'file'
      ? `[${fmtTime(m.time)}] ${m.from}: [文件] ${m.file.name}(${fmtSize(m.file.size)})`
      : `[${fmtTime(m.time)}] ${m.from}: ${m.text}`;
    const props = { key: m.id };
    if (isSel) props.backgroundColor = focus === 'list' ? 'blue' : 'gray';
    return h(Text, props, body);
  };

  return h(Box, { flexDirection: 'column' },
    h(Box, null,
      h(Text, { bold: true, color: 'green' }, `LAN Share — ${runtime.nodes.length} 台设备在线`),
      h(Text, { color: focus === 'list' ? 'yellow' : 'gray' }, focus === 'list' ? '  [选择模式]' : '')),
    h(Box, { flexDirection: 'column', marginTop: 1 },
      ...visible.map((m, v) => rowFor(m, offset + v)),
      ...status.map((s, i) => h(Text, { key: 's' + i, color: 'cyan' }, s))),
    h(Box, { marginTop: 1 },
      h(Text, { color: 'gray' }, focus === 'list'
        ? '↑/↓ 选择 · c 复制文本 · d 下载文件 · Tab/Esc 回输入 · q 退出'
        : '输入文本或文件路径回车发送 · Tab 选择消息 · ↑/↓ 滚动 · Ctrl+C 退出')),
    h(Box, null,
      h(Text, { color: 'gray' }, '› '),
      h(Text, { bold: true }, input)));
}

export function renderUI(runtime) {
  return render(h(App, { runtime }));
}
