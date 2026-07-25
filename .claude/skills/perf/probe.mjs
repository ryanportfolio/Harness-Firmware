#!/usr/bin/env node
// probe.mjs — Lighthouse-shaped performance probe driven by headless Chrome over
// the DevTools Protocol. Zero npm deps (Node 21+ for global WebSocket; verified
// on Node 24). Works against any URL: production, staging, or a local server.
//
//   node probe.mjs --url https://example.com/
//   node probe.mjs --url https://example.com/ --runs 10          # distribution
//   node probe.mjs --url https://example.com/ --waterfall        # request waves
//   node probe.mjs --url https://example.com/ --json out.json    # machine-readable
//
// Reports, in one pass: the wire PROTOCOL actually negotiated (h1/h2/h3 — curl
// lies about this, see SKILL.md), Core Web Vitals with the LCP element named,
// the request waterfall grouped into waves with initiator attribution, bytes by
// type and origin, unused JS from V8 precise coverage, long tasks, and any
// failed request.
//
// Exports probe() so ab.mjs can drive it without re-spawning a CLI per run.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Lighthouse's own emulation presets. Matching them is what makes local numbers
// comparable to a PageSpeed Insights run instead of merely internally consistent.
export const PROFILES = {
  mobile: {
    width: 412, height: 823, dsf: 1.75, mobile: true, cpu: 4,
    latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8,
    ua: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  },
  desktop: {
    width: 1350, height: 940, dsf: 1, mobile: false, cpu: 1,
    latency: 40, download: (10 * 1024 * 1024) / 8, upload: (10 * 1024 * 1024) / 8,
    ua: null,
  },
  // No throttling at all. Useful only for "does it work", never for comparing
  // two builds: an unthrottled load hides exactly the round trips you are hunting.
  none: { width: 1350, height: 940, dsf: 1, mobile: false, cpu: 1, latency: 0, download: -1, upload: -1, ua: null },
};

export function findChrome() {
  const c = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  for (const p of c) if (existsSync(p)) return p;
  throw new Error('Chrome not found - set CHROME_BIN to the executable path');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); this.events = []; }
  open() {
    return new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = (e) => rej(new Error('ws ' + (e.message || 'error')));
      this.ws.onmessage = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        } else if (msg.method) this.events.push(msg);
      };
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async waitEvent(method, timeout = 45000) {
    const s = Date.now();
    while (Date.now() - s < timeout) {
      const hit = this.events.find((e) => e.method === method);
      if (hit) return hit;
      await sleep(50);
    }
    return null;
  }
  find(method) { return this.events.filter((e) => e.method === method); }
  close() { try { this.ws.close(); } catch {} }
}

// Injected before any page script so the observers are installed ahead of the
// entries they need to catch. buffered:true covers anything that beat us anyway.
const OBSERVER = `
window.__perf = { lcp: null, cls: 0, longTasks: [], shifts: [] };
const label = (n) => {
  if (!n || !n.tagName) return '?';
  const cls = (n.className && typeof n.className === 'string')
    ? '.' + n.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
  return n.tagName + (n.id ? '#' + n.id : '') + cls;
};
try {
  new PerformanceObserver((l) => {
    const e = l.getEntries().at(-1);
    if (e) window.__perf.lcp = { t: e.startTime, size: e.size, url: e.url || null, el: label(e.element) };
  }).observe({ type: 'largest-contentful-paint', buffered: true });
} catch {}
try {
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__perf.cls += e.value;
      window.__perf.shifts.push({ t: e.startTime, v: e.value, srcs: (e.sources || []).map((s) => label(s.node)).slice(0, 3) });
    }
  }).observe({ type: 'layout-shift', buffered: true });
} catch {}
try {
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__perf.longTasks.push({ t: e.startTime, d: e.duration });
  }).observe({ type: 'longtask', buffered: true });
} catch {}
`;

