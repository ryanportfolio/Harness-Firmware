/* ui-quality probe: measure a rendered page instead of ticking a checklist.

   Runs axe-core for the rules it already measures well (contrast on solid
   backgrounds, names, roles, target size) and adds the checks axe leaves to a
   human: contrast over images and gradients, focus visibility and focus hidden
   under sticky UI, clickable elements Tab cannot reach, reflow at 320 and 640
   CSS px, text spacing, text-only enlargement, reduced motion, layout shift
   during load, dark mode contrast. What axe could not decide is listed, not
   dropped.

   Headed Chrome only (headless renders through the CPU and hides GPU-only
   bugs), offscreen and muted, through the repo's launchPlacedChrome() when it
   exists.

   Needs axe-core and playwright-core (or playwright). Install them for the run
   into a scratch folder the probe looks in first, nothing saved to the project:
     npm i --no-save --prefix .tmp/ui-quality-deps axe-core@latest playwright-core@latest

   Usage:
     node <skill>/scripts/probe.mjs --url <url> [--url <url> ...] [--out <dir>]
       [--storage-state <playwright-state.json>] [--wait-for <css>] [--settle <ms>]
       [--max-tabs <n>] [--skip <check,check>] [--strict] [--allow-error-status]

   Writes <out>/report.json, <out>/report.md and screenshots. Exit 0 when every
   URL was audited, 1 with --strict when any finding is a fail, 2 when the probe
   could not run, a URL could not be audited (including an HTTP 4xx or 5xx
   answer), or a check errored. */
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
// Run from the audited repository root. This also works when the skill is a
// scratch copy or a personal install rather than four levels below it.
const REPO = existsSync(join(process.cwd(), '.git')) ? process.cwd() : resolve(HERE, '../../../..');
const CHECKS = ['axe', 'contrast', 'focus', 'reflow', 'spacing', 'textscale', 'motion', 'shift', 'dark', 'phone'];

function parseArgs(argv) {
  const opts = { urls: [], out: null, storageState: null, waitFor: null, settle: 1500, maxTabs: 80, skip: new Set(), strict: false, allowErrorStatus: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--url') opts.urls.push(next());
    else if (a === '--out') opts.out = next();
    else if (a === '--storage-state') opts.storageState = next();
    else if (a === '--wait-for') opts.waitFor = next();
    else if (a === '--settle') opts.settle = Number(next());
    else if (a === '--max-tabs') opts.maxTabs = Number(next());
    else if (a === '--skip') next().split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => opts.skip.add(s));
    else if (a === '--strict') opts.strict = true;
    else if (a === '--allow-error-status') opts.allowErrorStatus = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!opts.urls.length) throw new Error('at least one --url is required');
  for (const s of opts.skip) if (!CHECKS.includes(s)) throw new Error(`unknown check ${s}; checks: ${CHECKS.join(', ')}`);
  if (!Number.isFinite(opts.settle) || opts.settle < 0) throw new Error('--settle must be a number of ms');
  if (!Number.isInteger(opts.maxTabs) || opts.maxTabs < 1) throw new Error('--max-tabs must be a positive integer');
  if (opts.storageState && !existsSync(opts.storageState)) throw new Error(`storage state not found: ${opts.storageState}`);
  opts.out = resolve(opts.out || join('.tmp', 'ui-quality', new Date().toISOString().replace(/[:.]/g, '-')));
  return opts;
}

// where the per-run install goes: a scratch folder, so the project's own node_modules and lockfile stay untouched
const DEPS = join(REPO, '.tmp', 'ui-quality-deps');
const INSTALL = `npm i --no-save --prefix "${DEPS}" axe-core@latest playwright-core@latest`;

// resolve a package from the scratch install (under the current folder or the repo root), then the current folder, then the repo root
function resolvePkg(spec) {
  for (const base of [join(process.cwd(), '.tmp', 'ui-quality-deps'), DEPS, process.cwd(), REPO]) {
    try {
      return createRequire(join(base, 'package.json')).resolve(spec);
    } catch { /* try the next base */ }
  }
  return null;
}

