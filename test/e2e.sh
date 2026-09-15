#!/bin/bash
# @baique/share TUI 端到端验证
# 用 PTY(script) + 模拟按键 + 抓屏断言，验证真实终端交互行为
set -u
cd "$(dirname "$0")/.."
APP=/Users/baique/share/bin/share.js
UI=/tmp/e2e_ui.log
PASS=0; FAIL=0

assert() { # name pattern  在整个 log 中匹配（先剥离 ANSI 色码）
  local name="$1" pat="$2"
  if sed $'s/\x1b\\[[0-9;?]*[A-Za-z]//g' "$UI" | grep -qaE "$pat"; then echo "PASS: $name"; PASS=$((PASS+1)); else echo "FAIL: $name"; FAIL=$((FAIL+1)); fi
}
last_assert() { # name pattern  在 log 末尾(最近渲染)匹配（先剥离 ANSI 色码）
  local name="$1" pat="$2"
  if tail -n 8 "$UI" | sed $'s/\x1b\\[[0-9;?]*[A-Za-z]//g' | grep -qaE "$pat"; then echo "PASS: $name"; PASS=$((PASS+1)); else echo "FAIL: $name"; FAIL=$((FAIL+1)); fi
}
run_ui() { # 按键序列(printf 字符串列表)
  rm -f "$UI"
  ( sleep 1.2; eval "$1"; printf "\003"; sleep 0.4 ) | script -q "$UI" node "$APP" 2>/dev/null
}

echo "=== 1. 启动 / 光标 / 输入 / 退格 ==="
run_ui 'printf "abc"; sleep 0.3; printf "\x7f"; sleep 0.2; printf "\x7f"; sleep 0.3'
assert    "1-标题渲染"        "LAN Share"
assert    "1-光标字符▌出现"   "▌"
assert    "1-连续输入abc上屏" "abc"
last_assert "1-退格×2后剩a"    "› a"

echo "=== 2. Ctrl+J 多行输入 + 回车发送 ==="
run_ui 'printf "AB"; sleep 0.2; printf "\n"; sleep 0.2; printf "CD"; sleep 0.3; printf "\r"; sleep 0.4'
last_assert "2-多行消息AB"     "AB"
last_assert "2-多行消息CD换行" "CD"
last_assert "2-发送后输入框清空" "›"

echo "=== 3. ↑ 直接进选择 + 字符回输入 ==="
run_ui 'printf "\x1b[A"; sleep 0.4; printf "h"; sleep 0.4'
assert    "3-↑进入选择模式"   "\[选择\]"
assert    "3-选择模式提示"    "字符回输入"
last_assert "3-按h回输入并上屏" "› h"

echo "=== 4. 双实例：文本/文件收发 + 选择复制/下载 ==="
printf 'e2e 演示文件内容' > /tmp/e2e_demo.txt
node -e "
import('/Users/baique/share/src/index.js').then(async (m) => {
  const a = await m.createApp();
  await new Promise(r => setTimeout(r, 2500));
  a.runtime.sendText('e2e中文消息');
  a.runtime.sendFile('/tmp/e2e_demo.txt');
  setTimeout(() => process.exit(0), 30000);
}).catch(e => { console.error(e); process.exit(1); });
" > /tmp/e2e_a.log 2>&1 &
APID=$!
sleep 1
mkdir -p /tmp/e2e_dl
cd /tmp/e2e_dl
rm -f /tmp/e2e_ui.log
# ↑ 选中文本(最新-1)复制 → ↓ 选中文件(最新)下载
( sleep 8; printf "\x1b[A"; sleep 0.5; printf "c"; sleep 0.5; printf "\x1b[B"; sleep 0.4; printf "d"; sleep 1.5; printf "\003"; sleep 0.4 ) | script -q /tmp/e2e_ui.log node "$APP" 2>/dev/null
cd /Users/baique/share
assert "4-收到文本消息"    "e2e中文消息"
assert "4-收到文件消息"    "e2e_demo.txt"
assert "4-复制状态提示"    "已复制"
CLIP=$(pbpaste)
if [ "$CLIP" = "e2e中文消息" ]; then echo "PASS: 4-剪贴板内容正确"; PASS=$((PASS+1)); else echo "FAIL: 4-剪贴板内容=$CLIP"; FAIL=$((FAIL+1)); fi
if [ -f "/tmp/e2e_dl/e2e_demo.txt" ] && grep -q "e2e 演示文件内容" "/tmp/e2e_dl/e2e_demo.txt"; then echo "PASS: 4-下载文件存在且内容正确"; PASS=$((PASS+1)); else echo "FAIL: 4-下载文件缺失"; FAIL=$((FAIL+1)); fi
rm -rf /tmp/e2e_dl /tmp/e2e_demo.txt /tmp/e2e_ui.log /tmp/e2e_a.log
kill $APID 2>/dev/null

echo "=== 5. Ctrl+C 干净退出 ==="
rm -f /tmp/e2e_ui.log
( sleep 1.2; printf "\003"; sleep 0.4 ) | script -q /tmp/e2e_ui.log node "$APP" 2>/dev/null
if [ $? -eq 0 ]; then echo "PASS: 5-Ctrl+C 干净退出"; PASS=$((PASS+1)); else echo "FAIL: 5-Ctrl+C 退出码=$?"; FAIL=$((FAIL+1)); fi
rm -f /tmp/e2e_ui.log
pkill -f "bin/share.js" 2>/dev/null
pkill -f "e2e_demo" 2>/dev/null

echo
echo "====== e2e 结果: $PASS 通过 / $FAIL 失败 ======"
[ $FAIL -eq 0 ]
