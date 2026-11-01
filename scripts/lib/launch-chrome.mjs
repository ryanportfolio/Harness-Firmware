/* Headed Chrome launcher that keeps the window out of the operator's way.

   Visual verification runs headed on the real GPU: headless Chromium renders
   WebGL through SwiftShader on the CPU, which is slow and burns the machine the
   session is running on. The cost of headed is that the window lands on top of
   whatever the operator is doing and takes the keyboard with it.

   Placement, via CHROME_PLACE (default 'other-monitor'):
     other-monitor  fill the working area of a display that is not the one holding
                    the foreground window; falls back to 'offscreen' on one display
     offscreen      park the window at -2400,-2400 (rendered, never visible)
     here           plain headed launch, no placement

   Minimizing was measured and rejected: a minimized window loses its compositor
   surface on Windows, so requestAnimationFrame throttles to 1 Hz even with
   --disable-features=CalculateNativeWinOcclusion, and every frame-timing or
   animation reading taken through it is garbage. Screenshots still come back
   fresh at 1 Hz, so a static DOM check will not catch it. Both modes here hold
   full refresh rate (measured 100.5 fps on a 100 Hz panel).

   Placement is Windows-only; elsewhere this is a plain headed launch.

   Windows password probe: Chrome 156 asks, for every tab, whether the device can
   re-authenticate when AutofillAiWalletPrivatePasses or AutofillAmbientAutofill is
   on. On a profile with no cached answer that check calls LogonUser(<user>, ".", "")
   to test for a blank password, and Windows logs a failed logon (Security event 4625).
   Playwright gives every launch a fresh profile, so every verification Chrome added
   one, enough to trip an account lockout policy. Both features stay disabled here.

   Chrome keeps only the last --disable-features switch, and Playwright passes its own
   list before any args added here. So the launcher sends one merged switch, last:
   Playwright's list, the two features above, and any --disable-features in args.
*/
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const PS1 = join(dirname(fileURLToPath(import.meta.url)), 'window-place.ps1');
const OFFSCREEN = { x: -2400, y: -2400, width: 1600, height: 1000 };

const BACKGROUNDING_ARGS = [
  // an unfocused window is still doing real work; do not let Chrome idle it down
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  // verification windows stay silent: pages with music or effects would play to the operator
  '--mute-audio',
];

// stop the blank-password LogonUser probe (see the header)
const DISABLED_FEATURES = ['AutofillAiWalletPrivatePasses', 'AutofillAmbientAutofill'];
const DISABLE_FEATURES = '--disable-features=';

// Playwright does not export its disabled-feature list, so read it from the installed bundle.
// Without it, the merged switch would turn Playwright's entries (request interception fixes,
// HttpsUpgrades, PaintHolding, ...) back on.
function playwrightBundle() {
  const req = createRequire(import.meta.url);
  const errors = [];
  // same order as loadChromium(): the playwright-core that playwright itself runs comes first
  for (const from of [() => createRequire(req.resolve('playwright')), () => req]) {
    try {
      return from().resolve('playwright-core/lib/coreBundle');
    } catch (err) {
      errors.push(err.message.split('\n')[0]);
    }
  }
  throw new Error(`playwright-core/lib/coreBundle not found (needs Playwright 1.60 or later): ${errors.join('; ')}`);
}

let playwrightDisabled;
function playwrightDisabledFeatures() {
  if (playwrightDisabled) return playwrightDisabled;
  try {
    // the list's closing bracket sits on its own line; a ] inside a comment or entry does not end it
    const list = readFileSync(playwrightBundle(), 'utf8').match(/disabledFeatures = \[([\s\S]*?)\n\s*\]/)?.[1];
    const names = list ? [...list.replace(/\/\/.*$/gm, '').matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
    if (!names.length) throw new Error('list not found in playwright-core/lib/coreBundle.js');
    playwrightDisabled = names;
  } catch (err) {
    console.warn(`[launch-chrome] Playwright's own --disable-features list is off for every launch in this process: ${err.message}`);
    playwrightDisabled = [];
  }
  return playwrightDisabled;
}

function mergeDisableFeatures(args) {
  const own = args.filter((a) => a.startsWith(DISABLE_FEATURES)).flatMap((a) => a.slice(DISABLE_FEATURES.length).split(','));
  const names = new Set([...playwrightDisabledFeatures(), ...DISABLED_FEATURES, ...own].filter(Boolean));
  return [...args.filter((a) => !a.startsWith(DISABLE_FEATURES)), DISABLE_FEATURES + [...names].join(',')];
}

async function loadChromium() {
  for (const pkg of ['playwright', 'playwright-core']) {
    try {
      return (await import(pkg)).chromium;
    } catch { /* try the next one */ }
  }
  throw new Error('launch-chrome needs playwright or playwright-core installed');
}

function powershell(args) {
  const res = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, ...args],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) throw new Error(res.stderr?.trim() || `window-place.ps1 ${args[0]} failed`);
  return res.stdout.trim();
}

function plan(mode) {
  if (process.platform !== 'win32' || mode === 'here') return null;
  if (mode === 'offscreen') return { ...OFFSCREEN, hwnd: null, target: 'offscreen' };
  try {
    const p = JSON.parse(powershell(['plan']));
    if (p.sameScreen) return { ...OFFSCREEN, hwnd: p.hwnd, target: 'offscreen (single display)' };
    return p;
  } catch (err) {
    console.warn(`[launch-chrome] placement skipped: ${err.message}`);
    return null;
  }
}

/* Launch headed Chrome, placed. Returns what chromium.launch() returns.
   Extra opts: place ('other-monitor' | 'offscreen' | 'here'), args (appended; any
   --disable-features in them joins the one merged switch), purpose (label recorded by the servers skill). */
export async function launchPlacedChrome({ place, args = [], purpose, ...opts } = {}) {
  const chromium = await loadChromium();
  const mode = place || process.env.CHROME_PLACE || 'other-monitor';
  const spot = plan(mode);
  // Chrome ignores unknown switches; this one lets the servers skill find the process, since
  // a Playwright Browser from launch() exposes no pid
  const marker = `--harness-launch=${randomUUID()}`;

  const launchArgs = mergeDisableFeatures([
    marker,
    ...BACKGROUNDING_ARGS,
    ...(spot ? [`--window-position=${spot.x},${spot.y}`, `--window-size=${spot.width},${spot.height}`] : []),
    ...args,
  ]);

  let browser;
  try {
    browser = await chromium.launch({ headless: false, channel: 'chrome', ...opts, args: launchArgs });
  } catch {
    // no system Chrome; bundled Chromium still uses the real GPU. never fall back to headless
    browser = await chromium.launch({ headless: false, ...opts, args: launchArgs });
  }

  if (spot?.hwnd) {
    // Chrome takes the foreground as it maps its window; give it back once it has
    await new Promise((r) => setTimeout(r, 900));
    try {
      powershell(['focus', String(spot.hwnd)]);
    } catch (err) {
      console.warn(`[launch-chrome] focus restore failed: ${err.message}`);
    }
  }
  if (spot) console.log(`[launch-chrome] window on ${spot.target} at ${spot.x},${spot.y}`);
  // record the browser so the servers skill can say which session opened it and close it later;
  // optional: a project without that skill still gets its browser
  try {
    const servers = await import('../../.claude/skills/servers/scripts/servers.mjs');
    if (!servers.registerByMarker(marker, { purpose: purpose || 'verification browser' })) {
      console.warn('[launch-chrome] browser record skipped: launched process not found');
    }
  } catch (err) {
    console.warn(`[launch-chrome] browser record skipped: ${err.message}`);
  }
  return browser;
}