let launchedVia = '';
async function launch() {
  // always offscreen: nothing here needs watching, and another placement would cover the operator's screen
  const place = 'offscreen';
  const launcher = join(REPO, 'scripts', 'lib', 'launch-chrome.mjs');
  if (existsSync(launcher)) {
    try {
      const { launchPlacedChrome } = await import(pathToFileURL(launcher).href);
      launchedVia = 'launchPlacedChrome()';
      return await launchPlacedChrome({ place, purpose: 'ui-quality probe' });
    } catch (err) {
      console.warn(`[probe] launchPlacedChrome unavailable (${err.message}); launching directly`);
    }
  }
  const entry = resolvePkg('playwright-core') || resolvePkg('playwright');
  if (!entry) throw new Error(`playwright-core not found; run: ${INSTALL}`);
  // a CommonJS package imported by path exposes its exports on default
  const mod = await import(pathToFileURL(entry).href);
  const chromium = mod.chromium ?? mod.default?.chromium;
  const args = ['--window-position=-2400,-2400', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
  try {
    launchedVia = 'installed Chrome';
    return await chromium.launch({ headless: false, channel: 'chrome', args });
  } catch {
    // no installed Chrome: bundled Chromium, still headed; the report says so
    launchedVia = 'bundled Chromium (no installed Chrome found)';
    return await chromium.launch({ headless: false, args });
  }
}

/* ---------- code that runs inside the page ---------- */

// installed before page scripts on every load: selector helper and layout-shift recorder
const INIT = () => {
  // shortest path from the element upward that matches only this element
  const sel = (el) => {
    if (!el || el.nodeType !== 1) return '';
    const unique = (s) => { try { return document.querySelectorAll(s).length === 1; } catch { return false; } };
    const parts = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.id && unique(`#${CSS.escape(n.id)}`)) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
      let part = n.localName;
      const sibs = n.parentElement ? [...n.parentElement.children].filter((c) => c.localName === n.localName) : [];
      if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(n) + 1})`;
      parts.unshift(part);
      if (n.localName === 'body' || unique(parts.join(' > '))) break;
    }
    return parts.join(' > ');
  };
  const ownText = (el) => [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').replace(/\s+/g, ' ').trim();
  // screen-reader-only text and text pushed out of an icon button are hidden on purpose
  const hiddenOnPurpose = (el) => {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return b.width <= 2 || b.height <= 2 || cs.clip !== 'auto' || /inset\(50%/.test(cs.clipPath) || Math.abs(parseFloat(cs.textIndent)) > 999;
  };
  // client rects of the visible text inside an element, its own text first
  const textRects = (el, own = false) => {
    const range = document.createRange();
    const rects = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(), i = 0; n && i < 300; n = walker.nextNode(), i++) {
      if (!n.textContent.trim() || (own && n.parentElement !== el) || hiddenOnPurpose(n.parentElement)) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width && r.height) rects.push({ r, text: n.textContent.trim() });
    }
    return rects;
  };
  // a box that hides its overflow while some of the text inside it lies outside the box
  const clipped = () => {
    const out = [];
    const hides = (v) => v === 'hidden' || v === 'clip';
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const overX = hides(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
      const overY = (hides(cs.overflowY) || cs.webkitLineClamp !== 'none') && el.scrollHeight > el.clientHeight + 1;
      if ((!overX && !overY) || hiddenOnPurpose(el)) continue;
      const b = el.getBoundingClientRect();
      for (const { r, text } of textRects(el)) {
        const x = overX && (r.right > b.right + 1 || r.left < b.left - 1);
        const y = overY && (r.bottom > b.bottom + 1 || r.top < b.top - 1);
        if (x || y) { out.push({ selector: sel(el), text: text.slice(0, 60), axis: x && y ? 'both' : x ? 'x' : 'y', hidden: Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight) }); break; }
      }
    }
    return out;
  };
  window.__uq = { sel, ownText, textRects, clipped, shifts: [] };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__uq.shifts.push({ t: e.startTime, value: e.value, sources: (e.sources || []).map((s) => window.__uq.sel(s.node)).filter(Boolean) });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* layout-shift not supported */ }
};

// pixel work happens on a blank page so the audited page's CSP and scripts cannot interfere
const PIXELS = async ({ op, a, b, rect, rects, color, threshold }) => {
  const load = async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx;
  };
  const crop = (ctx, box = rect) => {
    const x = Math.max(0, Math.floor(box.x)), y = Math.max(0, Math.floor(box.y));
    const w = Math.min(ctx.canvas.width - x, Math.ceil(box.width)), h = Math.min(ctx.canvas.height - y, Math.ceil(box.height));
    if (w <= 0 || h <= 0) return null;
    return ctx.getImageData(x, y, w, h).data;
  };
  if (op === 'diff') {
    const da = crop(await load(a)), db = crop(await load(b));
    if (!da || !db) return { changed: 0, total: 0 };
    let changed = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > threshold) changed++;
    }
    return { changed, total: da.length / 4 };
  }
  // op === 'contrast': text colour (with alpha) against every background pixel under the text's own line boxes
  const ctx = await load(a);
  const parts = rects.map((box) => crop(ctx, box)).filter(Boolean);
  if (!parts.length) return null;
  const d = parts.length === 1 ? parts[0] : parts.reduce((acc, p) => { const out = new Uint8ClampedArray(acc.length + p.length); out.set(acc); out.set(p, acc.length); return out; });
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratios = [];
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, bl] = [d[i], d[i + 1], d[i + 2]];
    const fr = color.r * color.a + r * (1 - color.a), fg = color.g * color.a + g * (1 - color.a), fb = color.b * color.a + bl * (1 - color.a);
    const l1 = lum(fr, fg, fb), l2 = lum(r, g, bl);
    ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
  }
  ratios.sort((x, y) => x - y);
  const at = (p) => ratios[Math.min(ratios.length - 1, Math.floor(p * ratios.length))];
  return { p05: at(0.05), median: at(0.5), worst: ratios[0], pixels: ratios.length };
};

/* ---------- runner ---------- */

const opts = (() => {
  try {
    return parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[probe] ${err.message}`);
    process.exit(2);
  }
})();

const axePath = resolvePkg('axe-core/axe.min.js');
if (!axePath && !opts.skip.has('axe')) {
  console.error(`[probe] axe-core not found; run: ${INSTALL}`);
  process.exit(2);
}
const axeSource = axePath ? readFileSync(axePath, 'utf8') : null;
mkdirSync(opts.out, { recursive: true });

const findings = [];
const notes = [];
const axeReview = new Map();
const shots = [];
const add = (f) => {
  // the same problem seen at several viewports is one finding
  const observation = { viewport: f.viewport, measured: f.measured, ...(f.threshold ? { threshold: f.threshold } : {}) };
  const same = findings.find((g) => g.check === f.check && g.url === f.url && g.selector === f.selector);
  if (same) {
    if (!same.viewport.split(', ').includes(f.viewport)) same.viewport += `, ${f.viewport}`;
    same.observations.push(observation);
    return;
  }
  findings.push({ ...f, observations: [observation] });
};
const on = (check) => !opts.skip.has(check);
// numbered by position, so state URLs that share a long prefix never overwrite each other's screenshots
const slug = (url) => `${String(opts.urls.indexOf(url) + 1).padStart(2, '0')}-${url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'page'}`;

