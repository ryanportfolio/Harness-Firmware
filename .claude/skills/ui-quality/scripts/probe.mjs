/* ui-quality probe: measure a rendered page instead of ticking a checklist.

   Runs axe-core for the rules it already measures well (contrast on solid
   backgrounds, names, roles, target size) and adds the checks axe leaves to a
   human: contrast over images and gradients, focus visibility and focus hidden
   under sticky UI, reflow at 320 and 640 CSS px, text spacing, text-only
   enlargement, reduced motion, layout shift, dark mode contrast.

   Headed Chrome only (headless renders through the CPU and hides GPU-only
   bugs), offscreen and muted, through the repo's launchPlacedChrome() when it
   exists.

   Needs axe-core and playwright-core (or playwright) resolvable from the
   current directory or the repo root. Scratch install, nothing saved:
     npm i --no-save axe-core@latest playwright-core@latest

   Usage:
     node <skill>/scripts/probe.mjs --url <url> [--url <url> ...] [--out <dir>]
       [--storage-state <playwright-state.json>] [--wait-for <css>] [--settle <ms>]
       [--max-tabs <n>] [--skip <check,check>] [--strict]

   Writes <out>/report.json, <out>/report.md and screenshots. Exit 0 when the
   run completed, 1 with --strict when any finding is a fail, 2 when the probe
   itself could not run. */
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../..');
const CHECKS = ['axe', 'contrast', 'focus', 'reflow', 'spacing', 'textscale', 'motion', 'shift', 'dark', 'phone'];

