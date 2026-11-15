#!/usr/bin/env node
/* user-walk browser driver.

   One driver = one goal = one headed Chrome, offscreen and muted. The main session
   starts it, a walker agent that has not read the code drives it, and every action
   the walker takes is logged here, so step counts come from the log and not from the
   walker's own account.

     node walk.mjs <dir> start --url <start url> [--goal "<text>"] [--known <n>]
                               [--max-actions <n>] [--skip "<regex>"] [--origin <origin>]...
                               [--storage-state <file>] [--shots <dir>] [--width 1280 --height 800]
     node walk.mjs <dir> look                  page text with refs (e12, f1e40) + viewport screenshot
     node walk.mjs <dir> click <ref>
     node walk.mjs <dir> fill <ref> <text>
     node walk.mjs <dir> select <ref> <option label>
     node walk.mjs <dir> hover <ref>
     node walk.mjs <dir> press <key>           Enter, Tab, Escape, ArrowDown ...
     node walk.mjs <dir> scroll <down|up>
     node walk.mjs <dir> back                  browser back
     node walk.mjs <dir> home                  reload the start page (counts as a backtrack)
     node walk.mjs <dir> note <text>           walker's remark: confusing label, unsure where to go
     node walk.mjs <dir> end <found|gave-up> <text>
     node walk.mjs <dir> save-state <file>     main session only: save a signed-in session for --storage-state
     node walk.mjs <dir> stop                  close the browser
     node walk.mjs <dir|run dir> summary       per-goal counts from steps.jsonl (no browser needed)

   Guards, enforced here and not left to the walker's judgment:
   - clicks and Enter on controls whose name matches the skip list are refused and logged
     (the default list covers deletes, payments and sending; --skip adds to it, never replaces it);
   - top-level navigation to another origin is aborted ("left the app"), popups to other
     origins are closed, and non-GET requests to other origins are aborted unless --origin
     allows that origin (the app's own API on another host, for example);
   - after --max-actions actions every command except note, end and stop is refused;
   - the server exits after 20 idle minutes so no browser is left behind.

   Packages: playwright-core in a scratch install, as ui-quality's probe does:
     npm i --no-save --prefix .tmp/user-walk-deps playwright-core@latest
*/
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, openSync } from 'node:fs';

const HERE = fileURLToPath(import.meta.url);
const REPO = existsSync(join(process.cwd(), '.git')) ? process.cwd() : resolve(dirname(HERE), '../../../..');
const DEPS = join(REPO, '.tmp', 'user-walk-deps');
const INSTALL = `npm i --no-save --prefix "${DEPS}" playwright-core@latest`;

// controls a walker must never operate: deleting, paying, sending, leaving an account
const DEFAULT_SKIP = String.raw`\b(delete|remove|destroy|erase|wipe|discard|pay|purchase|buy|checkout|check out|place order|upgrade|subscribe|unsubscribe|send|invite|publish|post|tweet|cancel (my )?(plan|subscription|account)|close account|deactivate)\b`;
const ACTIONS = new Set(['click', 'fill', 'select', 'hover', 'press', 'scroll', 'back', 'home']);
const IDLE_MS = 20 * 60 * 1000;

const [dirArg, cmd, ...rest] = process.argv.slice(2);
if (!dirArg || !cmd) {
  console.error('usage: node walk.mjs <dir> <start|look|click|fill|select|hover|press|scroll|back|home|note|end|save-state|stop|summary> ...; full list in the header comment');
  process.exitCode = 2;
} else {
  const dir = resolve(dirArg);
  if (cmd === 'start') await start(dir, rest);
  else if (cmd === '__serve') await serve(dir);
  else if (cmd === 'summary') summary(dir);
  else await send(dir, cmd, rest);
}

/* ---------- client side ---------- */

function parseStart(args) {
  const o = { origins: [], known: null, maxActions: 30, width: 1280, height: 800, skip: '' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => {
      if (i + 1 >= args.length) throw new Error(`${a} needs a value`);
      return args[++i];
    };
    if (a === '--url') o.url = next();
    else if (a === '--goal') o.goal = next();
    else if (a === '--known') o.known = Number(next());
    else if (a === '--max-actions') o.maxActions = Number(next());
    else if (a === '--skip') o.skip = next();
    else if (a === '--origin') o.origins.push(new URL(next()).origin);
    else if (a === '--storage-state') o.storageState = resolve(next());
    else if (a === '--shots') o.shots = resolve(next());
    else if (a === '--width') o.width = Number(next());
    else if (a === '--height') o.height = Number(next());
    else throw new Error(`unknown argument ${a}`);
  }
  if (!o.url) throw new Error('--url is required');
  new URL(o.url);
  if (!Number.isInteger(o.maxActions) || o.maxActions < 1) throw new Error('--max-actions must be a positive integer');
  if (o.known !== null && !(Number.isInteger(o.known) && o.known >= 0)) throw new Error('--known must be a whole number');
  if (o.storageState && !existsSync(o.storageState)) throw new Error(`storage state not found: ${o.storageState}`);
  if (o.skip) new RegExp(o.skip, 'i');
  return o;
}