// a crash anywhere is an incomplete run (exit 2), never confused with --strict's exit 1
const crash = async (err) => {
  console.error(`[probe] crashed: ${err?.stack || err}`);
  try { await browser?.close(); } catch { /* already gone */ }
  process.exit(2);
};
process.on('uncaughtException', crash);
process.on('unhandledRejection', crash);

let browser;
try {
  browser = await launch();
} catch (err) {
  console.error(`[probe] could not launch Chrome: ${err.message.split('\n')[0]}`);
  process.exit(2);
}
const browserInfo = `${launchedVia}, version ${browser.version()}`;
if (launchedVia.startsWith('bundled')) notes.push(`ran in ${browserInfo}, not the installed Chrome; GPU and font rendering may differ`);
const blank = await (await browser.newContext()).newPage();
const pixels = (args) => blank.evaluate(PIXELS, args);

async function open(url, ctxOpts = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    bypassCSP: true,
    ...(opts.storageState ? { storageState: opts.storageState } : {}),
    ...ctxOpts,
  });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  const response = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  // a 404 or 500 page, or a sign-in page served with an error code, is not the page that was asked for
  if (response && response.status() >= 400 && !opts.allowErrorStatus) {
    await context.close();
    throw new Error(`HTTP ${response.status()}: not audited (pass --allow-error-status to audit an error page on purpose)`);
  }
  if (opts.waitFor) await page.waitForSelector(opts.waitFor, { timeout: 30000 });
  await page.waitForTimeout(opts.settle);
  return { context, page };
}

async function shot(page, name, full = true) {
  const file = join(opts.out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  shots.push(file);
  return file;
}

async function runAxe(page, url, viewport, tags) {
  await page.evaluate(axeSource);
  const res = await page.evaluate((values) => window.axe.run(document, {
    runOnly: { type: 'tag', values },
    resultTypes: ['violations', 'incomplete'],
  }), tags);
  for (const v of res.violations) {
    const wcag = v.tags.filter((t) => /^wcag\d{3,4}$/.test(t)).map((t) => t.replace(/^wcag(\d)(\d)(\d+)$/, '$1.$2.$3'));
    const level = v.tags.includes('best-practice') ? 'best practice' : v.tags.some((t) => /^wcag2\d*aaa$/.test(t)) ? 'AAA' : 'A/AA';
    for (const n of v.nodes.slice(0, 15)) {
      add({
        check: `axe:${v.id}`, url, viewport, wcag, level,
        severity: level === 'A/AA' ? 'fail' : 'advisory',
        selector: n.target.join(' '), measured: n.failureSummary?.split('\n').slice(1).join(' ').trim() || v.help,
        help: v.helpUrl,
      });
    }
    if (v.nodes.length > 15) notes.push(`${url} ${viewport}: axe ${v.id} has ${v.nodes.length - 15} more nodes`);
  }
  // Keep every undecided row, including contrast at widths the pixel check does
  // not sample. Desktop contrast also goes on to the pixel check; the report
  // reader reconciles that evidence rather than treating absence as a pass.
  for (const r of res.incomplete) {
    const key = `${url} ${viewport} ${r.id}`;
    if (!axeReview.has(key)) axeReview.set(key, { url, id: r.id, help: r.help, viewports: [], nodes: r.nodes.slice(0, 5).map((n) => n.target.join(' ')), count: r.nodes.length });
    axeReview.get(key).viewports.push(viewport);
  }
  return res.incomplete;
}

// the two names axe accepts and a person would not: a placeholder as the only field label, one glyph as a control's name
async function nameGaps(page, url) {
  const gaps = await page.evaluate(() => {
    const out = [];
    const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), textarea')) {
      const ph = (el.getAttribute('placeholder') || '').trim();
      if (!ph || !shown(el)) continue;
      const labelled = [...(el.labels || [])].some((l) => l.innerText.trim()) || (el.getAttribute('aria-label') || '').trim() || el.hasAttribute('aria-labelledby');
      if (!labelled) out.push({ kind: 'placeholder', selector: window.__uq.sel(el), name: ph });
    }
    for (const el of document.querySelectorAll('button, a[href], [role=button], [role=link], input[type=submit], input[type=button]')) {
      if (el.hasAttribute('aria-labelledby') || !shown(el)) continue;
      const name = (el.getAttribute('aria-label') || (el.localName === 'input' ? el.value : el.innerText) || '').replace(/\s+/g, ' ').trim();
      // one non-digit character ("x", "×", "+", "»"), or two characters with no letter or digit; page numbers are left alone
      if (/^\P{N}$/u.test(name) || (name.length === 2 && !/[\p{L}\p{N}]/u.test(name))) out.push({ kind: 'glyph', selector: window.__uq.sel(el), name });
    }
    return out;
  });
  for (const g of gaps.filter((x) => x.kind === 'placeholder').slice(0, 15)) {
    add({ check: 'name:placeholder-only', url, viewport: '1280', wcag: ['3.3.2'], level: 'A/AA', severity: 'review', selector: g.selector, measured: `field named only by its placeholder "${g.name}", which disappears once the user types; axe accepts it` });
  }
  for (const g of gaps.filter((x) => x.kind === 'glyph').slice(0, 15)) {
    add({ check: 'name:glyph', url, viewport: '1280', wcag: ['4.1.2'], level: 'A/AA', severity: 'review', selector: g.selector, measured: `control's accessible name is "${g.name}", which does not say what it does; axe accepts it` });
  }
}

