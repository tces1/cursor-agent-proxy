import http2 from "node:http2";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";
import { Duplex } from "node:stream";

const PATCH_MARKER = Symbol.for("cursor_agent_proxy.cursor_http2_proxy_patch");
const HEADER_END = Buffer.from([13, 10, 13, 10]);
const CRLF = String.fromCharCode(13, 10);

function proxyUrl() {
  if (process.env.CURSOR_AGENT_HTTP2_PROXY === "0") {
    return null;
  }
  const value = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
  if (!value || !value.startsWith("http://")) {
    return null;
  }
  return new URL(value);
}

class HttpConnectTlsDuplex extends Duplex {
  constructor(targetHost, targetPort, proxy) {
    super();
    this.targetHost = targetHost;
    this.targetPort = targetPort;
    this.proxy = proxy;
    this.pendingWrites = [];
    this.ready = false;
    this.rawSocket = null;
    this.tlsSocket = null;
    this.connect();
  }

  connect() {
    const raw = net.connect(Number(this.proxy.port || 80), this.proxy.hostname);
    this.rawSocket = raw;
    raw.setNoDelay?.(true);
    raw.once("connect", () => {
      raw.write(
        [
          `CONNECT ${this.targetHost}:${this.targetPort} HTTP/1.1`,
          `Host: ${this.targetHost}:${this.targetPort}`,
          "Proxy-Connection: Keep-Alive",
          "",
          "",
        ].join(CRLF),
      );
    });

    let response = Buffer.alloc(0);
    const onData = (chunk) => {
      response = Buffer.concat([response, chunk]);
      const marker = response.indexOf(HEADER_END);
      if (marker === -1) {
        return;
      }
      raw.off("data", onData);

      const header = response.slice(0, marker).toString("latin1");
      const firstLine = (header.split(CRLF)[0] || "").trim();
      if (!(firstLine.startsWith("HTTP/1.1 200") || firstLine.startsWith("HTTP/1.0 200"))) {
        this.destroy(new Error(`Proxy CONNECT failed: ${firstLine}`));
        return;
      }

      const secure = tls.connect(
        {
          socket: raw,
          servername: this.targetHost,
          ALPNProtocols: ["h2"],
        },
        () => {
          this.tlsSocket = secure;
          this.rawSocket = null;
          this.ready = true;
          for (const item of this.pendingWrites.splice(0)) {
            secure.write(item.chunk, item.encoding, item.callback);
          }
        },
      );
      secure.on("data", (data) => this.push(data));
      secure.once("end", () => this.push(null));
      secure.once("error", (error) => this.destroy(error));
    };

    raw.on("data", onData);
    raw.once("error", (error) => this.destroy(error));
  }

  _read() {}

  _write(chunk, encoding, callback) {
    if (this.ready && this.tlsSocket) {
      this.tlsSocket.write(chunk, encoding, callback);
      return;
    }
    this.pendingWrites.push({ chunk: Buffer.from(chunk), encoding, callback });
  }

  _final(callback) {
    if (this.tlsSocket) {
      this.tlsSocket.end(callback);
      return;
    }
    callback();
  }

  _destroy(error, callback) {
    this.tlsSocket?.destroy();
    this.rawSocket?.destroy();
    callback(error);
  }

  setNoDelay() {
    return this;
  }

  setKeepAlive() {
    return this;
  }

  setTimeout() {
    return this;
  }

  ref() {
    this.tlsSocket?.ref?.();
    this.rawSocket?.ref?.();
    return this;
  }

  unref() {
    this.tlsSocket?.unref?.();
    this.rawSocket?.unref?.();
    return this;
  }
}

if (!globalThis[PATCH_MARKER]) {
  const originalConnect = http2.connect;
  http2.connect = function patchedHttp2Connect(authority, options = {}, listener) {
    const proxy = proxyUrl();
    if (!proxy) {
      return originalConnect.call(this, authority, options, listener);
    }
    const target = new URL(String(authority));
    if (target.protocol !== "https:") {
      return originalConnect.call(this, authority, options, listener);
    }
    return originalConnect.call(
      this,
      authority,
      {
        ...options,
        createConnection: () =>
          new HttpConnectTlsDuplex(target.hostname, Number(target.port || 443), proxy),
      },
      listener,
    );
  };
  syncBuiltinESMExports();
  globalThis[PATCH_MARKER] = true;
}