async function start(dir, args) {
  let o;
  try {
    o = parseStart(args);
  } catch (err) {
    console.error(`start: ${err.message}`);
    process.exitCode = 2;
    return;
  }
  if (existsSync(join(dir, 'steps.jsonl'))) {
    console.error(`start: ${dir} already holds a walk; use a new folder per goal`);
    process.exitCode = 2;
    return;
  }
  mkdirSync(dir, { recursive: true });
  o.shots = o.shots || join(dir, 'shots');
  mkdirSync(o.shots, { recursive: true });
  writeFileSync(join(dir, 'options.json'), JSON.stringify(o, null, 2));
  const log = openSync(join(dir, 'driver.log'), 'a');
  const child = spawn(process.execPath, [HERE, dir, '__serve'], { detached: true, stdio: ['ignore', log, log], cwd: process.cwd() });
  child.unref();
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    if (existsSync(join(dir, 'driver.json'))) {
      const d = JSON.parse(readFileSync(join(dir, 'driver.json'), 'utf8'));
      if (d.error) {
        console.error(`start failed: ${d.error}`);
        process.exitCode = 1;
        return;
      }
      console.log(`ready: ${o.url} (via ${d.launchedVia}, max ${o.maxActions} actions)`);
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.error(`start: driver did not come up in 60 s; see ${join(dir, 'driver.log')}`);
  process.exitCode = 1;
}

async function send(dir, command, args) {
  const file = join(dir, 'driver.json');
  if (!existsSync(file)) {
    console.error(`no driver running in ${dir}; the main session starts it`);
    process.exitCode = 1;
    return;
  }
  const { port } = JSON.parse(readFileSync(file, 'utf8'));
  const body = JSON.stringify({ cmd: command, args });
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    const out = await res.json();
    console.log(out.text);
    if (!out.ok) process.exitCode = 1;
  } catch (err) {
    console.error(`driver not reachable (${err.message}); it may have stopped`);
    process.exitCode = 1;
  }
}

/* ---------- summary ---------- */

function readSteps(dir) {
  return readFileSync(join(dir, 'steps.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
}

function summarize(dir) {
  const o = existsSync(join(dir, 'options.json')) ? JSON.parse(readFileSync(join(dir, 'options.json'), 'utf8')) : {};
  const steps = readSteps(dir);
  const acts = steps.filter((s) => ACTIONS.has(s.action) && !s.error && !s.blocked && !s.refused);
  let backtracks = 0;
  let deadEnds = 0;
  const screens = new Set([steps[0]?.screenBefore].filter(Boolean));
  let enteredBy = null;
  for (const s of acts) {
    const moved = s.screenAfter && s.screenAfter !== s.screenBefore;
    const back = s.action === 'back' || s.action === 'home' || (moved && s.revisit);
    if (back) {
      backtracks++;
      // a screen entered by a forward move and left by going back, with nothing done on it
      if (enteredBy && enteredBy.screen === s.screenBefore && !enteredBy.worked) deadEnds++;
    }
    if (enteredBy && enteredBy.screen === s.screenBefore && ['fill', 'select', 'press'].includes(s.action)) enteredBy.worked = true;
    if (moved) {
      screens.add(s.screenAfter);
      enteredBy = back ? null : { screen: s.screenAfter, worked: false };
    }
  }
  const end = steps.findLast((s) => s.action === 'end');
  const first = steps[0]?.t;
  const last = steps.at(-1)?.t;
  const n = acts.length;
  return {
    goal: o.goal || basename(dir),
    outcome: end ? end.arg : 'not ended',
    endNote: end?.text || '',
    actions: n,
    known: o.known ?? null,
    wasted: o.known == null ? null : Math.max(0, n - o.known),
    backtracks,
    deadEnds,
    screens: screens.size,
    looks: steps.filter((s) => s.action === 'look').length,
    scrolls: acts.filter((s) => s.action === 'scroll').length,
    failed: steps.filter((s) => s.error).length,
    refused: steps.filter((s) => s.refused || s.blocked).map((s) => `${s.action} "${s.name || s.arg || ''}": ${s.refused || s.blocked}`),
    notes: steps.filter((s) => s.action === 'note').map((s) => s.text),
    seconds: first && last ? Math.round((Date.parse(last) - Date.parse(first)) / 1000) : 0,
    dir,
  };
}

function summary(dir) {
  const dirs = existsSync(join(dir, 'steps.jsonl'))
    ? [dir]
    : (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [])
        .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'steps.jsonl')))
        .map((e) => join(dir, e.name));
  if (!dirs.length) {
    console.error(`no steps.jsonl in ${dir} or its subfolders`);
    process.exitCode = 1;
    return;
  }
  const rows = dirs.map(summarize);
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(rows, null, 2));
  for (const r of rows) {
    console.log(`${basename(r.dir)}: ${r.outcome}; ${r.actions} actions (known ${r.known ?? '?'}, wasted ${r.wasted ?? '?'}), ${r.backtracks} backtracks, ${r.deadEnds} dead ends, ${r.screens} screens, ${r.scrolls} scrolls, ${r.failed} failed, ${r.refused.length} refused, ${r.notes.length} notes, ${r.seconds} s`);
  }
  console.log(`written: ${join(dir, 'summary.json')}`);
}