async function compositedContrast(page, url, incomplete) {
  const cc = incomplete.find((r) => r.id === 'color-contrast');
  if (!cc) return;
  if (cc.nodes.length > 40) notes.push(`${url}: contrast over images checked the first 40 of ${cc.nodes.length} elements axe could not decide; the rest were not checked`);
  for (const n of cc.nodes.slice(0, 40)) {
    const selector = n.target.join(' ');
    const info = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const cs = getComputedStyle(el);
      // any CSS colour (oklch, color(), rgb) to sRGB through a canvas
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = cs.color;
      ctx.fillRect(0, 0, 1, 1);
      const m = ctx.getImageData(0, 0, 1, 1).data;
      const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
      return { color: { r: m[0], g: m[1], b: m[2], a: m[3] / 255 }, large: size >= 24 || (size >= 18.66 && weight >= 700) };
    }, selector);
    if (!info) continue;
    // hide the text itself so the screenshot shows only what sits behind it
    await page.evaluate((s) => {
      const el = document.querySelector(s);
      el.dataset.uqColor = el.style.cssText;
      el.style.setProperty('color', 'transparent', 'important');
      el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
      el.style.setProperty('text-shadow', 'none', 'important');
    }, selector);
    await page.waitForTimeout(50);
    // sample only where the text sits: its line boxes, not the whole element
    const rects = await page.evaluate((s) => {
      const el = document.querySelector(s);
      const own = window.__uq.textRects(el, true);
      return (own.length ? own : window.__uq.textRects(el)).map(({ r }) => ({ x: r.left, y: r.top, width: r.width, height: r.height }));
    }, selector);
    const buf = await page.screenshot();
    await page.evaluate((s) => { const el = document.querySelector(s); el.style.cssText = el.dataset.uqColor; delete el.dataset.uqColor; }, selector);
    if (!rects.length) continue;
    const r = await pixels({ op: 'contrast', a: buf.toString('base64'), rects, color: info.color });
    if (!r) continue;
    const need = info.large ? 3 : 4.5;
    const severity = r.median < need ? 'fail' : r.p05 < need ? 'review' : 'pass';
    if (severity === 'pass') continue;
    add({
      check: 'contrast:composited', url, viewport: '1280', wcag: ['1.4.3'], level: 'A/AA', severity, selector,
      measured: `median ${r.median.toFixed(2)}:1, worst 5% ${r.p05.toFixed(2)}:1 over ${r.pixels} px`,
      threshold: `${need}:1 (${info.large ? 'large' : 'normal'} text)`,
    });
  }
}

async function focusWalk(page, url) {
  await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur?.(); });
  const order = [];
  for (let i = 0; i < opts.maxTabs; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(180);
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      if (el.localName === 'iframe') return { selector: window.__uq.sel(el), iframe: true };
      // element identity, not selector text, decides whether focus came back around
      const st = (window.__uqFocus ||= { seen: new WeakSet(), first: null });
      if (st.seen.has(el)) return { selector: window.__uq.sel(el), repeat: el === st.first ? 'first' : 'other' };
      st.seen.add(el);
      st.first ??= el;
      const r = el.getBoundingClientRect();
      const vw = innerWidth, vh = innerHeight;
      const inView = r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
      const hiddenInput = el.localName === 'input' && (r.width <= 1 || r.height <= 1) && (['checkbox', 'radio'].includes(el.type) || el.labels?.length > 0);
      // sample the focused box: is something fixed or sticky painted on top of it?
      const pts = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]
        .map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy])
        .filter(([x, y]) => x >= 0 && y >= 0 && x < vw && y < vh);
      let covered = 0;
      const coverers = new Set();
      for (const [x, y] of pts) {
        const top = document.elementFromPoint(x, y);
        if (!top || el.contains(top) || top.contains(el)) continue;
        let n = top, pinned = false;
        for (; n && n !== document.body; n = n.parentElement) {
          const p = getComputedStyle(n).position;
          if (p === 'fixed' || p === 'sticky') { pinned = true; break; }
        }
        if (pinned) { covered++; coverers.add(window.__uq.sel(n)); }
      }
      return {
        selector: window.__uq.sel(el), name: (el.getAttribute('aria-label') || el.innerText || el.value || el.title || '').trim().slice(0, 40),
        rect: { x: r.left - 8, y: r.top - 8, width: r.width + 16, height: r.height + 16 }, perimeter: 2 * (r.width + r.height),
        inView, hiddenInput, points: pts.length, covered, coverers: [...coverers], coveredBy: [...coverers].join(', '),
      };
    });
    if (!f) { if (i > 0) break; continue; }
    if (f.iframe) { notes.push(`${url}: focus entered iframe ${f.selector}; walk stopped there`); break; }
    if (f.repeat === 'first') break;
    if (f.repeat) { notes.push(`${url}: focus returned to ${f.selector} before reaching the end; possible trap or loop`); break; }
    order.push(f.name ? `${f.selector} "${f.name}"` : f.selector);
    if (!f.inView || f.hiddenInput) {
      // a visually hidden native input behind a custom control usually draws its ring on the label; a person has to look
      if (f.hiddenInput) add({ check: 'focus:hidden-input', url, viewport: '1280', wcag: ['2.4.7'], level: 'A/AA', severity: 'review', selector: f.selector, measured: 'focus is on a 0 or 1 px native input; check that its label or custom control shows a focus marker' });
      else add({ check: 'focus:offscreen', url, viewport: '1280', wcag: ['2.4.7'], level: 'A/AA', severity: 'fail', selector: f.selector, measured: 'focused element is outside the viewport or has no size' });
      continue;
    }
    let hidden = [];
    if (f.points && f.covered === f.points) {
      add({ check: 'focus:obscured', url, viewport: '1280', wcag: ['2.4.11'], level: 'A/AA', severity: 'fail', selector: f.selector, measured: `entirely covered by ${f.coveredBy}` });
      // still measure the ring itself: hide what covers it for the two screenshots
      hidden = f.coverers;
    } else if (f.covered) {
      add({ check: 'focus:partly-obscured', url, viewport: '1280', wcag: ['2.4.12'], level: 'AAA', severity: 'advisory', selector: f.selector, measured: `${f.covered}/${f.points} sample points covered by ${f.coveredBy}` });
    }
    const cover = (on) => page.evaluate(([sels, hide]) => {
      for (const s of sels) { const n = document.querySelector(s); if (n) n.style.visibility = hide ? 'hidden' : ''; }
    }, [hidden, on]);
    if (hidden.length) { await cover(true); await page.waitForTimeout(50); }
    // focused vs unfocused pixels around the element; then put focus back for the next Tab
    const on1 = await page.screenshot();
    await page.evaluate(() => { window.__uqLast = document.activeElement; document.activeElement.blur(); });
    await page.waitForTimeout(180);
    const off = await page.screenshot();
    await page.evaluate(() => window.__uqLast.focus({ preventScroll: true }));
    if (hidden.length) await cover(false);
    const d = await pixels({ op: 'diff', a: on1.toString('base64'), b: off.toString('base64'), rect: f.rect, threshold: 48 });
    const how = hidden.length ? ` (measured with ${f.coveredBy} hidden)` : '';
    if (d.changed === 0) {
      add({ check: 'focus:invisible', url, viewport: '1280', wcag: ['2.4.7'], level: 'A/AA', severity: 'fail', selector: f.selector, measured: `no pixel changes between focused and unfocused${how}` });
    } else if (d.changed < f.perimeter) {
      // a craft heuristic, not the 2.4.13 area-and-contrast test
      add({ check: 'focus:weak', url, viewport: '1280', wcag: [], level: 'craft', severity: 'review', selector: f.selector, measured: `${d.changed} px changed, less than a 1 px ring around it (${Math.round(f.perimeter)} px)${how}` });
    }
  }
  // things styled as clickable that Tab can never reach: a div with a pointer cursor or an inline onclick
  const unreachable = await page.evaluate(() => {
    // reachable by Tab itself, or a label; tabindex="-1" is not reachable
    const self = 'a[href], button, input, select, textarea, summary, label, [contenteditable], [tabindex]:not([tabindex^="-"])';
    // only real controls make their descendants part of one target; a focus wrapper such as <main tabindex="-1"> does not
    const wraps = 'a[href], button, summary, [contenteditable]';
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el.matches(self) || el.parentElement.closest(wraps)) continue;
      const cs = getComputedStyle(el);
      const pointer = cs.cursor === 'pointer' && getComputedStyle(el.parentElement).cursor !== 'pointer';
      if (!pointer && !el.hasAttribute('onclick')) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || cs.visibility === 'hidden') continue;
      out.push(`${window.__uq.sel(el)}${el.getAttribute('role') ? ` role=${el.getAttribute('role')}` : ''}`);
    }
    return out;
  });
  for (const s of unreachable.slice(0, 15)) {
    add({ check: 'keyboard:unreachable', url, viewport: '1280', wcag: ['2.1.1'], level: 'A/AA', severity: 'review', selector: s, measured: 'styled as clickable (pointer cursor or onclick) but not a link, button or form control and has no tabindex of 0 or more; Tab cannot reach it' });
  }
  if (order.length >= opts.maxTabs) notes.push(`${url}: focus walk stopped at --max-tabs ${opts.maxTabs}; later controls were not checked`);
  if (!order.length) add({ check: 'focus:none', url, viewport: '1280', wcag: ['2.1.1'], level: 'A/AA', severity: 'review', selector: 'document', measured: 'Tab reached no element; confirm the page has controls' });
  return order;
}

