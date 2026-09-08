import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, render } from 'ink';
import TextInput from 'ink-text-input';
import { existsSync } from 'node:fs';

const h = React.createElement;
const fmtTime = (t) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : n >= 1024 ? (n / 1024).toFixed(0) + 'KB' : n + 'B';

function Messages({ messages, fileSeq, status }) {
  const rows = messages.map((m) => {
    if (m.type === 'file') {
      const seq = fileSeq.get(m.id);
      return `[${fmtTime(m.time)}] ${m.from}: [文件] ${m.file.name}(${fmtSize(m.file.size)})${seq ? `  [下载 ${seq}]` : ''}`;
    }
    return `[${fmtTime(m.time)}] ${m.from}: ${m.text}`;
  });
  const visible = rows.slice(-200);
  const children = [
    ...visible.map((r, i) => h(Text, { key: i }, r)),
    ...status.map((s, i) => h(Text, { key: 's' + i, color: 'cyan' }, s)),
  ];
  return h(Box, { flexDirection: 'column' }, children);
}

function App({ runtime }) {
  const [input, setInput] = useState('');
  const [scroll, setScroll] = useState(0);
  const [status, setStatus] = useState([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!runtime.events) return;
    const handler = () => setTick(t => t + 1);
    runtime.events.on('update', handler);
    return () => runtime.events.off('update', handler);
  }, [runtime]);

  const fileSeq = new Map();
  let seqN = 0;
  for (const m of runtime.messages) if (m.type === 'file') fileSeq.set(m.id, ++seqN);

  useInput((ch, key) => {
    if ((key.ctrl && ch === 'c') || ch === 'q') { runtime.quit(); return; }
    if (key.upArrow || ch === 'k') setScroll(s => Math.min(s + 1, runtime.messages.length - 1));
    if (key.downArrow || ch === 'j') setScroll(s => Math.max(s - 1, 0));
    if (/^[1-9]$/.test(ch)) {
      for (const [id, seq] of fileSeq) {
        if (seq === Number(ch)) {
          const fileMsg = runtime.messages.find(x => x.id === id);
          runtime.download(fileMsg).then(() => {
            setStatus(s => [...s, `下载完成 → ./${fileMsg.file.name}`]);
          }).catch(e => {
            setStatus(s => [...s, `下载失败: ${e.message}`]);
          });
          break;
        }
      }
    }
  });

  const onSubmit = async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput('');
    if (existsSync(trimmed)) {
      const r = await runtime.sendFile(trimmed);
      setStatus(s => [...s, r.ok ? `已发送文件 ${trimmed}` : `发送失败: ${r.msg}`]);
    } else {
      await runtime.sendText(trimmed);
    }
  };

  return h(Box, { flexDirection: 'column' },
    h(Box, null,
      h(Text, { bold: true, color: 'green' }, `LAN Share — ${runtime.nodes.length} 台设备在线`)),
    h(Box, { flexDirection: 'column', marginTop: 1 },
      h(Messages, { messages: runtime.messages, fileSeq, status })),
    h(Box, { marginTop: 1 },
      h(Text, { color: 'gray' }, '输入文本或文件路径回车发送 · ↑/↓滚动 · 数字下载 · q退出')),
    h(Box, null,
      h(Text, { color: 'gray' }, '› '),
      h(TextInput, { value: input, onChange: setInput, onSubmit })));
}

export function renderUI(runtime) {
  return render(h(App, { runtime }));
}
