#!/usr/bin/env node
/* seo-loop classic check: crawl a running site and report the SEO faults that
   keep pages out of the index or split them across URLs.

   Reads raw HTML only, the way a crawler sees it on the first fetch. It does not
   run JavaScript, so tags a framework adds in the browser are invisible here;
   Google renders pages later, but canonical, noindex and hreflang belong in the
   server's HTML. Zero dependencies, Node 20 or newer.

     node seo-check.mjs <url> [--out report.json] [--max-pages 200] [--urls list.txt | --include list.txt] [--delay ms] [--public-origin https://example.com]
     node seo-check.mjs diff <before.json> <after.json>

   Check mode crawls internal links breadth-first from <url>, then fetches the
   sitemap URLs it has not seen, until --max-pages HTML fetches. --urls checks
   only the listed URLs (one per line) plus robots.txt and the sitemap;
   --include crawls as usual and also fetches the listed URLs. URLs
   robots.txt disallows for Googlebot are reported, not fetched, and so are
   redirects into them. Nothing outside the audited origin is fetched.

   --public-origin: when <url> is a local preview of a site whose canonical,
   hreflang, sitemap and link URLs name the production origin, those URLs are
   read as the same paths on the preview. Without it, a local run whose sitemap
   lists another origin is reported incomplete.

   Exit codes, check mode: 0 no fail findings, 1 fail findings, 2 incomplete
   (start URL unreachable or not HTML). Diff mode takes two seo-check reports or
   two willaicite (geo-audit --json) reports: 0 nothing new, 1 a new fail or warn
   finding or a lower willaicite dimension score, 2 the inputs can't be compared
   (different tools or start URLs, a run that never reached its page with
   HTTP 200, or a finding that vanished only because the later crawl did not
   fetch its URL). Info findings are left out of the comparison.

   Finding ids are stable across runs (rule plus URL or duplicate key), so diff
   can say which findings a round fixed and which it introduced. */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const UA = 'Mozilla/5.0 (compatible; seo-check/1; +https://github.com/ryanportfolio/Harness-Firmware)';
const MAX_BYTES = 5_000_000;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 10;
const MAX_SITEMAP_FILES = 50;
const TITLE_DISPLAY_CHARS = 70;
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|css|m?js|json|xml|txt|zip|gz|mp4|webm|mov|mp3|wav|ogg|woff2?|ttf|otf|eot)$/i;
// Google supports only ISO 639-1 languages and ISO 3166-1 alpha-2 regions (so not eng, es-419, en-UK),
// plus an optional ISO 15924 script (zh-Hant). Script codes are checked for shape only.
const ISO_639_1 = new Set('aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'.split(' '));
const ISO_3166_1 = new Set('ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw'.split(' '));
const validHreflang = (value) => {
  const v = value.toLowerCase();
  if (v === 'x-default') return true;
  const m = /^([a-z]{2})(?:-([a-z]{4}))?(?:-([a-z]{2}))?$/.exec(v);
  return Boolean(m) && ISO_639_1.has(m[1]) && (!m[3] || ISO_3166_1.has(m[3]));
};

function usage() {
  return 'usage:\n  node seo-check.mjs <url> [--out report.json] [--max-pages 200] [--urls list.txt | --include list.txt] [--delay ms] [--public-origin https://example.com]\n  node seo-check.mjs diff <before.json> <after.json>\n';
}

// ---------- fetching ----------

/** Read at most MAX_BYTES, then cancel, so a huge response never lands in memory whole. */
async function readCapped(res) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size >= MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

async function fetchOnce(url) {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5' },
    });
    const headers = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const type = headers['content-type'] ?? '';
    let body = null;
    if (res.status >= 200 && res.status < 300 && /html|xml|text\/plain/i.test(type)) {
      body = await readCapped(res);
    } else {
      await res.body?.cancel().catch(() => undefined);
    }
    return { status: res.status, headers, body, error: null };
  } catch (err) {
    const msg = err?.name === 'TimeoutError' ? `timeout after ${TIMEOUT_MS} ms` : (err?.cause?.code ?? err?.message ?? String(err));
    return { status: null, headers: {}, body: null, error: msg };
  }
}

/** Follow redirects by hand so the chain is visible. `rewrite(next)` maps a hop
    before it is checked (production origin -> preview). `guard(next)` returns a
    reason to stop before fetching a hop (robots.txt, another origin), or null;
    the stopped hop stays in the chain with status null. */
async function fetchChain(url, guard = () => null, rewrite = (u) => u) {
  const chain = [];
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetchOnce(current);
    chain.push({ url: current, status: res.status });
    const loc = res.headers.location;
    if (res.status >= 300 && res.status < 400 && loc) {
      let next;
      try { next = rewrite(new URL(loc, current).href); } catch { return { ...res, chain, finalUrl: current, error: `bad Location header: ${loc}` }; }
      if (chain.some((c) => c.url === next)) return { ...res, chain, finalUrl: next, error: 'redirect loop' };
      const stop = await guard(next);
      if (stop) return { ...res, body: null, chain: [...chain, { url: next, status: null }], finalUrl: next, error: null, stopped: stop };
      current = next;
      continue;
    }
    return { ...res, chain, finalUrl: current };
  }
  return { status: null, headers: {}, body: null, chain, finalUrl: current, error: `more than ${MAX_REDIRECTS} redirects` };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- robots.txt (Google's rules: most specific group, longest match, allow wins ties) ----------

function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let group = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'sitemap') { if (value) sitemaps.push(value); continue; }
    if (key === 'user-agent') {
      if (!lastWasAgent || !group) { group = { agents: [], rules: [] }; groups.push(group); }
      group.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!group) continue;
    if ((key === 'allow' || key === 'disallow') && value) group.rules.push({ allow: key === 'allow', pattern: value });
  }
  return { groups, sitemaps };
}