function parseArgs(argv) {
  const opts = { urls: [], out: null, storageState: null, waitFor: null, settle: 1500, maxTabs: 80, skip: new Set(), strict: false };
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

// resolve a package from the current directory first, then the repo root
function resolvePkg(spec) {
  for (const base of [process.cwd(), REPO]) {
    try {
      return createRequire(join(base, 'package.json')).resolve(spec);
    } catch { /* try the next base */ }
  }
  return null;
}

async function launch() {
  const place = process.env.CHROME_PLACE || 'offscreen';
  const launcher = join(REPO, 'scripts', 'lib', 'launch-chrome.mjs');
  if (existsSync(launcher)) {
    try {
      const { launchPlacedChrome } = await import(pathToFileURL(launcher).href);
      return await launchPlacedChrome({ place, purpose: 'ui-quality probe' });
    } catch (err) {
      console.warn(`[probe] launchPlacedChrome unavailable (${err.message}); launching directly`);
    }
  }
  const entry = resolvePkg('playwright-core') || resolvePkg('playwright');
  if (!entry) throw new Error('playwright-core not found; run: npm i --no-save axe-core@latest playwright-core@latest');
  // a CommonJS package imported by path exposes its exports on default
  const mod = await import(pathToFileURL(entry).href);
  const chromium = mod.chromium ?? mod.default?.chromium;
  const args = ['--window-position=-2400,-2400', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
  try {
    return await chromium.launch({ headless: false, channel: 'chrome', args });
  } catch {
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
  // text that does not fit its box and is cut off rather than wrapped or scrolled
  const clipped = () => {
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      const text = ownText(el);
      if (!text) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // screen-reader-only text and text pushed out of an icon button are hidden on purpose
      const b = el.getBoundingClientRect();
      if (b.width <= 2 || b.height <= 2 || cs.clip !== 'auto' || /inset\(50%/.test(cs.clipPath) || Math.abs(parseFloat(cs.textIndent)) > 999) continue;
      const hides = (v) => v === 'hidden' || v === 'clip';
      const x = hides(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
      const y = (hides(cs.overflowY) || cs.webkitLineClamp !== 'none') && el.scrollHeight > el.clientHeight + 1;
      if (x || y) out.push({ selector: sel(el), text: text.slice(0, 60), axis: x && y ? 'both' : x ? 'x' : 'y' });
    }
    return out;
  };
  window.__uq = { sel, ownText, clipped, shifts: [] };
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
const PIXELS = async ({ op, a, b, rect, color, threshold }) => {
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
  const crop = (ctx) => {
    const x = Math.max(0, Math.floor(rect.x)), y = Math.max(0, Math.floor(rect.y));
    const w = Math.min(ctx.canvas.width - x, Math.ceil(rect.width)), h = Math.min(ctx.canvas.height - y, Math.ceil(rect.height));
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
  // op === 'contrast': text colour (with alpha) against every background pixel under it
  const d = crop(await load(a));
  if (!d) return null;
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
  console.error('[probe] axe-core not found; run: npm i --no-save axe-core@latest playwright-core@latest');
  process.exit(2);
}
const axeSource = axePath ? readFileSync(axePath, 'utf8') : null;
mkdirSync(opts.out, { recursive: true });

const findings = [];
const notes = [];
const shots = [];
const add = (f) => {
  // the same problem seen at several viewports is one finding
  const same = findings.find((g) => g.check === f.check && g.url === f.url && g.selector === f.selector);
  if (same) { if (!same.viewport.split(', ').includes(f.viewport)) same.viewport += `, ${f.viewport}`; return; }
  findings.push(f);
};
const on = (check) => !opts.skip.has(check);
const slug = (url) => url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'page';

let browser;
try {
  browser = await launch();
} catch (err) {
  console.error(`[probe] could not launch Chrome: ${err.message.split('\n')[0]}`);
  process.exit(2);
}
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
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
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
  return res.incomplete;
}

async function compositedContrast(page, url, incomplete) {
  const cc = incomplete.find((r) => r.id === 'color-contrast');
  if (!cc) return;
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
    const rect = await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().toJSON(), selector);
    const buf = await page.screenshot();
    await page.evaluate((s) => { const el = document.querySelector(s); el.style.cssText = el.dataset.uqColor; delete el.dataset.uqColor; }, selector);
    const r = await pixels({ op: 'contrast', a: buf.toString('base64'), rect, color: info.color });
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
      // sample the focused box: is something fixed or sticky painted on top of it?
      const pts = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]
        .map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy])
        .filter(([x, y]) => x >= 0 && y >= 0 && x < vw && y < vh);
      let covered = 0, coveredBy = '';
      for (const [x, y] of pts) {
        const top = document.elementFromPoint(x, y);
        if (!top || el.contains(top) || top.contains(el)) continue;
        let n = top, pinned = false;
        for (; n && n !== document.body; n = n.parentElement) {
          const p = getComputedStyle(n).position;
          if (p === 'fixed' || p === 'sticky') { pinned = true; break; }
        }
        if (pinned) { covered++; coveredBy = window.__uq.sel(n); }
      }
      return {
        selector: window.__uq.sel(el), name: (el.getAttribute('aria-label') || el.innerText || el.value || el.title || '').trim().slice(0, 40),
        rect: { x: r.left - 8, y: r.top - 8, width: r.width + 16, height: r.height + 16 }, perimeter: 2 * (r.width + r.height),
        inView, points: pts.length, covered, coveredBy,
      };
    });
    if (!f) { if (i > 0) break; continue; }
    if (f.iframe) { notes.push(`${url}: focus entered iframe ${f.selector}; walk stopped there`); break; }
    if (f.repeat === 'first') break;
    if (f.repeat) { notes.push(`${url}: focus returned to ${f.selector} before reaching the end; possible trap or loop`); break; }
    order.push(f.name ? `${f.selector} "${f.name}"` : f.selector);
    if (!f.inView) {
      add({ check: 'focus:offscreen', url, viewport: '1280', wcag: ['2.4.7'], level: 'A/AA', severity: 'fail', selector: f.selector, measured: 'focused element is outside the viewport or has no size' });
      continue;
    }
    if (f.points && f.covered === f.points) {
      add({ check: 'focus:obscured', url, viewport: '1280', wcag: ['2.4.11'], level: 'A/AA', severity: 'fail', selector: f.selector, measured: `entirely covered by ${f.coveredBy}` });
      // a covered element shows no ring either; one finding is enough
      continue;
    } else if (f.covered) {
      add({ check: 'focus:partly-obscured', url, viewport: '1280', wcag: ['2.4.12'], level: 'AAA', severity: 'advisory', selector: f.selector, measured: `${f.covered}/${f.points} sample points covered by ${f.coveredBy}` });
    }
    // focused vs unfocused pixels around the element; then put focus back for the next Tab
    const on1 = await page.screenshot();
    await page.evaluate(() => { window.__uqLast = document.activeElement; document.activeElement.blur(); });
    await page.waitForTimeout(180);
    const off = await page.screenshot();
    await page.evaluate(() => window.__uqLast.focus({ preventScroll: true }));
    const d = await pixels({ op: 'diff', a: on1.toString('base64'), b: off.toString('base64'), rect: f.rect, threshold: 48 });
    if (d.changed === 0) {
      add({ check: 'focus:invisible', url, viewport: '1280', wcag: ['2.4.7'], level: 'A/AA', severity: 'fail', selector: f.selector, measured: 'no pixel changes between focused and unfocused' });
    } else if (d.changed < f.perimeter) {
      add({ check: 'focus:weak', url, viewport: '1280', wcag: ['2.4.13'], level: 'AAA', severity: 'review', selector: f.selector, measured: `${d.changed} px changed; a 1 px ring around it would be ${Math.round(f.perimeter)} px` });
    }
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
      const scrollsInside = (el) => {
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          const o = getComputedStyle(n).overflowX;
          if ((o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') && n.getBoundingClientRect().right <= vw + 1) return true;
        }
        return false;
      };
      const over = [];
      for (const el of document.body.querySelectorAll('*')) {
        const b = el.getBoundingClientRect();
        if (!b.width || b.right <= vw + 1 || scrollsInside(el)) continue;
        // closed off-canvas menus and drawers are not lost content
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.opacity === '0' || el.closest('[aria-hidden="true"], [inert]')) continue;
        over.push(el);
      }
      // keep the outermost offenders only
      const set = new Set(over);
      const top = over.filter((el) => !set.has(el.parentElement)).slice(0, 15);
      return { overflow: se.scrollWidth - se.clientWidth, offenders: top.map((el) => ({ selector: window.__uq.sel(el), right: Math.round(el.getBoundingClientRect().right) })), clipped: window.__uq.clipped() };
    });
    await shot(page, `${slug(url)}-${width}`);
    if (r.overflow > 1) {
      add({
        check: 'reflow:horizontal-scroll', url, viewport: String(width), wcag: ['1.4.10'], level: 'A/AA', severity: 'fail',
        selector: r.offenders.map((o) => `${o.selector} (right ${o.right})`).join('; ') || 'document',
        measured: `page scrolls sideways by ${r.overflow} px at ${width} CSS px (${width === 320 ? '400' : '200'}% zoom of 1280)`,
      });
    } else if (r.offenders.length) {
      add({
        check: 'reflow:cut-off', url, viewport: String(width), wcag: ['1.4.10'], level: 'A/AA', severity: 'review',
        selector: r.offenders.map((o) => `${o.selector} (right ${o.right})`).join('; '),
        measured: `no sideways scroll, but content extends past the right edge at ${width} CSS px; if the page hides overflow, that content is cut off`,
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
    const before = new Set((await page.evaluate(() => window.__uq.clipped())).map((c) => c.selector));
    const overflowBefore = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
    await page.evaluate(apply);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__uq.clipped());
    const overflowAfter = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
    await shot(page, `${slug(url)}-${check}`);
    for (const c of after.filter((c) => !before.has(c.selector)).slice(0, 15)) {
      add({ check: `${check}:clipped-text`, url, viewport: '1280', wcag, level, severity, selector: c.selector, measured: `${label}: text now cut off on ${c.axis}: "${c.text}"` });
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
  // CLS: largest session window (gap under 1 s, window under 5 s)
  let best = 0, cur = 0, start = 0, last = -Infinity, bestSources = [], curSources = [];
  for (const s of shifts) {
    if (s.t - last > 1000 || s.t - start > 5000) { cur = 0; start = s.t; curSources = []; }
    cur += s.value; last = s.t; curSources.push(...s.sources);
    if (cur > best) { best = cur; bestSources = [...curSources]; }
  }
  if (best > 0.1) {
    add({
      check: 'shift:cls', url, viewport: '1280', wcag: [], level: 'craft', severity: best > 0.25 ? 'fail' : 'review',
      selector: [...new Set(bestSources)].slice(0, 8).join('; ') || 'unknown',
      measured: `CLS ${best.toFixed(3)} during load and settle`, threshold: 'good under 0.1, poor over 0.25 (Core Web Vitals)',
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
    // fail only when the setting changed nothing and the motion is on screen; an offscreen loop stays review
    const ignored = normal.anims.length && reduced.anims.length >= normal.anims.length
      && (reduced.moving > 0.0005 || reduced.videos.length > 0) && reduced.moving >= normal.moving * 0.8;
    add({
      check: 'motion:reduced', url, viewport: '1280', wcag: ['2.3.3'], level: 'AAA', severity: ignored ? 'fail' : 'review',
      selector: [...reduced.anims.map((a) => `${a.target} (${a.name}, ${a.iterations === Infinity ? 'infinite' : `${a.duration} ms`})`), ...reduced.videos.map((v) => `${v} (playing video)`)].slice(0, 10).join('; ') || 'canvas or script-driven motion',
      measured: `with reduced motion: ${reduced.anims.length} long or looping animations, ${reduced.videos.length} playing videos, ${pct(reduced.moving)} of the viewport changing per second (without: ${normal.anims.length}, ${normal.videos.length}, ${pct(normal.moving)})`,
      threshold: ignored ? 'the reduced-motion setting changes nothing; treat as a fail of the project floor' : 'confirm each remaining motion is essential or tiny',
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
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        for (const r of rules) if (r.media && /prefers-color-scheme/.test(r.media.mediaText)) return true;
      }
      return [...document.querySelectorAll('meta[name="color-scheme"]')].some((m) => /dark/.test(m.content)) || /dark/.test(getComputedStyle(document.documentElement).colorScheme);
    });
    if (!supports) { notes.push(`${url}: no dark-scheme styles found in readable stylesheets; dark mode not checked`); return; }
    await shot(page, `${slug(url)}-dark`);
    if (axeSource) {
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
    if (axeSource) await runAxe(page, url, '375 touch', ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
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

const pages = [];
try {
  for (const url of opts.urls) {
    const entry = { url, ok: true, cls: null, focusOrder: [] };
    pages.push(entry);
    console.log(`[probe] ${url}`);
    try {
      const { context, page } = await open(url);
      try {
        if (on('shift')) entry.cls = await layoutShift(page, url);
        await shot(page, `${slug(url)}-1280`);
        let incomplete = [];
        if (on('axe')) incomplete = await runAxe(page, url, '1280', ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']);
        if (on('contrast') && axeSource) await compositedContrast(page, url, incomplete);
        if (on('focus')) entry.focusOrder = await focusWalk(page, url);
        if (on('reflow')) await reflow(page, url);
      } finally {
        await context.close();
      }
      if (on('spacing')) {
        await stress(url, 'spacing', ['1.4.12'], 'A/AA', 'fail', () => {
          const s = document.createElement('style');
          s.textContent = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
          document.head.appendChild(s);
        }, 'WCAG text spacing');
      }
      if (on('textscale')) {
        await stress(url, 'textscale', ['1.4.4'], 'A/AA', 'review', () => {
          const els = [...document.body.querySelectorAll('*')];
          const sizes = els.map((el) => parseFloat(getComputedStyle(el).fontSize));
          els.forEach((el, i) => el.style.setProperty('font-size', `${sizes[i] * 2}px`, 'important'));
        }, 'text-only 200%');
      }
      if (on('motion')) await motion(url);
      if (on('dark')) await dark(url);
      if (on('phone')) await phone(url);
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
const counts = Object.fromEntries(Object.keys(order).map((k) => [k, findings.filter((f) => f.severity === k).length]));
const report = { generated: new Date().toISOString(), urls: opts.urls, skipped: [...opts.skip], counts, pages, findings, notes, screenshots: shots };
writeFileSync(join(opts.out, 'report.json'), JSON.stringify(report, null, 2));

const md = [
  `# ui-quality probe`, '',
  `${report.generated}. Fails ${counts.fail}, review ${counts.review}, advisory ${counts.advisory}.${opts.skip.size ? ` Skipped: ${[...opts.skip].join(', ')}.` : ''}`, '',
  ...pages.map((p) => `- ${p.url}: ${p.ok ? `ran${p.cls !== null ? `, CLS ${p.cls.toFixed(3)}` : ''}, ${p.focusOrder.length} focus stops` : `FAILED: ${p.error}`}`), '',
  '| Severity | Check | WCAG | Viewport | Where | Measured |', '|---|---|---|---|---|---|',
  ...findings.map((f) => `| ${f.severity} | ${f.check} | ${f.wcag.join(', ') || f.level} | ${f.viewport} | \`${String(f.selector).replace(/\|/g, '\\|').slice(0, 160)}\` | ${String(f.measured).replace(/\|/g, '\\|').slice(0, 220)}${f.threshold ? ` (need ${f.threshold})` : ''} |`),
  '', '## Notes', '', ...(notes.length ? notes.map((n) => `- ${n}`) : ['- none']),
  '', '## Focus order', '', ...pages.flatMap((p) => [`${p.url}:`, ...p.focusOrder.map((s, i) => `${i + 1}. ${s}`), '']),
  '## Not measured', '',
  '- Whether names, alt text, labels and error messages make sense; reading and focus order that is legal but confusing.',
  '- Screen reader announcements, live regions, dialogs and menus in use, keyboard operation beyond Tab.',
  '- States the URL did not show: empty, loading, error, long content, no permission, signed out.',
  '- Canvas, WebGL and media content; content inside cross-origin iframes.',
];
writeFileSync(join(opts.out, 'report.md'), md.join('\n') + '\n');
console.log(`[probe] fails ${counts.fail}, review ${counts.review}, advisory ${counts.advisory}`);
console.log(`[probe] report: ${join(opts.out, 'report.md')}`);
process.exitCode = opts.strict && counts.fail ? 1 : 0;
