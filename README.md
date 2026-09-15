# @baique/share

局域网聊天室式共享终端。`npx @baique/share` 启动，同一局域网内自动发现设备；发文本即广播，发文件人人可下载。无中心服务器，点对点直连。

## 使用

```bash
npx @baique/share                  # 自动发现同广播域设备
npx @baique/share -c 192.168.1.20  # 直连指定 IP（跨网段/兜底）
```

**输入框**（默认焦点）：
- 输入文本回车 → 广播文本；输入存在的文件路径回车 → 广播文件
- `Ctrl+J` 换行（多行文本）
- `↑`/`↓` 进入消息选择

**选择模式**：
- `↑`/`↓` 移动高亮选中消息
- `c` 复制选中文本到系统剪贴板
- `d` 下载选中文件到当前目录（重名自动加 `(1)` 后缀）
- 按任意字符自动回输入框并输入；`q` 退出

其他：`Ctrl+C` 退出，消息保留最近 30 分钟，新加入设备自动同步历史。

## 平台与网络

- macOS / Windows（Node ≥ 18）
- 发现基于 mDNS（UDP 组播 5353），仅同广播域（同一 WiFi / 同一局域网）有效
- 跨广播域（如 WiFi ↔ 有线 VLAN 分隔）用 `-c <ip>` 直连
- 复制依赖系统剪贴板命令：macOS `pbcopy`、Windows `clip`（系统自带）

## 开发

```bash
npm install
npm test          # 单元测试
./test/e2e.sh     # TUI 端到端测试（PTY 模拟按键）
```

## License

[MIT](LICENSE) © [baique](https://github.com/baique)