function rulesFor(robots, agent) {
  const exact = robots.groups.filter((g) => g.agents.includes(agent));
  const chosen = exact.length ? exact : robots.groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

/** Rules and URL paths compare in one form: non-ASCII and spaces percent-encoded
    as UTF-8, existing escapes upper-cased. `Disallow: /café` then matches `/caf%C3%A9`. */
const encodeForMatch = (s) => s
  .replace(/[^\x21-\x7e]/gu, (c) => encodeURIComponent(c))
  .replace(/%[0-9a-f]{2}/gi, (e) => {
    // An escaped unreserved character is the character itself (/priv%61te = /private).
    const c = String.fromCharCode(parseInt(e.slice(1), 16));
    return /[A-Za-z0-9\-._~]/.test(c) ? c : e.toUpperCase();
  });

function patternMatches(pattern, path) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + body + (anchored ? '$' : '')).test(path);
}

function googlebotAllowed(robots, url) {
  if (!robots) return true;
  const u = new URL(url);
  const path = encodeForMatch(u.pathname + u.search);
  if (u.pathname === '/robots.txt') return true;
  let best = null;
  for (const rule of rulesFor(robots, 'googlebot')) {
    const pattern = encodeForMatch(rule.pattern);
    if (!patternMatches(pattern, path)) continue;
    const len = pattern.length;
    if (!best || len > best.len || (len === best.len && rule.allow)) best = { allow: rule.allow, len };
  }
  return best ? best.allow : true;
}

// ---------- sitemap ----------

// Sitemap elements may carry a namespace prefix (<sm:urlset xmlns:sm="...">).
const NS = '(?:[A-Za-z_][\\w.-]*:)?';
const hasRoot = (xml, name) => new RegExp(`<${NS}${name}\\b`, 'i').test(xml);
// A cut-off or malformed file must not pass as a complete sitemap: the root closes at the end,
// and every entry opens, closes and carries one <loc>.
const count = (xml, re) => xml.match(new RegExp(re, 'gi'))?.length ?? 0;
const wellFormed = (xml, root, entry) =>
  new RegExp(`</${NS}${root}\\s*>\\s*$`, 'i').test(xml)
  && count(xml, `<${NS}${entry}\\b`) === count(xml, `</${NS}${entry}\\s*>`)
  && count(xml, `<${NS}${entry}\\b`) === xmlLocs(xml, entry).length;

function xmlLocs(xml, parent) {
  const re = new RegExp(`<${NS}${parent}\\b[\\s\\S]*?<${NS}loc>\\s*([\\s\\S]*?)\\s*</${NS}loc>`, 'gi');
  const out = [];
  for (const m of xml.matchAll(re)) out.push(decodeEntities(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '')));
  return out;
}

// ---------- HTML ----------

