# cursor-agent-proxy

English version: [README.en.md](README.en.md)

`cursor-agent-proxy` 是一个 `cursor-agent` 启动 wrapper，用来在受限网络中强制 Cursor Agent 的 Node HTTP/2 连接走 HTTP 代理。

## 解决什么问题

在公司网络、堡垒机、CI 或受限出口环境里，`cursor-agent` 可能可以登录 Cursor，但在使用 Anthropic 相关模型时失败，或者在 Cursor Agent 的流式通道上一直连不上。

这种情况通常不是 API key 或模型权限本身的问题，而是普通 `HTTP_PROXY` / `HTTPS_PROXY` 环境变量没有覆盖到 `cursor-agent` 内部的 Node HTTP/2 连接。

这个工具会：

- 设置 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`、`NO_PROXY` 及对应小写变量。
- 设置 `NODE_USE_ENV_PROXY=1`。
- 通过 `NODE_OPTIONS --import` 预加载 HTTP/2 CONNECT shim。
- 最后把所有参数原样转交给真正的 `cursor-agent`。

## 适用场景

- 直接运行 `cursor-agent` 时，Opus / Anthropic 相关模型请求失败。
- `cursor-agent status` 正常，但 `--print` 请求模型时卡住或报网络错误。
- 普通代理环境变量对 agent stream / HTTP/2 通道不生效。
- 需要把 `cursor-agent` 强制固定走企业 HTTP 代理。
- 想替换本机 `cursor-agent` 命令，同时仍跟随 Cursor Agent 官方版本更新。

## 安装

克隆后创建本地配置：

```bash
cp config.env.example config.env
$EDITOR config.env
```

至少配置代理地址：

```bash
CURSOR_AGENT_PROXY=http://proxy.example:8080
CURSOR_AGENT_NO_PROXY=127.0.0.1,localhost
```

## 临时验证

先不替换系统里的 `cursor-agent`，直接运行 wrapper：

```bash
./bin/cursor-agent-proxy status
```

用 Opus 做一次 smoke test：

```bash
./bin/cursor-agent-proxy \
  --print --mode ask --trust \
  --model claude-opus-4-8 \
  "Reply exactly: proxy-smoke-ok"
```

如果你的账号可用模型 ID 不同，先查看模型列表：

```bash
./bin/cursor-agent-proxy models
```

## 替换本机 `cursor-agent`

验证通过后，可以让日常的 `cursor-agent` 命令直接走这个 wrapper：

```bash
./scripts/install-local
```

之后照常使用：

```bash
cursor-agent status
cursor-agent --print --mode ask --trust --model claude-opus-4-8 "hello"
```

恢复原始链接：

```bash
./scripts/uninstall-local
```

## Cursor Agent 更新

wrapper 默认会从 `~/.local/share/cursor-agent/versions` 自动选择最新的官方 `cursor-agent` 可执行文件，所以 Cursor Agent 正常更新后，下次启动会自动使用新版本。

如果 Cursor Agent 的更新过程覆盖了 `~/.local/bin/cursor-agent` 链接，再运行一次安装脚本即可：

```bash
./scripts/install-local
```

## 配置项

- `CURSOR_AGENT_PROXY`：HTTP 代理地址，会用于 HTTP、HTTPS 和 ALL proxy 变量。
- `CURSOR_AGENT_NO_PROXY`：不走代理的 host 列表，逗号分隔。
- `CURSOR_AGENT_VERSIONS_DIR`：Cursor Agent 官方版本目录，默认 `~/.local/share/cursor-agent/versions`。
- `CURSOR_AGENT_BIN`：固定使用某个真实 `cursor-agent` 可执行文件；设置后会关闭自动选择最新版本。
- `CURSOR_AGENT_PROXY_CONFIG`：指定其它配置文件路径，默认读取项目内 `config.env`。
- `CURSOR_AGENT_HTTP2_PROXY=0`：关闭 HTTP/2 CONNECT shim，只保留普通代理环境变量。

## 限制

- 目前支持 `http://` 代理，并通过 HTTP `CONNECT` 建立到 Cursor 后端的 TLS / HTTP/2 通道。
- 代理需要允许连接 Cursor 后端域名，例如 `api2.cursor.sh` 和 `*.cursor.sh`。
- 当前 shim 不会自动添加 `Proxy-Authorization`，需要认证的代理暂不支持。
