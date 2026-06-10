# cursor-agent-proxy

`cursor-agent-proxy` is a small wrapper that launches `cursor-agent` behind an
HTTP proxy and forces Cursor Agent's Node HTTP/2 traffic through that proxy.

## 中文说明

在某些公司网络、堡垒机、CI 环境或受限出口环境中，`cursor-agent` 可能能
登录 Cursor，但在使用 Anthropic 相关模型或需要连接 Cursor 后端流式通道时
失败。这类问题通常不是 API key 或模型权限本身的问题，而是 `cursor-agent`
内部的 Node HTTP/2 连接没有按预期走企业代理。

这个工具用于把 `cursor-agent` 包一层启动：

- 统一设置 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`、`NO_PROXY`
- 启用 `NODE_USE_ENV_PROXY=1`
- 通过 `NODE_OPTIONS --import` 预加载 HTTP/2 CONNECT shim
- 最后把所有参数原样交给真正的 `cursor-agent`

适合的场景：

- 直接运行 `cursor-agent` 时，某些 Anthropic 模型请求失败或一直连不上。
- 普通代理环境变量对 `cursor-agent` 不生效，尤其是 agent stream / HTTP/2 通道。
- 希望把 `cursor-agent` 强制固定走企业 HTTP 代理。
- 希望替换本机 `cursor-agent` 命令，但仍自动跟随 Cursor Agent 官方版本更新。

It bootstraps the same approach validated in `domain_agent`:

- exports `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`, and lowercase variants
- exports `NODE_USE_ENV_PROXY=1`
- preloads `lib/cursor_http2_proxy_patch.mjs` through `NODE_OPTIONS`
- execs the real `cursor-agent` with all original arguments

Use it when normal `cursor-agent` networking is not enough, especially when
Anthropic-backed model requests or Cursor Agent streaming connections must be
forced through an outbound HTTP proxy.

## Quick Start

```bash
/repo/root/cursor-agent-proxy/bin/cursor-agent-proxy status
```

Run a smoke test:

```bash
/repo/root/cursor-agent-proxy/bin/cursor-agent-proxy \
  --print --mode ask --trust \
  --model claude-opus-4-8 \
  "Reply exactly: proxy-smoke-ok"
```

## Configure

The wrapper reads `config.env` by default. Start from the example file:

```bash
cp config.env.example config.env
$EDITOR config.env
```

You can also override values per command:

```bash
CURSOR_AGENT_PROXY=http://proxy.example:8080 \
CURSOR_AGENT_NO_PROXY=127.0.0.1,localhost,.example.com \
/repo/root/cursor-agent-proxy/bin/cursor-agent-proxy status
```

Useful environment variables:

- `CURSOR_AGENT_PROXY`: proxy URL used for HTTP, HTTPS, and ALL proxy variables.
- `CURSOR_AGENT_NO_PROXY`: comma-separated no-proxy hosts.
- `CURSOR_AGENT_VERSIONS_DIR`: official Cursor Agent versions directory. Defaults to `~/.local/share/cursor-agent/versions`.
- `CURSOR_AGENT_BIN`: pin a specific real `cursor-agent` binary. When unset, the wrapper auto-selects the latest executable under `CURSOR_AGENT_VERSIONS_DIR`.
- `CURSOR_AGENT_PROXY_CONFIG`: alternate env file path. Defaults to this project's `config.env`.
- `CURSOR_AGENT_HTTP2_PROXY=0`: disable the HTTP/2 CONNECT shim.

## 中文快速使用

创建本地配置：

```bash
cp config.env.example config.env
$EDITOR config.env
```

临时验证：

```bash
/repo/root/cursor-agent-proxy/bin/cursor-agent-proxy status
/repo/root/cursor-agent-proxy/bin/cursor-agent-proxy \
  --print --mode ask --trust \
  --model claude-opus-4-8 \
  "Reply exactly: proxy-smoke-ok"
```

这里的 `--model claude-opus-4-8` 用来显式验证 Opus 模型请求也会经过
wrapper 注入的代理通路。如果你的账号可用模型 ID 不同，可以先运行
`cursor-agent models` 查看再替换。

如果验证通过，可以替换本机 `cursor-agent`：

```bash
/repo/root/cursor-agent-proxy/scripts/install-local
```

之后直接使用原命令即可：

```bash
cursor-agent status
cursor-agent --print --mode ask --trust --model claude-opus-4-8 "hello"
```

## Replace `cursor-agent`

To make `cursor-agent` use this wrapper directly:

```bash
/repo/root/cursor-agent-proxy/scripts/install-local
```

Then run:

```bash
cursor-agent status
cursor-agent --print --mode ask --trust --model claude-opus-4-8 "Reply exactly: proxy-smoke-ok"
```

The wrapper auto-selects the latest official Cursor Agent executable under
`~/.local/share/cursor-agent/versions`, so normal Cursor Agent updates are picked
up on the next launch. The installer records the original `cursor-agent` target
in local `config.env` as `ORIGINAL_CURSOR_AGENT_BIN` for rollback only, then
replaces `~/.local/bin/cursor-agent` with a symlink to `bin/cursor-agent-proxy`.

If a Cursor Agent update overwrites the symlink, run the installer again:

```bash
/repo/root/cursor-agent-proxy/scripts/install-local
```

To restore the original symlink:

```bash
/repo/root/cursor-agent-proxy/scripts/uninstall-local
```

## Limitations

The HTTP/2 patch supports plain `http://` proxies that allow `CONNECT` tunneling to Cursor backend hosts. It does not currently add `Proxy-Authorization` headers for authenticated proxies.