// Out-of-range numeric references (&#x110000;) become U+FFFD, as browsers do, instead of throwing.
const codePoint = (n) => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '�');

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => codePoint(Number(d)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// The inside of a start tag: quoted values may contain `>` (href="/f?q=3>2").
const ATTRS = `(?:"[^"]*"|'[^']*'|[^'">])*`;

function attrs(s) {
  const out = {};
  for (const m of (s ?? '').matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

const text = (html) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function parseHtml(html, pageUrl) {
  let doc = html.replace(/<!--[\s\S]*?-->/g, '');
  const jsonld = [];
  doc = doc.replace(new RegExp(`<script\\b(${ATTRS})>([\\s\\S]*?)<\\/script\\s*>`, 'gi'), (_, a, body) => {
    if ((attrs(a).type ?? '').trim().toLowerCase() === 'application/ld+json') jsonld.push(body);
    return '';
  });
  doc = doc.replace(/<(style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const headEnd = doc.search(/<\/head\s*>|<body\b/i);
  const head = headEnd === -1 ? doc : doc.slice(0, headEnd);
  const body = headEnd === -1 ? '' : doc.slice(headEnd);

  const tags = (src, name) => [...src.matchAll(new RegExp(`<${name}\\b(${ATTRS})>`, 'gi'))].map((m) => attrs(m[1]));
  const baseHref = tags(head, 'base')[0]?.href;
  let base = pageUrl;
  try { if (baseHref) base = new URL(baseHref, pageUrl).href; } catch { /* keep page URL */ }

  const titles = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)].map((m) => text(m[1]));
  const metas = tags(head, 'meta');
  const metaContent = (name) => metas.filter((m) => (m.name ?? '').toLowerCase() === name).map((m) => m.content ?? '');
  const relHas = (l, token) => (l.rel ?? '').toLowerCase().split(/\s+/).includes(token);
  const headLinks = tags(head, 'link');
  const bodyLinks = tags(body, 'link');

  const links = [];
  for (const a of tags(doc, 'a')) {
    const href = (a.href ?? '').trim();
    if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      u.hash = '';
      links.push(u.href);
    } catch { /* unparseable href */ }
  }

  return {
    base, // document base URL: <base href>, else the page URL; relative metadata URLs resolve against it
    titles,
    descriptions: metaContent('description'),
    robots: [...metaContent('robots'), ...metaContent('googlebot')].join(',').toLowerCase(),
    viewport: metaContent('viewport').length > 0,
    canonicals: headLinks.filter((l) => relHas(l, 'canonical')).map((l) => l.href ?? ''),
    bodyCanonicals: bodyLinks.filter((l) => relHas(l, 'canonical')).map((l) => l.href ?? ''),
    hreflang: headLinks.filter((l) => relHas(l, 'alternate') && l.hreflang !== undefined).map((l) => ({ lang: l.hreflang, href: l.href ?? '' })),
    h1: [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].map((m) => text(m[1])),
    imgsNoAlt: tags(body, 'img').filter((i) => !('alt' in i)).length,
    jsonld,
    links: [...new Set(links)],
  };
}

function jsonldTypes(blocks) {
  const types = new Set();
  const errors = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    const t = v['@type'];
    if (t) (Array.isArray(t) ? t : [t]).forEach((x) => types.add(String(x)));
    Object.values(v).forEach(walk);
  };
  blocks.forEach((b, i) => {
    try { walk(JSON.parse(b)); } catch (err) { errors.push(`block ${i + 1}: ${err.message}`); }
  });
  return { types: [...types].sort(), errors };
}

// ---------- check mode ----------

function parseArgs(argv) {
  const opts = { url: null, out: null, maxPages: 200, urls: null, include: null, delay: null, publicOrigin: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const need = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`); return v; };
    if (a === '--out') opts.out = need();
    else if (a === '--max-pages') opts.maxPages = Number(need());
    else if (a === '--urls') opts.urls = need();
    else if (a === '--include') opts.include = need();
    else if (a === '--delay') opts.delay = Number(need());
    else if (a === '--public-origin') {
      const v = need();
      try { opts.publicOrigin = new URL(v).origin; } catch { throw new Error(`--public-origin "${v}" is not a URL`); }
    }
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else if (!opts.url) opts.url = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if (!opts.url) throw new Error('missing <url>');
  if (!Number.isInteger(opts.maxPages) || opts.maxPages < 1) throw new Error('--max-pages must be a positive integer');
  return opts;
}

async function check(opts) {
  const requested = new URL(/^https?:\/\//i.test(opts.url) ? opts.url : `https://${opts.url}`);
  requested.hash = '';
  // robots.txt per origin, fetched once. The start URL and each hop of its redirects
  // are checked against it before they are requested, like every other fetch.
  const robotsCache = new Map();
  const robotsFor = async (o) => {
    if (!robotsCache.has(o)) robotsCache.set(o, await fetchChain(o + '/robots.txt', (n) => (new URL(n).origin === o ? null : 'redirect leaves the origin; not followed')));
    const res = robotsCache.get(o);
    return res.status === 200 && res.body !== null ? parseRobots(res.body) : null;
  };
  const startGuard = async (next) => (googlebotAllowed(await robotsFor(new URL(next).origin), next) ? null : 'redirect target is disallowed by robots.txt; not followed');
  const startBlocked = !googlebotAllowed(await robotsFor(requested.origin), requested.href);
  // Crawl from where the start URL lands (http -> https, apex -> www, /old -> /new):
  // its origin decides which links are internal, and it is the page judged as the start page.
  // A preview that redirects to the production origin stays on the preview.
  const toPreview = (u) => {
    if (!opts.publicOrigin || opts.publicOrigin === requested.origin) return u;
    const x = new URL(u);
    return x.origin === opts.publicOrigin ? requested.origin + x.pathname + x.search + x.hash : u;
  };
  const first = startBlocked ? null : await fetchChain(requested.href, startGuard, toPreview);
  const start = new URL(first && first.status !== null && first.chain.length > 1 ? first.finalUrl : requested.href);
  const origin = start.origin;
  const publicOrigin = opts.publicOrigin && opts.publicOrigin !== origin ? opts.publicOrigin : null;
  // Read production-origin URLs (canonical, hreflang, sitemap, links) as the same path here.
  const mapUrl = (u) => {
    if (!publicOrigin) return u;
    try { const x = new URL(u); return x.origin === publicOrigin ? origin + x.pathname + x.search + x.hash : u; } catch { return u; }
  };
  const sameOrigin = (u) => { try { return new URL(u).origin === origin; } catch { return false; } };
  // Reuse that response as the start page's own fetch: its last hop is the start page.
  const prefetched = new Map();
  if (first && !first.error && !first.stopped && first.status !== null) prefetched.set(start.href, { ...first, chain: [first.chain.at(-1)], finalUrl: start.href });
  const local = /^(localhost|127\.|\[::1\])/.test(start.hostname);
  const delay = opts.delay ?? (local ? 0 : 200);
  const startedAt = new Date().toISOString();
  const findings = [];
  const add = (rule, severity, url, message, key = url) => findings.push({ id: `${rule}|${key}`, rule, severity, url, message });
  const limits = [
    'Raw HTML only: tags added by JavaScript in the browser are not seen.',
    'Structured data is checked for valid JSON and a @type, not against Google rich-result requirements.',
    'No rankings, Search Console data, Core Web Vitals or Lighthouse.',
    'An X-Robots-Tag noindex aimed at a named bot other than Googlebot is counted as if it applied to all crawlers.',
    `Responses are read only up to ${MAX_BYTES / 1e6} MB.`,
  ];

  if (start.href !== requested.href) add('start-redirects', 'info', requested.href, `start URL redirects to ${start.href} (${first.chain.map((c) => c.status).join(' -> ')}); crawled from there${first.stopped ? `, but ${first.stopped}` : ''}`);

  let fetches = robotsCache.size + (first ? 1 : 0);
  const fetchBudget = opts.maxPages + 50; // room for canonical and hreflang targets outside the crawl
  const pages = new Map();
  const linkedFrom = new Map();
  const timed = async (url, guard) => {
    if (fetches > 0 && delay > 0) await sleep(delay);
    fetches++;
    return fetchChain(url, guard, mapUrl);
  };
  const originGuard = (next) => (sameOrigin(next) ? null : 'redirect leaves the audited origin; not followed');
  let robots = null;
  const pageGuard = (next) => originGuard(next) ?? (googlebotAllowed(robots, next) ? null : 'redirect target is disallowed by robots.txt; not followed');
  let needsPublicOrigin = false;

  // robots.txt
  if (!robotsCache.has(origin)) { fetches++; await robotsFor(origin); }
  const robotsRes = robotsCache.get(origin);
  if (robotsRes.status === 200 && robotsRes.body !== null) robots = parseRobots(robotsRes.body);
  // Google treats 429 like a server error, not like a missing file.
  else if (robotsRes.status !== null && (robotsRes.status >= 500 || robotsRes.status === 429)) add('robots-server-error', 'fail', origin + '/robots.txt', `robots.txt answered ${robotsRes.status}; Google stops crawling the site for the first 12 hours of robots.txt server errors (429 counts as one)`);
  else if (robotsRes.error) add('robots-unreachable', 'fail', origin + '/robots.txt', `robots.txt fetch failed (${robotsRes.error}); Google treats that like a server error and stops crawling for the first 12 hours`);
  else add('robots-missing', 'info', origin + '/robots.txt', `no robots.txt (HTTP ${robotsRes.status}); crawlers treat that as "allow everything"`);
  if (robots && !googlebotAllowed(robots, origin + '/')) add('robots-blocks-root', 'fail', origin + '/robots.txt', 'robots.txt disallows / for Googlebot');

  // sitemaps
  const sitemapUrls = new Set();
  const robotsSitemaps = (robots?.sitemaps ?? []).map(mapUrl);
  const declared = robotsSitemaps.filter(sameOrigin);
  let sitemapComplete = true; // every sitemap file found was read; membership findings depend on it
  for (const s of robotsSitemaps) {
    if (declared.includes(s)) continue;
    sitemapComplete = false;
    add('sitemap-other-origin', 'info', s, 'robots.txt declares a sitemap on another origin; not fetched');
    // A local preview whose robots.txt names the production sitemap never reads the real sitemap.
    if (local && !publicOrigin) needsPublicOrigin = true;
  }
  const sitemapQueue = robotsSitemaps.length ? [...declared] : [origin + '/sitemap.xml'];
  const sitemapFiles = [];
  const fromIndex = new Set();
  while (sitemapQueue.length && sitemapFiles.length < MAX_SITEMAP_FILES) {
    const smUrl = sitemapQueue.shift();
    if (sitemapFiles.includes(smUrl)) continue;
    sitemapFiles.push(smUrl);
    if (/\.gz$/i.test(smUrl)) { sitemapComplete = false; add('sitemap-gzip', 'info', smUrl, 'gzipped sitemap not read'); continue; }
    // Google reads a sitemap only where robots.txt lets Googlebot fetch it, redirects included.
    const blocked = !googlebotAllowed(robots, smUrl);
    const res = blocked ? null : await timed(smUrl, pageGuard);
    if (blocked || res.status !== 200 || res.body === null) {
      sitemapComplete = false;
      const why = blocked ? 'is disallowed by robots.txt for Googlebot'
        : res.stopped ? `redirects to ${res.finalUrl}, not followed: ${res.stopped}`
        : `answered ${res.status ?? res.error}`;
      if (declared.includes(smUrl)) add('sitemap-unreachable', 'fail', smUrl, `sitemap declared in robots.txt ${why}`);
      else if (fromIndex.has(smUrl)) add('sitemap-unreachable', 'fail', smUrl, `sitemap listed in a sitemap index ${why}`);
      else if (!declared.length) add('sitemap-missing', 'warn', smUrl, `no sitemap declared in robots.txt and ${smUrl} ${why}`);
      continue;
    }
    if (res.chain.length > 1) add('sitemap-redirect', 'warn', smUrl, `sitemap redirects to ${res.finalUrl}`);
    const [root, entry] = hasRoot(res.body, 'sitemapindex') ? ['sitemapindex', 'sitemap'] : hasRoot(res.body, 'urlset') ? ['urlset', 'url'] : [];
    if (!root) { sitemapComplete = false; add('sitemap-invalid', 'fail', smUrl, 'sitemap is neither a <urlset> nor a <sitemapindex>'); continue; }
    if (!wellFormed(res.body, root, entry)) {
      sitemapComplete = false; // entries read so far are still crawled, but membership is not trusted
      add('sitemap-invalid', 'fail', smUrl, `sitemap XML is cut off or malformed: needs a closing </${root}> and one <loc> in every closed <${entry}>`);
    }
    if (root === 'sitemapindex') {
      for (const loc of xmlLocs(res.body, 'sitemap').map(mapUrl)) {
        if (sameOrigin(loc)) { fromIndex.add(loc); sitemapQueue.push(loc); }
        else { sitemapComplete = false; add('sitemap-other-origin', 'info', loc, `sitemap index ${smUrl} lists a sitemap on another origin; not fetched`); }
      }
    } else xmlLocs(res.body, 'url').forEach((loc) => sitemapUrls.add(mapUrl(loc)));
  }
  if (sitemapQueue.length) sitemapComplete = false;
  if (sitemapQueue.length) add('sitemap-files-skipped', 'info', origin, `${sitemapQueue.length} sitemap files beyond the first ${MAX_SITEMAP_FILES} not read`);
  if (!declared.length && sitemapUrls.size) add('sitemap-not-declared', 'info', origin + '/robots.txt', 'sitemap.xml exists but robots.txt has no Sitemap line');
  for (const loc of sitemapUrls) {
    try {
      if (new URL(loc).origin !== origin) {
        if (local && !publicOrigin) needsPublicOrigin = true;
        else add('sitemap-foreign-url', 'warn', loc, 'sitemap lists a URL on another origin');
      }
    } catch { add('sitemap-bad-url', 'fail', loc, 'sitemap <loc> is not a valid absolute URL'); }
  }

  const getPage = async (url) => {
    if (pages.has(url)) return pages.get(url);
    if (fetches >= fetchBudget) return null;
    if (!googlebotAllowed(robots, url)) {
      const rec = { url, blocked: true };
      pages.set(url, rec);
      return rec;
    }
    const res = prefetched.get(url) ?? await timed(url, pageGuard);
    prefetched.delete(url);
    const isHtml = /text\/html|application\/xhtml/i.test(res.headers['content-type'] ?? '');
    let html = null;
    let parseError = null;
    if (isHtml && res.body !== null) {
      try {
        html = parseHtml(res.body, res.finalUrl);
        html.links = [...new Set(html.links.map(mapUrl))];
      } catch (err) { parseError = err?.message ?? String(err); }
    }
    const rec = {
      url, blocked: false, status: res.status, finalUrl: res.finalUrl, chain: res.chain, error: res.error,
      stopped: res.stopped ?? null, html, parseError,
      xRobots: (res.headers['x-robots-tag'] ?? '').toLowerCase(),
    };
    rec.noindex = /\bnoindex\b|\bnone\b/.test(`${rec.xRobots},${rec.html?.robots ?? ''}`);
    rec.indexable = rec.status === 200 && rec.chain.length === 1 && rec.html !== null && !rec.noindex;
    pages.set(url, rec);
    return rec;
  };

  // crawl: start URL, then internal links breadth-first, then unseen sitemap URLs
  const queue = [];
  const queued = new Set();
  const enqueue = (u) => { if (!queued.has(u)) { queued.add(u); queue.push(u); } };
  // Listed URLs go through the same mapping and origin rule as discovered ones.
  const readList = (file) => readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => mapUrl(new URL(l, start).href))
    .filter((u) => (sameOrigin(u) ? true : (add('listed-url-other-origin', 'info', u, `${file} lists a URL on another origin; not fetched`), false)));
  let list = null;
  if (opts.urls) {
    list = readList(opts.urls);
    list.forEach(enqueue);
  } else {
    enqueue(start.href);
    // --include: URLs to fetch on top of the crawl, e.g. pages a previous run flagged.
    if (opts.include) readList(opts.include).forEach(enqueue);
  }
  let crawled = 0;
  let truncated = false;
  const runQueue = async (follow) => {
    while (queue.length) {
      if (crawled >= opts.maxPages) { truncated = true; return; }
      const url = queue.shift();
      const rec = await getPage(url);
      if (!rec) { truncated = true; return; }
      crawled++;
      // A redirect target is a page of its own: check it even when nothing links to it.
      if (!rec.blocked && rec.chain.length > 1 && sameOrigin(rec.finalUrl)) enqueue(rec.finalUrl);
      if (!follow || !rec.html) continue;
      for (const link of rec.html.links) {
        if (!sameOrigin(link)) continue;
        if (!linkedFrom.has(link)) linkedFrom.set(link, new Set());
        linkedFrom.get(link).add(rec.finalUrl);
        if (!SKIP_EXT.test(new URL(link).pathname)) enqueue(link);
      }
    }
  };
  await runQueue(!list);
  if (!truncated && !list) {
    for (const loc of sitemapUrls) if (sameOrigin(loc)) enqueue(loc);
    await runQueue(true); // sitemap-only pages link out too; same page budget
  }
  if (truncated) limits.push(`Crawl stopped at --max-pages ${opts.maxPages}; orphan results cover only links on fetched pages.`);

  const startRec = pages.get(list ? list[0] : start.href);

  // per-page findings
  const canonicalOf = (rec) => {
    const c = rec.html?.canonicals ?? [];
    if (c.length !== 1) return null;
    try { return mapUrl(new URL(c[0], rec.html.base).href); } catch { return null; }
  };
  const inSitemap = (rec) => sitemapUrls.has(rec.url) || sitemapUrls.has(rec.finalUrl);
  const linkedInfo = (url) => { const f = linkedFrom.get(url); return f ? ` (linked from ${[...f].slice(0, 3).join(', ')}${f.size > 3 ? ` and ${f.size - 3} more` : ''})` : ''; };

  const judge = async (rec) => {
    const { url } = rec;
    if (rec.blocked) {
      if (sitemapUrls.has(url)) add('sitemap-url-blocked', 'fail', url, 'sitemap lists a URL robots.txt disallows for Googlebot');
      else if (linkedFrom.has(url)) add('linked-url-blocked', 'info', url, `internal link to a URL robots.txt disallows for Googlebot${linkedInfo(url)}`);
      return;
    }
    if (rec.error || rec.status === null) { add('fetch-error', 'fail', url, `fetch failed: ${rec.error}${linkedInfo(url)}`); return; }
    const finalStatus = rec.status;
    if (finalStatus >= 400) {
      add('http-error', 'fail', url, `HTTP ${finalStatus}${rec.chain.length > 1 ? ` after redirect to ${rec.finalUrl}` : ''}${linkedInfo(url)}${inSitemap(rec) ? ' (listed in the sitemap)' : ''}`);
      return;
    }
    if (rec.chain.length > 2) add('redirect-chain', 'warn', url, `${rec.chain.length - 1} redirect hops: ${rec.chain.map((c) => `${c.status} ${c.url}`).join(' -> ')}`);
    if (rec.chain.length > 1) {
      const note = rec.stopped ? ` (${rec.stopped})` : '';
      if (sitemapUrls.has(url)) add('sitemap-url-redirects', 'warn', url, `sitemap lists a redirecting URL; list ${rec.finalUrl} instead${note}`);
      else if (linkedFrom.has(url)) add('linked-url-redirects', 'info', url, `internal links point at a redirect to ${rec.finalUrl}${note}${linkedInfo(url)}`);
      return; // the target is checked as its own page when it is crawled
    }
    if (finalStatus === 204 || finalStatus === 205) {
      add('http-no-content', 'fail', url, `HTTP ${finalStatus}: no content for Google to index${linkedInfo(url)}${inSitemap(rec) ? ' (listed in the sitemap)' : ''}`);
      return;
    }
    if (rec.parseError) { add('parse-error', 'fail', url, `HTML could not be read: ${rec.parseError}`); return; }
    if (!rec.html) {
      // Non-HTML files (PDFs, images) can still carry X-Robots-Tag: noindex.
      if (rec.noindex && inSitemap(rec)) add('sitemap-url-noindex', 'fail', url, 'sitemap lists a file whose X-Robots-Tag is noindex');
      else if (rec.noindex) add('noindex', 'info', url, 'file is noindex (X-Robots-Tag); confirm that is intended');
      return;
    }
    const h = rec.html;
    const isStart = url === startRec?.url || url === startRec?.finalUrl;

    if (rec.noindex) {
      if (isStart) add('start-noindex', 'fail', url, `the start page is noindex (${rec.xRobots ? 'X-Robots-Tag' : 'meta robots'})`);
      else if (inSitemap(rec)) add('sitemap-url-noindex', 'fail', url, 'sitemap lists a noindex page');
      else add('noindex', 'info', url, 'page is noindex; confirm that is intended');
    }
    if (!h.viewport) add('viewport-missing', 'warn', url, 'no <meta name="viewport">; Google indexes the mobile rendering');
    if (!h.titles.length) add('title-missing', 'fail', url, 'no <title> in <head>');
    else if (!h.titles[0]) add('title-empty', 'fail', url, '<title> is empty');
    else {
      if (h.titles.length > 1) add('title-multiple', 'warn', url, `${h.titles.length} <title> elements`);
      if (h.titles[0].length > TITLE_DISPLAY_CHARS) add('title-long', 'info', url, `title is ${h.titles[0].length} characters; results may cut it short`);
    }
    if (!h.descriptions.length || !h.descriptions[0].trim()) add('description-missing', 'warn', url, 'no meta description; Google writes its own snippet');
    if (!h.h1.length) add('h1-missing', 'info', url, 'no <h1>');
    if (h.imgsNoAlt) add('img-alt-missing', 'info', url, `${h.imgsNoAlt} <img> without an alt attribute`);

    // canonical
    if (h.bodyCanonicals.length && !h.canonicals.length) add('canonical-in-body', 'warn', url, 'rel=canonical sits in <body>, where Google ignores it');
    if (h.canonicals.length > 1) add('canonical-multiple', 'fail', url, `${h.canonicals.length} rel=canonical tags; Google ignores all of them`);
    else if (h.canonicals.length === 0) add('canonical-missing', 'info', url, 'no rel=canonical; Google picks the canonical itself');
    else if (!/^https?:\/\//i.test(h.canonicals[0])) add('canonical-relative', 'warn', url, `canonical "${h.canonicals[0]}" is relative; Google recommends an absolute URL`);
    const canon = canonicalOf(rec);
    if (canon && canon !== rec.finalUrl) {
      if (!sameOrigin(canon)) {
        if (local && !publicOrigin) needsPublicOrigin = true;
        add('canonical-other-origin', 'info', url, `canonical points to another origin: ${canon}`);
      }
      else {
        const target = await getPage(canon);
        if (!target) add('canonical-not-checked', 'info', url, `canonical target ${canon} not fetched (page budget)`);
        else if (target.blocked) add('canonical-target-bad', 'fail', url, `canonical ${canon} is disallowed by robots.txt`);
        else if (target.status !== 200 || target.chain.length > 1) add('canonical-target-bad', 'fail', url, `canonical ${canon} answers ${target.chain.map((c) => c.status).join(' -> ')}`);
        else if (target.noindex) add('canonical-target-bad', 'fail', url, `canonical ${canon} is noindex`);
        if (inSitemap(rec)) add('sitemap-url-canonicalized', 'warn', url, `sitemap lists a page whose canonical is ${canon}`);
      }
    }

    // hreflang
    const self = rec.finalUrl;
    let hasSelf = false;
    for (const alt of h.hreflang) {
      if (!validHreflang(alt.lang)) { add('hreflang-invalid', 'fail', url, `hreflang="${alt.lang}" is not an ISO 639-1 language with an optional script and ISO 3166-1 alpha-2 region, so Google ignores it`, `${url}|${alt.lang}`); continue; }
      if (!/^https?:\/\//i.test(alt.href)) add('hreflang-relative', 'warn', url, `hreflang ${alt.lang} href "${alt.href}" is not a fully qualified URL`, `${url}|${alt.lang}`);
      let target;
      try { target = mapUrl(new URL(alt.href, h.base).href); } catch { add('hreflang-invalid', 'fail', url, `hreflang ${alt.lang} href "${alt.href}" is not a URL`, `${url}|${alt.lang}`); continue; }
      if (target === self) { hasSelf = true; continue; }
      if (!sameOrigin(target)) continue;
      const other = await getPage(target);
      if (!other) { hreflangUnchecked.add(target); continue; }
      if (other.blocked) { add('hreflang-target-blocked', 'fail', url, `${target} (${alt.lang}) is disallowed by robots.txt, so Google cannot confirm the pair`, `${url}|${target}`); continue; }
      if (!other.html) continue; // the target's own status is judged as its own page
      const returns = other.html.hreflang.some((b) => { try { return mapUrl(new URL(b.href, other.html.base).href) === self; } catch { return false; } });
      if (!returns) add('hreflang-no-return', 'fail', url, `${target} (${alt.lang}) does not link back with hreflang; Google ignores one-way pairs`, `${url}|${target}`);
    }
    if (h.hreflang.length && !hasSelf) add('hreflang-no-self', 'warn', url, 'hreflang set does not include this page itself');

    // structured data
    if (h.jsonld.length) {
      const { types, errors } = jsonldTypes(h.jsonld);
      rec.jsonldTypes = types;
      for (const e of errors) add('jsonld-invalid', 'fail', url, `JSON-LD does not parse: ${e}`, `${url}|${e.split(':')[0]}`);
      if (!errors.length && !types.length) add('jsonld-no-type', 'warn', url, 'JSON-LD has no @type');
    }
  };

  // Judging a page can fetch its canonical or hreflang targets; judge those too,
  // so every fetched page gets the same checks.
  const judged = new Set();
  const hreflangUnchecked = new Set(); // hreflang targets past the fetch budget
  for (let pending = [...pages.values()]; pending.length; pending = [...pages.values()].filter((r) => !judged.has(r.url))) {
    for (const rec of pending) {
      judged.add(rec.url);
      await judge(rec);
    }
  }
  if (hreflangUnchecked.size) limits.push(`${hreflangUnchecked.size} hreflang target(s) past the fetch budget were not checked for return links: ${[...hreflangUnchecked].slice(0, 5).join(', ')}`);

  // A complete run read the start page itself: HTTP 200, no redirect, HTML (not 206 or 204).
  const startOk = Boolean(startRec && !startRec.blocked && startRec.status === 200 && startRec.chain.length === 1 && startRec.html);
  if (needsPublicOrigin) add('needs-public-origin', 'fail', start.href, 'local run, but robots.txt, the sitemap or canonical URLs name another origin; rerun with --public-origin <production origin> so those pages are checked here');
  const complete = startOk && !needsPublicOrigin;

  // site-wide findings
  const canonicalPages = [...pages.values()].filter((r) => r.indexable && (!canonicalOf(r) || canonicalOf(r) === r.finalUrl));
  const groupBy = (items, key) => items.reduce((m, r) => { const k = key(r); if (k) (m.get(k) ?? m.set(k, []).get(k)).push(r.url); return m; }, new Map());
  for (const [title, urls] of groupBy(canonicalPages, (r) => r.html.titles[0])) {
    if (urls.length > 1) { add('title-duplicate', 'warn', urls[0], `${urls.length} pages share the title "${title}": ${urls.join(', ')}`, title); findings.at(-1).urls = urls; }
  }
  for (const [desc, urls] of groupBy(canonicalPages, (r) => r.html.descriptions[0]?.trim())) {
    if (urls.length > 1) { add('description-duplicate', 'warn', urls[0], `${urls.length} pages share one meta description: ${urls.join(', ')}`, desc); findings.at(-1).urls = urls; }
  }
  if (sitemapUrls.size && !list) {
    // A fact about a fetched page, true however far the crawl got.
    // Only when every sitemap file was read: an unread file may list the page.
    if (sitemapComplete) for (const r of canonicalPages) {
      if (!inSitemap(r)) add('not-in-sitemap', 'warn', r.url, 'indexable page missing from the sitemap');
    }
    for (const loc of sitemapUrls) {
      const r = pages.get(loc);
      if (r?.indexable && loc !== startRec?.url && loc !== startRec?.finalUrl && !linkedFrom.has(loc) && !linkedFrom.has(r.finalUrl)) {
        add('orphan', truncated ? 'info' : 'warn', loc, 'in the sitemap but no crawled page links to it');
      }
    }
  }
  if (!startOk) add('start-unreadable', 'fail', start.href, startRec?.blocked ? 'robots.txt disallows the start URL for Googlebot' : `start page was not read as HTML with HTTP 200 (got ${startRec?.status ?? startRec?.error ?? 'nothing: not fetched'})`);

  const order = { fail: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule) || a.id.localeCompare(b.id));
  const seen = new Set();
  const unique = findings.filter((f) => (seen.has(f.id) ? false : seen.add(f.id)));
  const summary = { fail: 0, warn: 0, info: 0 };
  unique.forEach((f) => summary[f.severity]++);

  return {
    tool: 'seo-check',
    version: 1,
    url: start.href,
    requestedUrl: requested.href,
    startedAt,
    finishedAt: new Date().toISOString(),
    complete,
    truncated,
    fetches,
    publicOrigin,
    robots: { status: robotsRes.status, sitemaps: robots?.sitemaps ?? [] },
    sitemap: { files: sitemapFiles, complete: sitemapComplete, urls: sitemapUrls.size, list: [...sitemapUrls] },
    pages: [...pages.values()].map((r) => ({
      url: r.url,
      blocked: r.blocked,
      status: r.status ?? null,
      finalUrl: r.finalUrl ?? null,
      redirects: r.chain ? r.chain.length - 1 : 0,
      stopped: r.stopped ?? null,
      html: Boolean(r.html),
      indexable: Boolean(r.indexable),
      inSitemap: inSitemap(r),
      title: r.html?.titles[0] ?? null,
      canonical: canonicalOf(r),
      jsonldTypes: r.jsonldTypes ?? [],
    })),
    summary,
    findings: unique,
    limits,
  };
}

function printSummary(report, stream) {
  const byRule = new Map();
  for (const f of report.findings) {
    const k = `${f.severity}\t${f.rule}`;
    byRule.set(k, (byRule.get(k) ?? 0) + 1);
  }
  stream.write(`seo-check ${report.url}: ${report.pages.length} URLs, ${report.summary.fail} fail, ${report.summary.warn} warn, ${report.summary.info} info${report.truncated ? ' (crawl truncated)' : ''}${report.complete ? '' : ' (INCOMPLETE)'}\n`);
  for (const [k, n] of byRule) stream.write(`  ${k.replace('\t', '  ')}  x${n}\n`);
}

// ---------- diff mode ----------

const canonicalUrl = (u) => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).href; } catch { return u; } };