/* ---------- server side ---------- */

function resolvePkg(spec) {
  for (const base of [join(process.cwd(), '.tmp', 'user-walk-deps'), DEPS, process.cwd(), REPO]) {
    try {
      return createRequire(join(base, 'package.json')).resolve(spec);
    } catch { /* next base */ }
  }
  return null;
}

async function launch() {
  const launcher = join(REPO, 'scripts', 'lib', 'launch-chrome.mjs');
  if (existsSync(launcher)) {
    try {
      const { launchPlacedChrome } = await import(pathToFileURL(launcher).href);
      return { browser: await launchPlacedChrome({ place: 'offscreen', purpose: 'user-walk' }), via: 'launchPlacedChrome()' };
    } catch (err) {
      console.warn(`[walk] launchPlacedChrome unavailable (${err.message}); launching directly`);
    }
  }
  const entry = resolvePkg('playwright-core') || resolvePkg('playwright');
  if (!entry) throw new Error(`playwright-core not found; run: ${INSTALL}`);
  const mod = await import(pathToFileURL(entry).href);
  const chromium = mod.chromium ?? mod.default?.chromium;
  const args = ['--window-position=-2400,-2400', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
  try {
    return { browser: await chromium.launch({ headless: false, channel: 'chrome', args }), via: 'installed Chrome' };
  } catch {
    // no installed Chrome: bundled Chromium, still headed
    return { browser: await chromium.launch({ headless: false, args }), via: 'bundled Chromium' };
  }
}

function screenOf(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname + u.hash;
  } catch {
    return url;
  }
}