async function reflow(page, url) {
  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const se = document.scrollingElement;
      const vw = innerWidth;
      // overflow-x on html, or on body when html leaves it visible, applies to the viewport;
      // hidden or clip there cuts content off even though scrollWidth still counts it
      const ox = (el) => getComputedStyle(el).overflowX;
      const rootOx = ox(document.documentElement) !== 'visible' ? ox(document.documentElement) : ox(document.body);
      const rootClips = rootOx === 'hidden' || rootOx === 'clip';
      // nearest ancestor that fits the viewport and stops overflow: 'scroll' (content scrolls inside it) or 'clip' (content is cut off)
      const container = (el) => {
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          if (n.getBoundingClientRect().right > vw + 1) continue;
          const o = getComputedStyle(n).overflowX;
          if (o === 'auto' || o === 'scroll') return 'scroll';
          if (o === 'hidden' || o === 'clip') return 'clip';
        }
        return null;
      };
      const over = [], cut = [];
      for (const el of document.body.querySelectorAll('*')) {
        const b = el.getBoundingClientRect();
        if (!b.width || b.right <= vw + 1) continue;
        const c = container(el);
        if (c === 'scroll') continue;
        // closed off-canvas menus and drawers are not lost content
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.opacity === '0' || el.closest('[aria-hidden="true"], [inert]')) continue;
        (c === 'clip' ? cut : over).push(el);
      }
      // keep the outermost offenders only
      const outer = (list) => { const set = new Set(list); return list.filter((el) => !set.has(el.parentElement)).slice(0, 15).map((el) => ({ selector: window.__uq.sel(el), right: Math.round(el.getBoundingClientRect().right) })); };
      return { overflow: rootClips ? 0 : se.scrollWidth - se.clientWidth, offenders: outer(over), cut: outer(cut), clipped: window.__uq.clipped() };
    });
    await shot(page, `${slug(url)}-${width}`);
    // responsive pages show and hide different controls at 320; axe runs there too
    if (width === 320 && on('axe') && axeSource) await runAxe(page, url, '320', ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
    if (r.overflow > 1) {
      add({
        check: 'reflow:horizontal-scroll', url, viewport: String(width), wcag: ['1.4.10'], level: 'A/AA', severity: 'fail',
        selector: r.offenders.map((o) => `${o.selector} (right ${o.right})`).join('; ') || 'document',
        measured: `page scrolls sideways by ${r.overflow} px at ${width} CSS px (${width === 320 ? '400' : '200'}% zoom of 1280)`,
      });
    }
    // past the right edge with no way to scroll to it: inside a wrapper that hides overflow, or on a page that hides it
    const cutOff = [...r.cut, ...(r.overflow > 1 ? [] : r.offenders)];
    if (cutOff.length) {
      add({
        check: 'reflow:cut-off', url, viewport: String(width), wcag: ['1.4.10'], level: 'A/AA', severity: 'review',
        selector: cutOff.map((o) => `${o.selector} (right ${o.right})`).join('; '),
        measured: `content extends past the right edge at ${width} CSS px inside a box or page that hides overflow, so it is cut off; real if a user needs it`,
      });
    }
    for (const c of r.clipped.slice(0, 10)) {
      add({ check: 'reflow:clipped-text', url, viewport: String(width), wcag: ['1.4.10'], level: 'A/AA', severity: 'review', selector: c.selector, measured: `text cut off on ${c.axis}: "${c.text}"` });
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
}

// apply a stress style, report text that is newly cut off compared with the unstressed page
async function stress(url, check, wcag, level, severity, apply, label) {
  const { context, page } = await open(url);
  try {
    const before = new Map((await page.evaluate(() => window.__uq.clipped())).map((c) => [c.selector, c.hidden]));
    const overflowBefore = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
    await page.evaluate(apply);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__uq.clipped());
    const overflowAfter = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
    await shot(page, `${slug(url)}-${check}`);
    // new clipping, or a box that already clipped and now hides more
    for (const c of after.filter((c) => !before.has(c.selector) || c.hidden > before.get(c.selector) + 2).slice(0, 15)) {
      const was = before.has(c.selector) ? ` (${before.get(c.selector)} px hidden before, ${c.hidden} px now)` : '';
      // a box that already cut its text off (an ellipsis, a line clamp) lost content before the stress; a person decides
      add({ check: `${check}:clipped-text`, url, viewport: '1280', wcag, level, severity: was ? 'review' : severity, selector: c.selector, measured: `${label}: text now cut off on ${c.axis}: "${c.text}"${was}` });
    }
    if (overflowAfter > overflowBefore + 1) {
      add({ check: `${check}:horizontal-scroll`, url, viewport: '1280', wcag, level, severity, selector: 'document', measured: `${label}: page now scrolls sideways by ${overflowAfter} px` });
    }
  } finally {
    await context.close();
  }
}

