# cursor-agent-proxy

`cursor-agent-proxy` is a wrapper for launching `cursor-agent` behind an HTTP proxy. It forces Cursor Agent's Node HTTP/2 connections through the proxy by preloading an HTTP/2 CONNECT shim.

## When To Use It

Use this when `cursor-agent` can authenticate but model requests fail or hang in restricted networks, especially for Anthropic-backed models such as Opus.

Typical symptoms:

- `cursor-agent status` works, but `cursor-agent --print ...` fails.
- Normal `HTTP_PROXY` / `HTTPS_PROXY` variables do not affect Cursor Agent streaming connections.
- Agent stream or HTTP/2 traffic must be forced through an enterprise HTTP proxy.

## How It Works

The wrapper:

- exports `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`, and lowercase variants
- exports `NODE_USE_ENV_PROXY=1`
- preloads `lib/cursor_http2_proxy_patch.mjs` through `NODE_OPTIONS`
- execs the real `cursor-agent` with all original arguments

## Configure

Create a local config file:

```bash
cp config.env.example config.env
$EDITOR config.env
```

Set at least:

```bash
CURSOR_AGENT_PROXY=http://proxy.example:8080
CURSOR_AGENT_NO_PROXY=127.0.0.1,localhost
```

## Smoke Test

Run the wrapper directly:

```bash
./bin/cursor-agent-proxy status
./bin/cursor-agent-proxy \
  --print --mode ask --trust \
  --model claude-opus-4-8 \
  "Reply exactly: proxy-smoke-ok"
```

If your account uses a different model ID, check:

```bash
./bin/cursor-agent-proxy models
```

## Replace `cursor-agent`

After the smoke test passes:

```bash
./scripts/install-local
```

Then use `cursor-agent` normally:

```bash
cursor-agent status
cursor-agent --print --mode ask --trust --model claude-opus-4-8 "hello"
```

Restore the original symlink:

```bash
./scripts/uninstall-local
```

## Updates

By default, the wrapper auto-selects the latest official executable under `~/.local/share/cursor-agent/versions`, so normal Cursor Agent updates are picked up on the next launch.

If an update overwrites the `~/.local/bin/cursor-agent` symlink, run `./scripts/install-local` again.

## Limitations

- Supports plain `http://` proxies that allow `CONNECT` tunneling.
- The proxy must allow Cursor backend hosts such as `api2.cursor.sh` and `*.cursor.sh`.
- Authenticated proxies that require `Proxy-Authorization` are not handled by the shim yet.