function normalize(report, label) {
  if (report?.tool === 'seo-check') {
    // Every URL the run fetched and got an answer from. A finding counts as fixed
    // only if the later run fetched its URL again (a robots.txt block is not a fetch).
    const origin = new URL(report.url).origin;
    const covered = new Set([report.url, origin, origin + '/robots.txt', ...(report.sitemap?.files ?? [])]);
    const coveredHtml = new Set(); // pages whose HTML was read, so HTML findings were rechecked
    for (const p of report.pages ?? []) {
      if (p.blocked || p.status === null) continue;
      covered.add(p.url);
      // A redirect the guard stopped never fetched its target.
      if (p.finalUrl && !p.stopped) covered.add(p.finalUrl);
      if (p.html && p.redirects === 0) coveredHtml.add(p.url);
    }
    return {
      kind: 'seo-check', valid: report.complete, url: report.url, truncated: Boolean(report.truncated), covered, coveredHtml,
      sitemapComplete: report.sitemap?.complete === true, sitemapList: new Set(report.sitemap?.list ?? []),
      findings: report.findings.filter((f) => f.severity !== 'info'), scores: {},
    };
  }
  if (report?.tool === 'geo-audit') {
    const findings = [];
    const scores = {};
    for (const d of report.dimensions ?? []) {
      scores[d.key] = d.score;
      for (const e of d.evidence ?? []) {
        if (e.status !== 'fail' && e.status !== 'warn') continue;
        // Counts inside messages change as a round makes progress; the id ignores them.
        findings.push({ id: `geo:${d.key}|${e.message.replace(/\d+/g, '#')}`, rule: `geo:${d.key}`, severity: e.status, url: report.url, message: e.message });
      }
    }
    // willaicite exits 0 and prints a score even when the page answered 404 or
    // never answered; pagesAudited lists only pages that answered 200.
    const url = canonicalUrl(report.url);
    const reached = report.finalUrl !== null && (report.pagesAudited ?? []).includes(url);
    return { kind: 'geo-audit', valid: reached && report.overallScore !== null, url, findings, scores };
  }
  throw new Error(`${label} is neither a seo-check nor a geo-audit report`);
}

