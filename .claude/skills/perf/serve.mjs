#!/usr/bin/env node
// serve.mjs — static server for A/B-ing two production builds locally, over the
// SAME wire protocol the real site uses. Zero npm deps.
//
//   node serve.mjs --dir dist/public --port 5301               # HTTP/1.1
//   node serve.mjs --dir dist/public --port 5301 --http2       # HTTP/2 over TLS
//
// Why the --http2 flag exists, and why it is not optional in practice:
// HTTP/1.1 caps a browser at ~6 connections per origin. HTTP/2 and HTTP/3 do
// not. Any experiment that changes HOW MANY resources are requested at once -
// preload hints, chunk splitting, sprite vs individual assets - will produce a
// DIFFERENT VERDICT on the two transports, because on h1 the connection cap
// silently throttles the extra requests for you. Check the real site's protocol
// with probe.mjs first, then match it here. Getting this wrong is the single
// most likely way to ship a regression that measured as a win.
//
// Known limit: node's http2 does NOT implement stream prioritization. A real CDN
// usually does. So any conclusion that depends on request PRIORITY
// (fetchpriority, <link rel=preload> ordering) is pessimistic here and has to be
// confirmed against the deployed site.
//
// Serves brotli for compressible types so throttled measurements see
// production-shaped wire bytes instead of raw ones, and falls back to
// index.html for unknown paths so client-side routes are measurable.
import http from 'node:http';
import http2 from 'node:http2';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const root = path.resolve(String(arg('dir', 'dist/public')));
const port = Number(arg('port', 5301));
const useH2 = arg('http2', false) === true;
const spa = arg('no-spa', false) !== true;
if (!fs.existsSync(root)) { console.error(`no such directory: ${root}`); process.exit(1); }

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
  '.webm': 'video/webm', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.txt': 'text/plain',
  '.xml': 'application/xml', '.map': 'application/json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml']);

// Compressing a 700 KB bundle per request would make the server, not the
// emulated network, the bottleneck. Compress once, keep it.
const brCache = new Map();
function brotli(key, buf) {
  if (!brCache.has(key)) {
    brCache.set(key, zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }));
  }
  return brCache.get(key);
}

// A throwaway localhost cert, generated on first use and reused after. Chrome is
// driven with --ignore-certificate-errors by probe.mjs, so trust is irrelevant;
// TLS is here only because browsers refuse cleartext h2.
function ensureCert() {
  const key = path.join(here, '.localhost-key.pem');
  const cert = path.join(here, '.localhost-cert.pem');
  if (fs.existsSync(key) && fs.existsSync(cert)) return { key, cert };
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
      '-days', '365', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    ], { stdio: 'ignore' });
  } catch (e) {
    console.error('--http2 needs openssl on PATH to mint a localhost cert.');
    console.error('Git Bash ships one on Windows; otherwise install openssl, or drop --http2');
    console.error('and accept that the measurement will not match an h2/h3 origin.');
    process.exit(1);
  }
  return { key, cert };
}

function respond(req, res, urlPath) {
  const accepts = /\bbr\b/.test(req.headers['accept-encoding'] || '');
  let file = path.join(root, urlPath);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (!spa) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    file = path.join(root, 'index.html');
  }
  const ext = path.extname(file).toLowerCase();
  const raw = fs.readFileSync(file);
  const useBr = COMPRESSIBLE.has(ext) && accepts;
  const body = useBr ? brotli(file, raw) : raw;
  res.writeHead(200, {
    'content-type': TYPES[ext] || 'application/octet-stream',
    // no-store, because a cached asset between two arms of an A/B is a silently
    // invalid measurement.
    'cache-control': 'no-store',
    'content-length': body.length,
    ...(useBr ? { 'content-encoding': 'br' } : {}),
  });
  res.end(body);
}

const handler = (req, res) => {
  let urlPath = '/';
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch {}
  respond(req, res, urlPath);
};

if (useH2) {
  const { key, cert } = ensureCert();
  http2.createSecureServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert), allowHTTP1: true }, handler)
    .listen(port, () => console.log(`h2  serving ${root} on https://127.0.0.1:${port}`));
} else {
  http.createServer(handler)
    .listen(port, () => console.log(`h1  serving ${root} on http://127.0.0.1:${port}`));
}