function typeOf(url, mime) {
  const u = url || '';
  if (/\.m?js(\?|$)/i.test(u) || /javascript/i.test(mime)) return 'js';
  if (/\.css(\?|$)/i.test(u) || /text\/css/i.test(mime)) return 'css';
  if (/^image\//i.test(mime) || /\.(png|jpe?g|webp|avif|gif|svg|ico)(\?|$)/i.test(u)) return 'image';
  if (/font/i.test(mime) || /\.(woff2?|ttf|otf)(\?|$)/i.test(u)) return 'font';
  if (/^audio\//i.test(mime) || /\.(mp3|ogg|wav)(\?|$)/i.test(u)) return 'audio';
  if (/^video\//i.test(mime) || /\.(mp4|webm)(\?|$)/i.test(u)) return 'video';
  if (/json/i.test(mime)) return 'xhr/json';
  if (/text\/html/i.test(mime)) return 'document';
  return 'other';
}

// Requests cluster into "waves": a burst, then a stall while the browser parses
// and executes what it just got, then the next burst of URLs it only just
// learned about. Counting the waves is how you see a dependency chain that no
// single metric names.
function toWaves(rows, gapMs = 400) {
  const sorted = rows.slice().sort((a, b) => a.at - b.at);
  const waves = [];
  for (const r of sorted) {
    const last = waves[waves.length - 1];
    if (!last || r.at - last.end > gapMs) waves.push({ start: r.at, end: r.at, n: 1, kb: r.kb, items: [r] });
    else { last.end = r.at; last.n++; last.kb += r.kb; last.items.push(r); }
  }
  return waves;
}

/**
 * One measured page load. Spawns its own Chrome, kills it on the way out.
 * Returns the full report object.
 */
export async function probe({ url, profile = 'mobile', settleMs = 9000, port } = {}) {
  const P = PROFILES[profile];
  if (!P) throw new Error(`unknown profile "${profile}" (mobile | desktop | none)`);
  const dbgPort = port || 9400 + (process.pid % 300) + Math.floor(Math.random() * 60);
  const chromeBin = findChrome();
  const userDir = mkdtempSync(join(tmpdir(), 'perf-probe-'));
  // --ignore-certificate-errors so a local https rig with a self-signed cert
  // (the only way to test h2/h3 locally) is measurable without ceremony.
  const chrome = spawn(chromeBin, [
    '--headless=new', '--ignore-certificate-errors', '--disable-gpu', '--no-sandbox',
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    `--remote-debugging-port=${dbgPort}`, `--user-data-dir=${userDir}`, 'about:blank',
  ], { stdio: 'ignore' });

  let cdp;
  try {
    let target;
    for (let i = 0; i < 200; i++) {
      try {
        const list = await fetch(`http://127.0.0.1:${dbgPort}/json`).then((r) => r.json());
        target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (target) break;
      } catch {}
      await sleep(100);
    }
    if (!target) throw new Error('Chrome debug endpoint never came up');

    cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: false, detailed: true });

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: P.width, height: P.height, deviceScaleFactor: P.dsf, mobile: P.mobile,
      screenWidth: P.width, screenHeight: P.height,
    });
    if (P.ua) await cdp.send('Emulation.setUserAgentOverride', { userAgent: P.ua });
    if (P.mobile) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (P.download > 0) {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: P.latency, downloadThroughput: P.download, uploadThroughput: P.upload,
      });
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER });

    const wallStart = Date.now();
    await cdp.send('Page.navigate', { url });
    await cdp.waitEvent('Page.loadEventFired');
    const wallLoadMs = Date.now() - wallStart;
    await sleep(settleMs);

    const perf = (await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const nav = performance.getEntriesByType('navigation')[0] || {};
        const paints = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, p.startTime]));
        const p = window.__perf || {};
        return {
          ttfb: Math.round(nav.responseStart || 0),
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
          loadEvent: Math.round(nav.loadEventEnd || 0),
          fcp: paints['first-contentful-paint'] ? Math.round(paints['first-contentful-paint']) : null,
          lcp: p.lcp ? { ...p.lcp, t: Math.round(p.lcp.t) } : null,
          cls: Number((p.cls || 0).toFixed(4)),
          shifts: (p.shifts || []).map(s => ({ t: Math.round(s.t), v: Number(s.v.toFixed(4)), srcs: s.srcs })).sort((a,b) => b.v - a.v).slice(0, 8),
          longTasks: (p.longTasks || []).map(x => ({ t: Math.round(x.t), d: Math.round(x.d) })),
          domNodes: document.getElementsByTagName('*').length,
          rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : null,
          title: document.title || null,
          h1: document.querySelector('h1') ? document.querySelector('h1').textContent.trim().slice(0, 80) : null,
          vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
        };
      })()`,
    })).result.value;

    // encodedDataLength is the real on-wire cost; resource timing's transferSize
    // is not trustworthy cross-origin.
    const meta = new Map();
    for (const e of cdp.find('Network.responseReceived')) {
      meta.set(e.params.requestId, {
        url: e.params.response.url,
        status: e.params.response.status,
        mime: e.params.response.mimeType,
        proto: e.params.response.protocol || '(none)',
      });
    }
    const started = new Map();
    for (const e of cdp.find('Network.requestWillBeSent')) {
      if (started.has(e.params.requestId)) continue;
      const init = e.params.initiator || {};
      started.set(e.params.requestId, {
        at: Math.round(e.params.timestamp * 1000),
        initType: init.type || '?',
        initBy: (init.stack?.callFrames?.[0]?.url || init.url || '').split('/').pop() || '',
      });
    }
    const finished = [];
    for (const e of cdp.find('Network.loadingFinished')) {
      const m = meta.get(e.params.requestId);
      if (!m) continue;
      const s = started.get(e.params.requestId) || { at: 0, initType: '?', initBy: '' };
      finished.push({ ...m, ...s, bytes: e.params.encodedDataLength });
    }
    const failed = cdp.find('Network.loadingFailed')
      .filter((e) => !e.params.canceled)
      .map((e) => ({ url: meta.get(e.params.requestId)?.url || '(unknown)', err: e.params.errorText }));

    // Request timestamps are monotonic-clock seconds, not page-relative. Rebase
    // on the first request so wave offsets read as "ms after navigation start".
    const t0 = Math.min(...finished.map((r) => r.at).filter((n) => n > 0), Infinity);
    const rows = finished.map((r) => ({
      at: r.at > 0 && Number.isFinite(t0) ? r.at - t0 : 0,
      kb: Math.round(r.bytes / 1024),
      bytes: r.bytes,
      proto: r.proto,
      type: typeOf(r.url, r.mime),
      init: r.initType,
      by: r.initBy,
      url: r.url,
    }));

    const byType = {}; const byOrigin = {}; const byProto = {};
    for (const r of rows) {
      byType[r.type] = byType[r.type] || { count: 0, bytes: 0 };
      byType[r.type].count++; byType[r.type].bytes += r.bytes;
      let o = '(data/other)'; try { o = new URL(r.url).origin; } catch {}
      byOrigin[o] = byOrigin[o] || { count: 0, bytes: 0 };
      byOrigin[o].count++; byOrigin[o].bytes += r.bytes;
      byProto[r.proto] = (byProto[r.proto] || 0) + 1;
    }

    let coverage = [];
    try {
      const cov = await cdp.send('Profiler.takePreciseCoverage');
      coverage = cov.result.filter((s) => s.url && /^https?:/.test(s.url)).map((s) => {
        let total = 0;
        for (const f of s.functions) for (const r of f.ranges) total = Math.max(total, r.endOffset);
        if (!total) return null;
        const hit = new Uint8Array(total);
        for (const f of s.functions) for (const r of f.ranges) hit.fill(r.count > 0 ? 1 : 0, r.startOffset, Math.min(r.endOffset, total));
        let used = 0; for (let i = 0; i < total; i++) used += hit[i];
        return { url: s.url, total, used, unused: total - used, pctUnused: Math.round(((total - used) / total) * 100) };
      }).filter(Boolean).sort((a, b) => b.unused - a.unused);
    } catch { /* coverage is a bonus, never the reason a run fails */ }

    const fcp = perf.fcp || 0;
    const tbt = perf.longTasks.filter((x) => x.t >= fcp).reduce((a, x) => a + Math.max(0, x.d - 50), 0);
    const waves = toWaves(rows);

    return {
      url, profile,
      emulation: { cpuThrottle: P.cpu, downKbps: P.download > 0 ? Math.round((P.download * 8) / 1024) : null, rttMs: P.latency, vw: perf.vw, vh: perf.vh, dpr: perf.dpr },
      // The single most misread fact in web perf work. See SKILL.md.
      protocols: byProto,
      metrics: {
        ttfbMs: perf.ttfb, fcpMs: perf.fcp, lcpMs: perf.lcp?.t ?? null,
        lcpElement: perf.lcp?.el ?? null, lcpUrl: perf.lcp?.url ?? null,
        cls: perf.cls, tbtMs: Math.round(tbt),
        domContentLoadedMs: perf.domContentLoaded, loadEventMs: perf.loadEvent, wallLoadMs,
        domNodes: perf.domNodes, rootChildren: perf.rootChildren, title: perf.title, h1: perf.h1,
      },
      totals: { requests: rows.length, kb: Math.round(rows.reduce((a, r) => a + r.bytes, 0) / 1024) },
      waves: waves.map((w) => ({ startMs: w.start, n: w.n, kb: w.kb, sample: w.items.slice(0, 4).map((r) => r.url.split('/').pop()) })),
      waterfall: rows.sort((a, b) => a.at - b.at).map((r) => ({ atMs: r.at, kb: r.kb, type: r.type, init: r.init, by: r.by, url: r.url })),
      byType: Object.fromEntries(Object.entries(byType).sort((a, b) => b[1].bytes - a[1].bytes).map(([k, v]) => [k, { count: v.count, kb: Math.round(v.bytes / 1024) }])),
      byOrigin: Object.fromEntries(Object.entries(byOrigin).sort((a, b) => b[1].bytes - a[1].bytes).map(([k, v]) => [k, { count: v.count, kb: Math.round(v.bytes / 1024) }])),
      heaviest: rows.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 20).map((r) => ({ kb: r.kb, type: r.type, atMs: r.at, url: r.url.replace(/^https?:\/\//, '') })),
      longTasks: perf.longTasks.sort((a, b) => b.d - a.d).slice(0, 10),
      layoutShifts: perf.shifts,
      unusedJs: coverage.slice(0, 15).map((c) => ({ unusedKb: Math.round(c.unused / 1024), totalKb: Math.round(c.total / 1024), pctUnused: c.pctUnused, url: c.url.replace(/^https?:\/\//, '') })),
      unusedJsTotalKb: Math.round(coverage.reduce((a, c) => a + (c.unused || 0), 0) / 1024),
      failedRequests: failed.slice(0, 20),
    };
  } finally {
    cdp?.close();
    killTree(chrome);
  }
}

// Chrome spawns a renderer/GPU process tree; killing only the parent leaves the
// children alive. Enough leaked runs and they compete for the CPU the next
// measurement is trying to characterise - which shows up as a plausible-looking
// but completely wrong result (an 11.7s LCP on a page that measures 4.2s clean),
// not as an obvious error. Take the whole tree down.
function killTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); return; } catch {}
  }
  try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  try { child.kill('SIGKILL'); } catch {}
}

/**
 * How many stray Chrome processes are already running. A dirty machine is the
 * most common cause of a measurement that is wrong rather than merely noisy.
 */
export function strayChromeCount() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('tasklist', ['/fi', 'imagename eq chrome.exe', '/nh'], { encoding: 'utf8' });
      return (out.match(/chrome\.exe/gi) || []).length;
    }
    return execFileSync('pgrep', ['-c', '-f', 'chrome'], { encoding: 'utf8' }).trim() | 0;
  } catch { return 0; }
}

// ---- stats helpers, shared with ab.mjs -----------------------------------
export const quantile = (arr, p) => {
  const s = arr.slice().sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null;
};
export const summarize = (vals) => ({
  n: vals.length, min: Math.min(...vals), p25: quantile(vals, 0.25),
  median: quantile(vals, 0.5), p75: quantile(vals, 0.75), max: Math.max(...vals),
});

// ---- CLI ------------------------------------------------------------------
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

async function cli() {
  const url = arg('url');
  if (!url || url === true) {
    console.error('usage: node probe.mjs --url <url> [--profile mobile|desktop|none] [--runs N] [--waterfall] [--json out.json]');
    process.exitCode = 1;
    return;
  }
  const profile = String(arg('profile', 'mobile'));
  const runs = Number(arg('runs', 1));
  const settleMs = Number(arg('settle', 9000));
  const jsonOut = arg('json', false);
  const showWaterfall = arg('waterfall', false) === true;

  const stray = strayChromeCount();
  if (stray > 4) {
    console.error(`WARNING: ${stray} Chrome processes already running. Leaked browsers from earlier`);
    console.error('runs compete for CPU and will skew these numbers (usually inflating LCP/TBT).');
    console.error(process.platform === 'win32'
      ? '  taskkill /IM chrome.exe /F\n'
      : '  pkill -f chrome\n');
  }

  const reports = [];
  for (let i = 0; i < runs; i++) {
    if (runs > 1) process.stderr.write(`  run ${i + 1}/${runs}\r`);
    reports.push(await probe({ url: String(url), profile, settleMs }));
  }
  if (runs > 1) process.stderr.write('\n');

  const last = reports[reports.length - 1];
  if (jsonOut) writeFileSync(String(jsonOut), JSON.stringify(runs > 1 ? reports : last, null, 2));

  const pad = (s, n) => String(s).padStart(n);
  console.log(`\nURL       ${last.url}`);
  console.log(`Profile   ${last.profile}  (${last.emulation.cpuThrottle}x CPU, ${last.emulation.downKbps ?? 'un'}kbps, ${last.emulation.rttMs}ms RTT)`);
  console.log(`Protocol  ${Object.entries(last.protocols).map(([k, v]) => `${k}:${v}`).join('  ')}`);
  console.log(`Loaded    ${last.totals.requests} requests, ${last.totals.kb} KB on the wire, ${last.unusedJsTotalKb} KB of JS never executed`);
  if (last.metrics.h1 || last.metrics.title) console.log(`Rendered  h1=${JSON.stringify(last.metrics.h1)}  title=${JSON.stringify(last.metrics.title)}`);

  const KEYS = [['ttfbMs', 'TTFB'], ['fcpMs', 'FCP'], ['lcpMs', 'LCP'], ['tbtMs', 'TBT'], ['domContentLoadedMs', 'DCL']];
  if (runs > 1) {
    console.log(`\nMetrics over ${runs} runs (ms)`);
    console.log('           min      p25   median      p75      max');
    for (const [k, label] of KEYS) {
      const vals = reports.map((r) => r.metrics[k]).filter((v) => typeof v === 'number');
      if (!vals.length) continue;
      const s = summarize(vals);
      console.log(`  ${label.padEnd(6)}${pad(s.min, 6)}${pad(s.p25, 9)}${pad(s.median, 9)}${pad(s.p75, 9)}${pad(s.max, 9)}`);
    }
    const cls = reports.map((r) => r.metrics.cls);
    console.log(`  CLS      ${Math.min(...cls)} .. ${Math.max(...cls)}`);
  } else {
    console.log('\nMetrics (ms)');
    for (const [k, label] of KEYS) console.log(`  ${label.padEnd(6)}${pad(last.metrics[k] ?? '-', 8)}`);
    console.log(`  CLS      ${last.metrics.cls}`);
  }
  console.log(`  LCP element: ${last.metrics.lcpElement || '(none captured)'}${last.metrics.lcpUrl ? '  <- ' + String(last.metrics.lcpUrl).slice(0, 60) : ''}`);

  console.log('\nRequest waves (a wave boundary is a >400ms gap = a round trip you paid for)');
  for (const w of last.waves) console.log(`  +${pad(w.startMs, 6)}ms  ${pad(w.n, 3)} req  ${pad(w.kb, 5)} KB   ${w.sample.join(', ').slice(0, 68)}`);

  console.log('\nBytes by type');
  for (const [t, v] of Object.entries(last.byType)) console.log(`  ${t.padEnd(10)}${pad(v.count, 4)} req ${pad(v.kb, 6)} KB`);

  if (last.unusedJs.length) {
    console.log('\nHeaviest unused JS');
    for (const c of last.unusedJs.slice(0, 8)) console.log(`  ${pad(c.unusedKb, 5)} KB unused of ${pad(c.totalKb, 5)} KB (${pad(c.pctUnused, 3)}%)  ${c.url.slice(0, 60)}`);
  }
  if (last.failedRequests.length) {
    console.log('\nFAILED REQUESTS');
    for (const f of last.failedRequests) console.log(`  ${f.err}  ${f.url}`);
  }
  if (showWaterfall) {
    console.log('\nWaterfall');
    for (const r of last.waterfall) console.log(`  +${pad(r.atMs, 6)}ms ${pad(r.kb, 5)}KB ${String(r.init).padEnd(7)} ${r.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 64)}`);
  }
  if (jsonOut) console.log(`\nJSON written to ${jsonOut}`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('probe.mjs')) {
  cli().catch((e) => { console.error('PROBE FAILED:', e.message); process.exitCode = 1; });
}