async function layoutShift(page, url) {
  const shifts = await page.evaluate(() => window.__uq.shifts);
  // largest session window (gap under 1 s, window under 5 s), the way CLS is scored; but only
  // load and settle are recorded, so this is a lower bound of the CLS a visit would see
  let best = 0, cur = 0, start = 0, last = -Infinity, bestSources = [], curSources = [];
  for (const s of shifts) {
    if (s.t - last > 1000 || s.t - start > 5000) { cur = 0; start = s.t; curSources = []; }
    cur += s.value; last = s.t; curSources.push(...s.sources);
    if (cur > best) { best = cur; bestSources = [...curSources]; }
  }
  if (best > 0.1) {
    add({
      check: 'shift:load', url, viewport: '1280', wcag: [], level: 'craft', severity: 'review',
      selector: [...new Set(bestSources)].slice(0, 8).join('; ') || 'unknown',
      measured: `layout shift ${best.toFixed(3)} during load and the first ${opts.settle} ms`, threshold: 'CLS good under 0.1, poor over 0.25 (Core Web Vitals); this is a lower bound',
    });
  }
  return best;
}

async function motion(url) {
  const sample = async (reducedMotion) => {
    const { context, page } = await open(url, { reducedMotion });
    try {
      const anims = await page.evaluate(() => document.getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => {
          const t = a.effect?.getTiming?.() || {};
          return { target: window.__uq.sel(a.effect?.target), name: a.animationName || a.transitionProperty || a.id || 'animation', duration: Number(t.duration) || 0, iterations: t.iterations };
        })
        .filter((a) => a.iterations === Infinity || a.duration >= 1000));
      const videos = await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused && !v.ended).map((v) => window.__uq.sel(v)));
      const a = await page.screenshot();
      // 700 ms, not a round second: a loop with a 1 or 2 s period would look unchanged
      await page.waitForTimeout(700);
      const b = await page.screenshot();
      const vp = page.viewportSize();
      const d = await pixels({ op: 'diff', a: a.toString('base64'), b: b.toString('base64'), rect: { x: 0, y: 0, width: vp.width, height: vp.height }, threshold: 48 });
      return { anims, videos, moving: d.total ? d.changed / d.total : 0 };
    } finally {
      await context.close();
    }
  };
  const normal = await sample('no-preference');
  const reduced = await sample('reduce');
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  if (reduced.anims.length || reduced.videos.length || reduced.moving > 0.002) {
    // no WCAG criterion requires honouring the setting (2.3.3 covers motion caused by interaction),
    // so this is craft; "ignored" means the setting changed nothing that is on screen
    const ignored = normal.anims.length && reduced.anims.length >= normal.anims.length
      && (reduced.moving > 0.0005 || reduced.videos.length > 0) && reduced.moving >= normal.moving * 0.8;
    add({
      check: 'motion:reduced', url, viewport: '1280', wcag: [], level: 'craft', severity: 'review',
      selector: [...reduced.anims.map((a) => `${a.target} (${a.name}, ${a.iterations === Infinity ? 'infinite' : `${a.duration} ms`})`), ...reduced.videos.map((v) => `${v} (playing video)`)].slice(0, 10).join('; ') || 'canvas or script-driven motion',
      measured: `with reduced motion: ${reduced.anims.length} long or looping animations, ${reduced.videos.length} playing videos, ${pct(reduced.moving)} of the viewport changing within 0.7 s (without: ${normal.anims.length}, ${normal.videos.length}, ${pct(normal.moving)})`,
      threshold: ignored ? 'the reduced-motion setting changes nothing on screen' : 'confirm each remaining motion is essential or tiny',
    });
  }
  if (normal.anims.some((a) => a.iterations === Infinity) || normal.videos.length) {
    add({ check: 'motion:pause-control', url, viewport: '1280', wcag: ['2.2.2'], level: 'A/AA', severity: 'review', selector: [...normal.anims.filter((a) => a.iterations === Infinity).map((a) => a.target), ...normal.videos].slice(0, 8).join('; '), measured: 'looping animation or autoplaying video; if it runs over 5 s beside other content it needs pause, stop or hide' });
  }
}

