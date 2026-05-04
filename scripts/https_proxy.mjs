// Minimal HTTPS -> HTTP proxy with WebSocket upgrade support.
// Replaces local-ssl-proxy (broken on Node 25). Args: --source --target --cert --key
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import net from "node:net";
import { URL } from "node:url";
import { argv } from "node:process";

const args = Object.fromEntries(
  argv
    .slice(2)
    .reduce((acc, v, i, a) => (v.startsWith("--") ? acc.concat([[v.slice(2), a[i + 1]]]) : acc), []),
);

const source = parseInt(args.source ?? "5443", 10);
const target = parseInt(args.target ?? "5173", 10);
const hostname = args.hostname ?? "0.0.0.0";
const targetHost = "127.0.0.1";

const server = https.createServer({
  key: fs.readFileSync(args.key),
  cert: fs.readFileSync(args.cert),
});

server.on("request", (req, res) => {
  const opts = {
    hostname: targetHost,
    port: target,
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: `${targetHost}:${target}` },
  };
  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`proxy error: ${err.message}`);
  });
  req.pipe(proxyReq);
});

// WebSocket upgrade (Vite HMR uses wss).
server.on("upgrade", (req, clientSocket, head) => {
  const upstream = net.connect(target, targetHost, () => {
    const lines = [
      `${req.method} ${req.url} HTTP/${req.httpVersion}`,
      ...Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`),
      "",
      "",
    ];
    upstream.write(lines.join("\r\n"));
    if (head && head.length) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  const onErr = () => {
    clientSocket.destroy();
    upstream.destroy();
  };
  upstream.on("error", onErr);
  clientSocket.on("error", onErr);
});

server.listen(source, hostname, () => {
  console.log(`https proxy listening on ${hostname}:${source} -> ${targetHost}:${target}`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