async function serve(dir) {
  const o = JSON.parse(readFileSync(join(dir, 'options.json'), 'utf8'));
  const skip = new RegExp(o.skip ? `${DEFAULT_SKIP}|${o.skip}` : DEFAULT_SKIP, 'i');
  const allowed = new Set([new URL(o.url).origin, ...o.origins]);
  const stepsFile = join(dir, 'steps.jsonl');
  const record = (s) => appendFileSync(stepsFile, JSON.stringify({ t: new Date().toISOString(), ...s }) + '\n');
  const blockedFile = join(dir, 'blocked.jsonl');

  let browser;
  let via;
  try {
    ({ browser, via } = await launch());
  } catch (err) {
    writeFileSync(join(dir, 'driver.json'), JSON.stringify({ error: err.message }));
    process.exitCode = 1;
    return;
  }
  const context = await browser.newContext({
    viewport: { width: o.width, height: o.height },
    ...(o.storageState ? { storageState: o.storageState } : {}),
  });

  const events = [];
  await context.route('**/*', (route, req) => {
    let u;
    try {
      u = new URL(req.url());
    } catch {
      return route.continue();
    }
    if (!/^https?:$/.test(u.protocol) || allowed.has(u.origin)) return route.continue();
    let topNav = false;
    try {
      topNav = req.isNavigationRequest() && req.frame() === req.frame().page().mainFrame();
    } catch { /* service worker request: no frame */ }
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method());
    if (!topNav && !write) return route.continue();
    appendFileSync(blockedFile, JSON.stringify({ t: new Date().toISOString(), method: req.method(), url: req.url(), kind: topNav ? 'left the app' : 'write to another origin' }) + '\n');
    if (topNav) events.push(`blocked: the page tried to leave the app for ${u.origin}`);
    return route.abort('blockedbyclient');
  });

  let page = await context.newPage();
  const watch = (p) => {
    p.on('dialog', async (d) => {
      events.push(`browser ${d.type()} dialog: "${d.message()}" (${d.type() === 'alert' ? 'accepted' : 'dismissed'})`);
      await (d.type() === 'alert' ? d.accept() : d.dismiss()).catch(() => {});
    });
    p.on('download', (d) => events.push(`a file downloaded: ${d.suggestedFilename()}`));
  };
  // copy buttons are features too; let them reach the clipboard instead of failing silently
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(o.url).origin }).catch(() => {});
  watch(page);
  context.on('page', async (p) => {
    watch(p);
    await p.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
    let origin = '';
    try {
      origin = new URL(p.url()).origin;
    } catch { /* about:blank */ }
    if (allowed.has(origin)) {
      page = p;
      events.push(`opened a new tab: ${p.url()} (now acting in it)`);
    } else {
      events.push(`a new tab to ${p.url() || 'another site'} was closed: outside the app`);
      await p.close().catch(() => {});
    }
  });

  await page.goto(o.url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((err) => events.push(`start page error: ${err.message.split('\n')[0]}`));
  await page.waitForTimeout(800);

  const seen = new Set([screenOf(page.url())]);
  let refs = new Map();
  let shot = 0;
  let count = 0;
  let ended = false;

  const settle = async () => {
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(700);
  };
  const nameOf = (ref) => refs.get(ref) ?? '';

  async function enterTargets() {
    // what pressing Enter would trigger: the focused control and its form's submit buttons
    return page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return [];
      const names = [el.getAttribute('aria-label') || el.textContent || el.value || ''];
      const form = el.form || el.closest?.('form');
      if (form) {
        for (const b of form.querySelectorAll('button, input[type=submit]')) {
          if ((b.type || 'submit') === 'submit') names.push(b.getAttribute('aria-label') || b.textContent || b.value || '');
        }
        names.push(form.getAttribute('action') || '');
      }
      return names.map((s) => s.trim()).filter(Boolean);
    }).catch(() => []);
  }

  async function look() {
    const snap = await page.locator('body').ariaSnapshot({ mode: 'ai', timeout: 10000 });
    refs = new Map();
    for (const line of snap.split('\n')) {
      const m = line.match(/^\s*- (.*?)\s*\[ref=([a-z0-9]+)\]/);
      if (m) refs.set(m[2], m[1].replace(/\s*\[(?:active|cursor=pointer|level=\d+|checked|disabled|expanded|selected)[^\]]*\]/g, '').trim());
    }
    shot++;
    const file = join(o.shots, `${String(shot).padStart(3, '0')}.png`);
    await page.screenshot({ path: file }).catch(() => {});
    const pos = await page.evaluate(() => ({ y: Math.round(scrollY), h: document.documentElement.scrollHeight, vh: innerHeight })).catch(() => ({}));
    const max = 40000;
    const body = snap.length > max ? `${snap.slice(0, max)}\n... (page text cut at ${max} characters)` : snap;
    return [
      `URL: ${page.url()}`,
      `Title: ${await page.title().catch(() => '')}`,
      `Screenshot of what is on screen now: ${file}`,
      `Scrolled ${pos.y ?? '?'} px of ${pos.h ?? '?'} px (window ${pos.vh ?? '?'} px tall)`,
      '',
      body,
    ].join('\n');
  }

  async function act(command, args) {
    if (command === 'click' || command === 'hover' || command === 'fill' || command === 'select') {
      const ref = args[0];
      const loc = page.locator(`aria-ref=${ref}`);
      if (command === 'click') await loc.click({ timeout: 5000 });
      else if (command === 'hover') await loc.hover({ timeout: 5000 });
      else if (command === 'fill') await loc.fill(args.slice(1).join(' '), { timeout: 5000 });
      else await loc.selectOption({ label: args.slice(1).join(' ') }, { timeout: 5000 }).catch(() => loc.selectOption(args.slice(1).join(' '), { timeout: 5000 }));
    } else if (command === 'press') {
      await page.keyboard.press(args[0]);
    } else if (command === 'scroll') {
      const dy = (args[0] === 'up' ? -1 : 1) * Math.round(o.height * 0.8);
      await page.mouse.wheel(0, dy);
    } else if (command === 'back') {
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
    } else if (command === 'home') {
      await page.goto(o.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
  }

  async function handle(command, args) {
    if (command === 'look') {
      const text = await look();
      record({ action: 'look', screenBefore: screenOf(page.url()) });
      return { ok: true, text: withEvents(text) };
    }
    if (command === 'note') {
      record({ action: 'note', text: args.join(' '), screenBefore: screenOf(page.url()) });
      return { ok: true, text: 'noted' };
    }
    if (command === 'end') {
      const outcome = args[0];
      if (!['found', 'gave-up'].includes(outcome)) return { ok: false, text: 'end needs found or gave-up, then a sentence' };
      ended = true;
      record({ action: 'end', arg: outcome, text: args.slice(1).join(' '), screenBefore: screenOf(page.url()) });
      return { ok: true, text: `ended: ${outcome}. Stop here; report back.` };
    }
    if (command === 'save-state') {
      // main session only: keep a test account's signed-in session for the walkers' --storage-state
      if (!args[0]) return { ok: false, text: 'save-state needs a file path' };
      await context.storageState({ path: resolve(args[0]) });
      return { ok: true, text: `saved signed-in state to ${resolve(args[0])}; keep it out of reports and commits` };
    }
    if (command === 'stop') {
      setTimeout(() => shutdown(0), 100);
      return { ok: true, text: 'stopping' };
    }
    if (!ACTIONS.has(command)) return { ok: false, text: `unknown command ${command}` };
    if (ended) return { ok: false, text: 'this walk has ended' };
    if (count >= o.maxActions) return { ok: false, text: `action budget (${o.maxActions}) spent: end with gave-up and say where you were looking` };

    const needsRef = ['click', 'hover', 'fill', 'select'].includes(command);
    if (needsRef && !refs.has(args[0] || '')) return { ok: false, text: `no ref ${args[0] || '(none)'} in the last look; run look and use a ref from it` };
    const before = page.url();
    const name = needsRef ? nameOf(args[0]) : '';
    const base = { action: command, ref: args[0], name, arg: command === 'fill' || command === 'select' ? args.slice(1).join(' ') : args[0], screenBefore: screenOf(before) };

    let targets = [];
    if (command === 'click') targets = [name];
    if (command === 'press' && args[0] === 'Enter') targets = await enterTargets();
    const hit = targets.find((t) => skip.test(t));
    if (hit) {
      record({ ...base, refused: `on the skip list (${hit})` });
      return { ok: false, text: `refused: ${hit} is on the skip list. You found it; do not try to work around this. End the walk if this was the goal.` };
    }

    count++;
    try {
      await act(command, args);
      await settle();
    } catch (err) {
      record({ ...base, error: err.message.split('\n')[0] });
      return { ok: false, text: withEvents(`that did not work: ${err.message.split('\n')[0]}`) };
    }
    if (page.url().startsWith('chrome-error://')) {
      // the blocked navigation left an error page; return to where the walker was
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => page.goto(before, { waitUntil: 'domcontentloaded' }).catch(() => {}));
      await settle();
      record({ ...base, blocked: 'leaves the app', screenAfter: screenOf(page.url()) });
      return { ok: false, text: withEvents(`refused: that goes to another site, outside this app. You are back on ${page.url()}.`) };
    }
    const after = page.url();
    const sb = screenOf(before);
    const sa = screenOf(after);
    const revisit = sa !== sb && seen.has(sa);
    seen.add(sa);
    record({ ...base, screenAfter: sa, revisit, urlAfter: after, ...(events.length ? { events: [...events] } : {}) });
    const where = sa === sb ? 'same screen' : `${revisit ? 'back on a screen you saw before' : 'new screen'}: ${after}`;
    return { ok: true, text: withEvents(`ok (${count}/${o.maxActions} actions): ${command}${name ? ` ${name}` : ''} → ${where}. Run look to see the page.`) };
  }

  function withEvents(text) {
    if (!events.length) return text;
    const out = `${events.join('\n')}\n${text}`;
    events.length = 0;
    return out;
  }

  let idle;
  const touch = () => {
    clearTimeout(idle);
    idle = setTimeout(() => shutdown(0), IDLE_MS);
  };
  async function shutdown(code) {
    await browser.close().catch(() => {});
    server.close();
    process.exitCode = code;
  }

  let queue = Promise.resolve();
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      touch();
      queue = queue.then(async () => {
        let out;
        try {
          const { cmd: c, args = [] } = JSON.parse(data || '{}');
          out = await handle(c, args);
        } catch (err) {
          out = { ok: false, text: `driver error: ${err.message.split('\n')[0]}` };
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(out));
      });
    });
  });
  server.listen(0, '127.0.0.1', () => {
    writeFileSync(join(dir, 'driver.json'), JSON.stringify({ port: server.address().port, pid: process.pid, launchedVia: via }));
    touch();
  });
  browser.on('disconnected', () => {
    server.close();
    clearTimeout(idle);
  });
}