async function dark(url) {
  const { context, page } = await open(url, { colorScheme: 'dark' });
  try {
    const supports = await page.evaluate(() => {
      // walk @layer, @supports, @media, nesting and @import, not only top-level rules
      const walk = (rules) => {
        for (const r of rules) {
          if (r.media && /prefers-color-scheme/.test(r.media.mediaText)) return true;
          let inner = null;
          try { inner = r.styleSheet ? r.styleSheet.cssRules : r.cssRules; } catch { /* cross-origin import */ }
          if (inner && walk(inner)) return true;
        }
        return false;
      };
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        if (walk(rules)) return true;
      }
      return [...document.querySelectorAll('meta[name="color-scheme"]')].some((m) => /dark/.test(m.content)) || /dark/.test(getComputedStyle(document.documentElement).colorScheme);
    });
    if (!supports) { notes.push(`${url}: no dark-scheme styles found in readable stylesheets (cross-origin ones cannot be read) and no class or attribute toggle tried; dark mode not checked`); return; }
    await shot(page, `${slug(url)}-dark`);
    if (on('axe') && axeSource) {
      await page.evaluate(axeSource);
      const res = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] }));
      for (const v of res.violations) for (const n of v.nodes.slice(0, 15)) {
        add({ check: 'dark:color-contrast', url, viewport: '1280 dark', wcag: ['1.4.3'], level: 'A/AA', severity: 'fail', selector: n.target.join(' '), measured: n.failureSummary?.split('\n').slice(1).join(' ').trim() || v.help });
      }
    }
  } finally {
    await context.close();
  }
}

