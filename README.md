# @baique/share

局域网聊天室式共享终端。`npx @baique/share` 启动，同一局域网内自动发现设备；发文本即广播，发文件人人可下载。

## 使用

```bash
npx @baique/share              # 自动发现同广播域设备
npx @baique/share -c 192.168.1.20      # 直连指定 IP（跨网段/兜底）
```

- 输入文本回车 → 广播文本；输入存在的文件路径回车 → 广播文件
- `Tab` 切换到消息选择：`↑/↓` 选中消息，`c` 复制选中文本到剪贴板，`d` 下载选中文件
- `Tab`/`Esc` 回输入框，`Ctrl+C` 或选择模式 `q` 退出
- 消息保留最近 30 分钟，新加入设备自动同步历史

## 平台与网络

- macOS / Windows（Node ≥ 18）
- 发现基于 mDNS（UDP 组播 5353），仅同广播域（同一 WiFi / 同一局域网）有效
- 跨广播域（如 WiFi ↔ 有线 VLAN 分隔）用 `-c <ip>` 直连
- 复制文本依赖系统剪贴板命令：macOS `pbcopy`、Windows `clip`（均系统自带）

## 开发

```bash
npm install
npm test
```