function diff(beforePath, afterPath) {
  const a = normalize(JSON.parse(readFileSync(beforePath, 'utf8')), beforePath);
  const b = normalize(JSON.parse(readFileSync(afterPath, 'utf8')), afterPath);
  if (a.kind !== b.kind) { process.stderr.write(`cannot compare a ${a.kind} report with a ${b.kind} report\n`); return 2; }
  if (a.url !== b.url) { process.stderr.write(`different start URLs: ${a.url} vs ${b.url}\n`); return 2; }
  for (const [r, p] of [[a, beforePath], [b, afterPath]]) {
    if (!r.valid) { process.stderr.write(`${p} is incomplete (page not reached with HTTP 200, or nothing verified); not comparable\n`); return 2; }
  }
  const before = new Map(a.findings.map((f) => [f.id, f]));
  const after = new Map(b.findings.map((f) => [f.id, f]));
  if (a.kind === 'seo-check' && b.truncated && !a.truncated) {
    process.stderr.write(`${afterPath} stopped at its page budget and ${beforePath} did not; rerun with a higher --max-pages\n`);
    return 2;
  }
  const gone = a.findings.filter((f) => !after.has(f.id));
  // Sitemap-membership findings are settled by reading the later sitemap; the rest need their pages fetched again.
  // Findings read from a page's HTML need that page's HTML read again; status and
  // redirect findings only need it fetched.
  const statusRule = /^(http-error|http-no-content|fetch-error|redirect-chain|sitemap-|robots-|start-unreadable|needs-public-origin|linked-url-|listed-url-)/;
  // Sitemap-membership findings also need the later run to have read every sitemap file.
  const membershipRule = /^(not-in-sitemap|orphan|sitemap-url-|sitemap-bad-url$|sitemap-foreign-url$)/;
  // Findings about one sitemap entry are settled once a complete later sitemap no longer lists it.
  const entryRule = /^(sitemap-url-|sitemap-bad-url$|sitemap-foreign-url$)/;
  const settled = (f) => {
    if (membershipRule.test(f.rule) && !b.sitemapComplete) return false;
    if (entryRule.test(f.rule) && !b.sitemapList.has(f.url)) return true;
    return (f.urls ?? [f.url]).every((u) => (statusRule.test(f.rule) ? b.covered : b.coveredHtml).has(u));
  };
  const unchecked = b.covered ? gone.filter((f) => !settled(f)) : [];
  if (unchecked.length) {
    process.stderr.write(`${unchecked.length} finding(s) disappeared without the later run rechecking their URL (no longer linked or listed, robots-blocked, past the page budget, or no longer HTML). Not counted as fixed; check those URLs, and rerun the later check with --include <file listing them> where they still exist:\n`);
    for (const f of unchecked) {
      const missing = (f.urls ?? [f.url]).filter((u) => !(statusRule.test(f.rule) ? b.covered : b.coveredHtml).has(u));
      const why = missing.length ? missing.join(', ') : `${f.url} (the later run did not read every sitemap file)`;
      process.stderr.write(`  ${f.rule}  ${why}\n`);
    }
    return 2;
  }
  // A duplicate group that keeps its id but gains pages is a regression for those pages.
  const grown = b.findings.filter((f) => f.urls && before.get(f.id)?.urls).map((f) => ({ f, extra: f.urls.filter((u) => !before.get(f.id).urls.includes(u)) })).filter((g) => g.extra.length);
  const fixed = gone;
  const added = b.findings.filter((f) => !before.has(f.id));
  const changed = b.findings.filter((f) => before.has(f.id) && before.get(f.id).message !== f.message);
  const unchanged = b.findings.length - added.length;
  const out = process.stdout;
  out.write(`${a.kind} diff (fail and warn only): ${fixed.length} fixed, ${added.length} new, ${changed.length} changed wording, ${unchanged} still present\n`);
  for (const f of fixed) out.write(`  FIXED  ${f.severity}  ${f.rule}  ${f.url}  ${f.message}\n`);
  for (const f of added) out.write(`  NEW    ${f.severity}  ${f.rule}  ${f.url}  ${f.message}\n`);
  for (const f of changed) out.write(`  CHANGED  ${f.rule}  "${before.get(f.id).message}" -> "${f.message}"\n`);
  const drops = [];
  for (const key of new Set([...Object.keys(a.scores), ...Object.keys(b.scores)])) {
    const x = a.scores[key] ?? null;
    const y = b.scores[key] ?? null;
    if (x === y) continue;
    out.write(`  SCORE  ${key}: ${x ?? 'not verified'} -> ${y ?? 'not verified'}\n`);
    if (x !== null && (y === null || y < x)) drops.push(key);
  }
  for (const { f, extra } of grown) out.write(`  GREW   ${f.severity}  ${f.rule}  now also ${extra.join(', ')}\n`);
  return added.length || drops.length || grown.length ? 1 : 0;
}

// ---------- main ----------

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) { process.stdout.write(usage()); return argv.length ? 0 : 2; }
  if (argv[0] === 'diff') {
    if (argv.length !== 3) { process.stderr.write(usage()); return 2; }
    return diff(argv[1], argv[2]);
  }
  let opts;
  try { opts = parseArgs(argv); } catch (err) { process.stderr.write(`error: ${err.message}\n${usage()}`); return 2; }
  const report = await check(opts);
  const json = JSON.stringify(report, null, 2) + '\n';
  if (opts.out) {
    mkdirSync(dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, json);
    printSummary(report, process.stdout);
  } else {
    process.stdout.write(json);
    printSummary(report, process.stderr);
  }
  if (!report.complete) return 2;
  return report.summary.fail ? 1 : 0;
}

// Set exitCode and let Node exit on its own: process.exit() right after fetch()
// trips a libuv assertion on Node 24 for Windows.
main().then((code) => { process.exitCode = code; }, (err) => { process.stderr.write(`seo-check failed: ${err?.stack ?? err}\n`); process.exitCode = 2; });
