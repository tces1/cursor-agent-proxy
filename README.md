# cursor-agent-proxy

Wrapper for launching `cursor-agent` behind an HTTP proxy.

It bootstraps the same approach validated in `domain_agent`:

- exports `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`, and lowercase variants
- exports `NODE_USE_ENV_PROXY=1`
- preloads `lib/cursor_http2_proxy_patch.mjs` through `NODE_OPTIONS`
- execs the real `cursor-agent` with all original arguments

## Quick Start

```bash
/repo/root/cursor-agent-proxy/bin/cursor-agent-proxy status
```

Run a smoke test:

```bash
/repo/root/cursor-agent-proxy/bin/cursor-agent-proxy \
  --print --mode ask --trust \
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

## Replace `cursor-agent`

To make `cursor-agent` use this wrapper directly:

```bash
/repo/root/cursor-agent-proxy/scripts/install-local
```

Then run:

```bash
cursor-agent status
cursor-agent --print --mode ask --trust "Reply exactly: proxy-smoke-ok"
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