async function phone(url) {
  const { context, page } = await open(url, { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  try {
    await shot(page, `${slug(url)}-375`);
    if (on('axe') && axeSource) await runAxe(page, url, '375 touch', ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=tab], [role=checkbox], [role=switch], [tabindex]:not([tabindex="-1"])')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        // inline links inside running text are exempt from target size
        if (el.localName === 'a' && getComputedStyle(el).display === 'inline' && el.parentElement && window.__uq.ownText(el.parentElement)) continue;
        if (r.width < 44 || r.height < 44) out.push(`${window.__uq.sel(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    if (small.length) {
      add({ check: 'phone:touch-target', url, viewport: '375 touch', wcag: ['2.5.5'], level: 'AAA', severity: 'advisory', selector: small.slice(0, 12).join('; '), measured: `${small.length} controls under 44x44 CSS px`, threshold: '44 pt (Apple HIG), 48 dp (Material); WCAG AA minimum is 24 px, which axe target-size checks' });
    }
  } finally {
    await context.close();
  }
}

if (!on('axe')) notes.push('axe skipped: contrast over images and dark-mode contrast depend on it and were not measured either; axe rules at 320 and 375 px were not run');
const pages = [];
try {
  for (const url of opts.urls) {
    const entry = { url, ok: true, cls: null, focusOrder: [], checks: {} };
    pages.push(entry);
    console.log(`[probe] ${url}`);
    // run one check and record what happened to it; an error is reported, not allowed to hide the checks after it
    const step = async (name, fn) => {
      if (!on(name)) { entry.checks[name] = 'skipped'; return; }
      try {
        await fn();
        entry.checks[name] ??= 'ran';
      } catch (err) {
        entry.checks[name] = `error: ${err.message.split('\n')[0]}`;
        console.error(`[probe] ${url} ${name}: ${entry.checks[name]}`);
      }
    };
    try {
      const { context, page } = await open(url);
      try {
        await step('shift', async () => { entry.cls = await layoutShift(page, url); });
        await shot(page, `${slug(url)}-1280`);
        let incomplete = [];
        await step('axe', async () => {
          incomplete = await runAxe(page, url, '1280', ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']);
          await nameGaps(page, url);
        });
        await step('contrast', async () => {
          if (!axeSource || entry.checks.axe !== 'ran') { entry.checks.contrast = 'not run: needs axe'; return; }
          await compositedContrast(page, url, incomplete);
        });
        await step('focus', async () => { entry.focusOrder = await focusWalk(page, url); });
        await step('reflow', () => reflow(page, url));
      } finally {
        await context.close();
      }
      await step('spacing', async () => {
        await stress(url, 'spacing', ['1.4.12'], 'A/AA', 'fail', () => {
          const s = document.createElement('style');
          s.textContent = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
          document.head.appendChild(s);
        }, 'WCAG text spacing');
      });
      await step('textscale', async () => {
        await stress(url, 'textscale', ['1.4.4'], 'A/AA', 'review', () => {
          const els = [...document.body.querySelectorAll('*')];
          const sizes = els.map((el) => parseFloat(getComputedStyle(el).fontSize));
          els.forEach((el, i) => el.style.setProperty('font-size', `${sizes[i] * 2}px`, 'important'));
        }, 'text-only 200%');
      });
      await step('motion', () => motion(url));
      await step('dark', () => dark(url));
      await step('phone', () => phone(url));
    } catch (err) {
      entry.ok = false;
      entry.error = err.message.split('\n')[0];
      console.error(`[probe] ${url}: ${entry.error}`);
    }
  }
} finally {
  await browser.close();
}

const order = { fail: 0, review: 1, advisory: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.url.localeCompare(b.url) || a.check.localeCompare(b.check));
for (const [i, finding] of findings.entries()) finding.id = `F${String(i + 1).padStart(3, '0')}`;
const counts = Object.fromEntries(Object.keys(order).map((k) => [k, findings.filter((f) => f.severity === k).length]));
const undecided = [...axeReview.values()];
const notMeasured = [
  'Whether names, alt text, labels and error messages make sense; reading and focus order that is legal but confusing.',
  'Screen reader announcements, live regions, dialogs and menus in use, keyboard operation beyond Tab.',
  'Anything that needs a click, a keystroke other than Tab, typing or a submit: errors, menus, tooltips, toasts.',
  'Controls Tab never reaches when nothing styles them as clickable; only a person or the code shows them.',
  'States the URL did not show: empty, loading, error, long content, no permission, signed out.',
  'Widths other than 320, 375, 640 and 1280, and the 256 px tall reflow case for content that scrolls sideways. Narrow viewports do not prove actual browser zoom behavior. Focus, names, motion, layout shift, contrast over images and the stress tests run at 1280 only.',
  'Dark themes switched by a class or data attribute, and styles in cross-origin stylesheets. Dark-mode axe incompletes are not collected.',
  'Layout shift after the settle time; the figure above covers load only.',
  'Under text spacing and enlarged text: text that overlaps its neighbours in a box that does not hide overflow; only cut-off text is measured, at 1280 px only.',
  'Canvas, WebGL and media content; content inside cross-origin iframes.',
];
const report = { generated: new Date().toISOString(), browser: browserInfo, urls: opts.urls, skipped: [...opts.skip], counts, pages, findings, axeUndecided: undecided, notes, notMeasured, screenshots: shots };
writeFileSync(join(opts.out, 'report.json'), JSON.stringify(report, null, 2));

const cell = (value) => String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
const md = [
  `# ui-quality probe`, '',
  `${report.generated}. Fails ${counts.fail}, review ${counts.review}, advisory ${counts.advisory}.${opts.skip.size ? ` Skipped: ${[...opts.skip].join(', ')}.` : ''}`, '',
  `Browser: ${browserInfo}.`, '',
  'Rows below are candidates, not confirmed owner findings. Verify each fail; at full depth also resolve review rows and relevant advisories. IDs refer to this run only. Full evidence and per-viewport observations are in report.json.', '',
  'A check with no finding is not a pass for its WCAG criterion: axe accepts names and labels a person would reject. The `name:` checks catch two of them (a placeholder as the only label, one glyph such as "x" as a name); a name that is present but wrong is not caught.', '',
  ...pages.map((p) => `- ${p.url}: ${p.ok ? `ran${p.cls !== null ? `, layout shift during load ${p.cls.toFixed(3)}` : ''}, ${p.focusOrder.length} focus stops` : `NOT AUDITED: ${p.error}`}${Object.keys(p.checks).length ? `. Checks: ${Object.entries(p.checks).map(([k, v]) => `${k} ${v}`).join('; ')}` : ''}`), '',
  '| ID | Severity | URL | Check | WCAG / source | Viewport | Where | Measured |', '|---|---|---|---|---|---|---|---|',
  ...findings.map((f) => `| ${f.id} | ${f.severity} | ${cell(f.url)} | ${f.check} | ${f.wcag.join(', ') || f.level} | ${f.viewport} | ${cell(f.selector)} | ${f.observations.map((o) => cell(`${o.viewport}: ${o.measured}${o.threshold ? ` (need ${o.threshold})` : ''}`)).join('<br>')} |`),
  '', '## axe could not decide', '',
  'These require a decision. Desktop contrast may have additional pixel evidence above; other widths have no composited contrast measurement. The first five selectors are listed per rule and viewport; further nodes remain unchecked.', '',
  ...(undecided.length ? undecided.map((u) => `- ${u.url}: ${u.id} (${u.count} elements, ${u.viewports.join(', ')}): ${u.help}. First: \`${u.nodes.join('`, `')}\``) : ['- none']),
  '', '## Notes', '', ...(notes.length ? notes.map((n) => `- ${n}`) : ['- none']),
  '', '## Focus order', '', ...pages.flatMap((p) => [`${p.url}:`, ...p.focusOrder.map((s, i) => `${i + 1}. ${s}`), '']),
  '## Screenshots', '',
  'Names start with the URL position (01, 02, etc.). Suffixes identify width, dark theme or text stress. Baseline screenshots show context, not the transient focus or motion measurements; reproduce those checks when verifying.', '',
  ...shots.map((file) => `- ${file}`), '',
  '## Not measured', '',
  ...notMeasured.map((gap) => `- ${gap}`),
];
writeFileSync(join(opts.out, 'report.md'), md.join('\n') + '\n');
console.log(`[probe] fails ${counts.fail}, review ${counts.review}, advisory ${counts.advisory}`);
console.log(`[probe] report: ${join(opts.out, 'report.md')}`);
// a URL that could not be audited makes the whole run incomplete, with or without --strict
// a URL not audited, or a check that errored, leaves the run incomplete
const checkErrors = pages.some((p) => Object.values(p.checks).some((v) => v.startsWith('error')));
process.exitCode = pages.some((p) => !p.ok) || checkErrors ? 2 : opts.strict && counts.fail ? 1 : 0;
