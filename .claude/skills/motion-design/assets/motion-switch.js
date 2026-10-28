/* motion-switch.js: one Off / On / X-ray switch for a page with several moving layers.
   See ../references/page-runtime.md.

   Mode, first match wins: ?motion=on|off|xray in the URL, the visitor's saved choice, prefers-reduced-motion
   (off), else on. <html data-motion="..."> mirrors it for CSS.
     off   every <video autoplay> pauses; each piece shows its finished still (it subscribes, below)
     on    everything plays
     xray  everything plays, and each [data-xray] element is outlined and labelled with its data-xray text
           and data-xray-tool, e.g. data-xray="Scroll film, 3 chained clips" data-xray-tool="generated video"
   API: Motion.mode, Motion.set(mode), Motion.on(fn) runs fn(mode) now and on every change, returns an unsubscribe.
   Control: put <div data-motion-switch></div> where the buttons belong. Key M cycles the modes, except while
   typing in a field. */
(() => {
  const MODES = ['on', 'off', 'xray'];
  const NAMES = { on: 'On', off: 'Off', xray: 'X-ray' };
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fromUrl = new URLSearchParams(location.search).get('motion');
  let saved = null;
  try { saved = localStorage.getItem('motion'); } catch {}
  let mode = MODES.includes(fromUrl) ? fromUrl : MODES.includes(saved) ? saved : reduce.matches ? 'off' : 'on';
  let chosen = MODES.includes(fromUrl) || MODES.includes(saved);
  const listeners = new Set();
  const buttons = [];
  let labels = [], raf = 0;

  root.dataset.motion = mode;

  function place() {
    for (const [el, label] of labels) {
      const r = el.getBoundingClientRect();
      label.hidden = !r.width && !r.height;
      label.style.transform = `translate(${Math.round(r.left + 6)}px, ${Math.round(r.top + 6)}px)`;
    }
    raf = requestAnimationFrame(place);
  }

  function xray(show) {
    cancelAnimationFrame(raf);
    for (const [, label] of labels) label.remove();
    labels = [];
    if (!show) return;
    for (const el of document.querySelectorAll('[data-xray]')) {
      const label = document.createElement('div');
      label.className = 'xray-label';
      label.textContent = [el.dataset.xray, el.dataset.xrayTool].filter(Boolean).join(' · ');
      document.body.appendChild(label);
      labels.push([el, label]);
    }
    place();
  }

  function apply(notify = true) {
    root.dataset.motion = mode;
    for (const v of document.querySelectorAll('video[autoplay]')) {
      if (mode === 'off') v.pause(); else v.play().catch(() => {});
    }
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    xray(mode === 'xray');
    if (notify) for (const fn of listeners) fn(mode);
  }

  function set(next, persist = true) {
    if (!MODES.includes(next)) return;
    // Save first: clicking the mode already showing is still an explicit choice that the OS setting must not undo.
    if (persist) { chosen = true; try { localStorage.setItem('motion', next); } catch {} }
    if (next === mode) return;
    mode = next;
    apply();
  }

  function mount(host) {
    host.classList.add('motion-switch');
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Motion');
    for (const m of MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.mode = m;
      b.textContent = NAMES[m];
      b.addEventListener('click', () => set(m));
      host.appendChild(b);
      buttons.push(b);
    }
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = [
      '.motion-switch{display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);font:500 12px/1 system-ui,sans-serif}',
      '.motion-switch button{all:unset;cursor:pointer;padding:7px 11px;border-radius:999px;color:rgba(255,255,255,.8)}',
      '.motion-switch button[aria-pressed="true"]{background:#fff;color:#111}',
      '.motion-switch button:focus-visible{outline:2px solid #fff;outline-offset:2px}',
      '.xray-label{position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;max-width:280px;padding:4px 7px;border-radius:6px;background:#111;color:#fff;font:500 11px/1.35 ui-monospace,Consolas,monospace;box-shadow:0 0 0 1px rgba(255,255,255,.3)}',
      '[data-motion="xray"] [data-xray]{outline:1px dashed #ff4fa3;outline-offset:2px}',
    ].join('');
    document.head.appendChild(style);
    document.querySelectorAll('[data-motion-switch]').forEach(mount);
    document.addEventListener('keydown', e => {
      if (e.key !== 'm' && e.key !== 'M') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      set(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
    });
    // Follow the OS setting while the visitor has made no choice of their own.
    reduce.addEventListener('change', () => { if (!chosen) set(reduce.matches ? 'off' : 'on', false); });
    apply(false); // subscribers already got the mode from Motion.on
  }

  window.Motion = {
    get mode() { return mode; },
    set,
    on(fn) { listeners.add(fn); fn(mode); return () => listeners.delete(fn); },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
