---
name: seo-loop
description: "SEO/AEO/GEO fix rounds, measured. Use: $seo-loop [local|live], 'improve SEO'."
---

# SEO loop

Goal: site easier to index, attribute + quote, via measured rounds on own source. 2 deterministic checks gate every round. Rankings + real AI citations lag weeks, not measured here → claim only check results.

- `scripts/seo-check.mjs` (skill folder: `.claude/skills/seo-loop/` Claude Code, `.agents/skills/seo-loop/` Codex): crawl, status + redirects, robots.txt, sitemap, canonical, noindex, hreflang, titles, descriptions, JSON-LD syntax.
- willaicite (`geo-audit`): AI crawler access per bot incl. firewall blocks, raw-HTML renderability, answer-readiness, topical focus, evidence, structured data, freshness, entity, SEO foundation.

[checks](references/checks.md): finding meanings, sources, fix locations. [integrity](references/integrity.md): before any content/markup edit + in every reviewer brief. Speed/Core Web Vitals → `perf-loop`; a11y → `ui-quality`.

## Mode

- `local` (default): rounds measured on production build served locally (Scope).
- `live`: each round deployed, then measured on prod. Owner names it (`$seo-loop live`), or skill proposes it + asks when no local target (Scope) instead of stopping at triage only. Never chosen alone; unattended → `local`.
- `live` fits only if all hold: small site, deploy + rollback in minutes; owner accepts each change reaches prod before it's measured; every fix = integrity.md "Allowed w/o asking" class or copy owner approved. Else `local`, or triage only.
- Before first `live` deploy, record: deploy cmd (or merge → auto-deploy), last good SHA + its prod build id, build marker computed from the deployed tree (asset hash, just-changed string), rollback cmd (e.g. same deploy from a clean checkout at last good SHA). Rollback unknown → no deploy.
- Deploy from a clean checkout at the merge SHA. CLI deploy may upload a different folder than cwd (link keyed by folder path, e.g. `railway up` from a git worktree uploaded the main checkout) → marker check on prod catches it.
- Merge + deploy: owner's word per round, or a standing go the owner states for live rounds on that site in that session; never inferred. Copy approved before build, then checked word for word vs approved draft on every page it lands on. Policy items (Owner decisions) never covered by a standing go.
- Rankings + real citations lag in both modes.

## Scope

- Site + source repo; edits via source → build → PR. Never edit live site. Audit request or no repo → triage only.
- Measure target: production build served locally (host's build + preview cmd), nothing else; `live`: prod after deploy (Mode). Dev server = diagnostic only. Live prod = read-only baseline (`local`). Never a deploy preview, either mode: hosts deploy every service on one (workers that migrate, run jobs or open issues, all w/ inherited prod tokens; env naming the prod DB → this branch's code + migrations run against prod; own DB → starts empty), Vercel previews send `X-Robots-Tag: noindex` and often sit behind Deployment Protection (seo-check scores noindex or a login page), per-push URLs change → diff exit 2, and each round would need a push (deploy: no permission, below). Can't serve the production build locally → triage only (outcome in the no-real-data bullet).
- Before the first local build (every site): read the build + start cmds and data config. Run them only w/ prod credentials kept out of env (env files, host env; never fill a missing DB/API URL from the host's variables) and only the site process (no workers or jobs; migrations only against a local DB per Owner decisions). Can't separate those → triage-only outcome in the next bullet.
- No real data locally: build or site process fails for want of a DB/API URL, or any key page empty (no list items, 404, error page), because its data lives in a private DB, CMS or API the owner hasn't supplied as seed data, DB dump or staging DB → no local target. Fixture data the agent writes doesn't count (checks would score invented text). No deploy preview (Measure target). No stand-in renderer fed by prod pages/API: it isn't the production build, and every crawl multiplies prod requests. No real data locally, can't separate (previous bullet), or production build won't serve locally for another reason → triage only, measured on live prod (read-only), no rounds; report says why + lists what's missing (real-data target, or what the local build needs) as pending owner decision. Owner opts into `live` (Mode) → rounds on prod instead; its fixture rows only pre-check rendered HTML (Rounds), never measured.
- Build identity: record commit SHA, build + serve cmds, URL; confirm served page = that build (marker in HTML, or a just-changed string).
- Key pages ≤5: start page + 1 per template (article, product, docs, landing) + owner's picks. No source → pick distinct layouts from nav/sitemap. seo-check crawls site; willaicite per key page.
- No permission to change hosting, CDN, DNS, Search Console, firewall, publish, deploy. `live`: merge + deploy per round on owner's go only (Mode); rest stays off-limits.

## Tools

```
node .agents/skills/seo-loop/scripts/seo-check.mjs <url> --out <dir>/seo.json [--max-pages 200] [--urls list.txt | --include list.txt] [--public-origin https://prod.example]
npx -y github:ryanportfolio/willaicite#v1.4.0 <page-url> --json --out <dir>/geo-<slug>.json
node .agents/skills/seo-loop/scripts/seo-check.mjs diff <before.json> <after.json>
```

- seo-check: Node 20+, no deps. Exit 0 no fail, 1 fail findings, 2 incomplete. 200 ms between fetches, none on localhost; `--delay <ms>` overrides, never lower on prod. Same `--max-pages` both sides of a diff. Follows links on every page, canonical or not (sort/filter/page query links fill the budget fast); truncated crawl skips sitemap-only pages + orphan results cover fetched pages only → partial.
- willaicite: pinned tag; never `npx geo-audit` (unrelated npm pkg). Audits localhost as is, no origin flag: correct canonical to prod reads "points away" locally (seoFoundation drops, e.g. 30 → 0) → known artifact, never "fix" it; `live` → willaicite on prod only. Always exits 0, prints a score even for 404 or dead page → validity = diff's job.
- diff: same tool, script version + requested URL. Exit 0 nothing new; 1 regression: new fail/warn, warn → fail, duplicate group grew, indexable page `LOST` (now noindex, blocked, broken, canonical/redirect to a non-indexable page, or no longer found by the crawl), lower willaicite dimension score; 2 not comparable: incomplete run, crawls landed on different origins (new baseline needed), later run hit page budget earlier didn't, earlier indexable page not rechecked (`--urls` run or truncated crawl), earlier indexable page now redirecting to or naming as canonical a same-origin page the later run didn't fetch, finding gone w/o its URL (or a cross-page target) rechecked, `--urls` run for sitemap-membership findings, willaicite failure gone while its sample shrank or its dimension has unverified checks. Info findings ignored.
- Exit 2 for a page that still exists → crawl: rerun later check w/ `--include <its URL>`; `--urls` run: add it to the list (the two flags don't combine); page budget hit: rerun both w/ higher `--max-pages`. A regression found alongside still exits 1. Removed broken link or sitemap file → settles itself once a full crawl w/ complete sitemap no longer references it. Consolidated page (301 or canonical) → not `LOST` while its target is indexable (a target the later run didn't fetch → exit 2, recheck the target; a target on another origin counts as lost); if the old URL is no longer linked, `--include` it so the redirect is seen.
- seo-check crawls from where the start URL lands (http → https, apex → www); report `url` = that, `requestedUrl` = given. Never fetches other origins (robots.txt redirects excepted, as Google follows them) or robots-blocked redirect targets. Reads Google's way: robots.txt any content type, typo keys, product-token user agents; pages up to 15 MB; sitemaps as XML, text, RSS, Atom, gzip up to 50 MB; `<head>` ends at its first non-head element; robots meta anywhere in the page.
- Local preview of a site w/ a production origin → always `--public-origin <prod origin>`. Without it, run = incomplete (`needs-public-origin`) when robots.txt, sitemap, canonical name another origin, start page links only to one other origin (≥3 paths), or start URL redirects off the machine. Local = localhost, `*.localhost`, loopback, private LAN, link-local. Absolute production links elsewhere are not detected. Site w/ no production origin → pass its local origin.
- Paths: `.tmp/seo-loop/<yyyymmdd-hhmm>/round-<n>/`, round-0 = baseline. `<slug>` = URL path, `/` → `-`, start page = `home`.

## Baseline + triage

Request names no finding ("improve SEO", skill alone) → triage; else baseline, then rounds. Scope says triage only (audit request, no repo, no local target w/o `live`) → triage, whatever the request names. `live`: target = prod, baseline + 0b = fresh prod crawls before first live round; any origin change (host URL → own domain) → new baseline (diff exit 2 across origins).

1. Run both tools on target → round-0. Read output, not only exit codes.
2. Run again → round-0b; diff each pair. Any fixed/new → find drift cause (date-relative freshness, A/B, random content), record before rounds.
3. Triage table, no edits. Columns: finding (seo-check rule, or willaicite dimension + evidence line), pages, severity, why (checks.md row; willaicite: its recommendation `why`), fix location, effort, owner input? Same issue in both tools → 1 row, higher severity. Order: access + indexing fails (robots, status, noindex, canonical, crawler access, renderability) → other fails → warns; tie → more pages first. Info → count line under table.
4. Stop; user picks focus. Unattended → table = report, outcome "triage only". No local target → the named or picked focus waits for the owner decision that gives one (real-data target or local build fix, Owner decisions; list it as pending), or propose `live` when it fits (Mode). Once settled: steps 1-2 on the local build, then rounds; `live` → prod triage run = baseline, rounds next.

willaicite overall score = context, never target: weights = judgment from studies; its cited replication found formatting-only edits ~useless.

## Rounds

1 implementer, 1 fix class/round (1 rule or 1 dimension finding), usually 1 template/config change. Record first: target finding ids, expected effect, pages to watch, expected diff exit-1 items (`LOST` pages + new findings an owner-approved change causes, e.g. noindex on a section). Diff exit 1 passes only if a script matches every exit-1 line to that list; eyeballing ≠ check. Copy/markup change → grep repo checks + scratch tests for old strings, update them.

`local` round:

1. Edit source. Content/markup → integrity first.
2. Rebuild + serve as baseline; confirm build identity.
3. Rerun seo-check on site; willaicite on key pages + every page change touches.
4. Diff vs last kept state. Keep only if: target findings gone, diff exit 0 (or exit 1 w/ every item expected) everywhere else, project build + tests pass.
5. Independent review (below). Confirmed issue → fix + re-measure, or revert.
6. Fail → revert this round only. Next round ← full record, not best result.

`live` round:

1. Edit source. Content/markup → integrity first.
2. Pre-check changed HTML locally: script passes a few hand-made fixture rows straight to the page renderer, prod credentials out of env. No prod traffic; no stand-in fed by prod pages/API (Scope). Output = eyeball + review input only, never scored, diffed or shipped. Proves templates only (head tags, escaping, copy); new SQL or route → "unverified until a prod request succeeds". Prefer existing queries.
3. Project build + tests pass. Independent review (below), before merge. Confirmed issue → fix, or drop round.
4. PR → repo's PR review gate → merge + deploy (Mode) only on owner's go. Ask w/ rollback cmd named: go covers running it whenever step 7 says roll back.
5. Confirm live build identity: marker from deployed tree on prod. Old build or wrong marker → stop, no measuring. Hit every new or changed route once (200, expected content type + content) before crawling.
6. seo-check on prod (default 200 ms between fetches; say so in report), willaicite on key pages + every page change touches. Diff vs previous prod crawl, never a local run (different origins → exit 2).
7. Keep only if: target findings gone, diff exit 0 (or exit 1 w/ every item expected) elsewhere. Exit 2 → fix comparability (Tools), re-measure, no next round; still exit 2 → roll back. Any other miss (regression, target finding still there, route check failed) → roll back, unless owner explicitly OKs keeping it live. Roll back = rollback cmd (redeploy last good SHA, or revert PR through same gate), confirm old marker, recrawl → diff exit 0 vs pre-deploy crawl. Redeploy rollback → revert PR follows so source = prod. Next round ← full record.

Stop: ≤5 rounds default; 2 consecutive w/o kept fix; next fix needs owner.

## Owner decisions

Never alone; list pending w/ exact proposed change:

- Training-crawler rules (`GPTBot`, `ClaudeBot`, `CCBot`, `Applebot-Extended`, `meta-externalagent`, others willaicite lists as training): licensing choice. `Google-Extended` = Gemini training + Gemini/Vertex grounding, not Search → name both uses. Retrieval crawlers gate citations. Report groups separately, as willaicite labels them.
- CDN/firewall bot rules: outside repo → report setting.
- New facts, figures, quotes, authors, credentials, prices, dates; key-page copy (draft via `writing`).
- Section-wide noindex/robots, URL changes + redirect maps, new pages.
- Real-data measure target for a site whose data can't be served locally (Scope), supplied by the owner: seed data or DB dump loaded into a local DB (installing a local DB server is part of this decision), or a staging DB the owner confirms is a separate database, not prod reached another way (prod's public proxy, replica or pooler URL is prod; host names can't tell them apart, e.g. Railway's private DB host is the same in every environment; never print prod's URL to compare). Run the site process, plus migrations or schema setup only against the local DB w/ prod credentials absent; never workers or jobs, never anything holding prod tokens. Dump w/ private rows (users, emails, sessions, tokens, drafts) → outside repo + round folders; the dump file and the local DB or container loaded from it are deleted at Cleanup and named in the report; else seed or anonymize. Data ≠ prod's published state, or static data making date-relative text drift → say so in report; record drift in Baseline step 2.
- `live` mode (Mode) + each round's merge + deploy.
- Local build fix for a production build that won't serve locally for a reason other than data (host-only runtime or adapter, missing toolchain, build-time secret): owner supplies what's missing or approves the source change that makes it serve. Same run limits as the first local build (Scope). Never a deploy preview instead.

## Independent review

Per round before keep: fresh agent per lens, standalone brief: request, diff, before/after JSON paths, build + serve cmds, integrity.md. `live`: before merge, pre-check HTML + render script replace after JSON + serve cmds. Codex: exposed multi-agent tools, fresh context; `multi_agent = true` alone ≠ proof they exist. Implementer claims = unverified.

- Integrity: integrity.md brief, every changed string, attribute, JSON-LD field.
- Regression: changed pages + same-template pages render + work; canonical, hreflang, sitemap agree; nothing hidden. Layout/copy change → headed Chrome via `launchPlacedChrome()` (`scripts/lib/launch-chrome.mjs`) if repo has it, else `--window-position=-2400,-2400`; always `--mute-audio`; never headless; screenshots where user's instructions say, else round folder.

Reviewer → confirmed / refuted / unresolved + evidence paths. Unavailable → report gap; self-review ≠ independent.

## Report

Outcome: **Target met** (chosen findings gone, reviews pass) / **Improved, target unmet** / **Inconclusive** (runs not comparable, review missing) / **No kept fix** / **Triage only**. Mode first. Before/after table (finding counts per rule, willaicite dimension scores per page), kept + discarded rounds, pending owner decisions, evidence paths, seo-check `limits` + willaicite `limitations`. `live` adds per round: PR, merge SHA + prod marker, route checks, rollback run or owner-OK'd keep; states changes reached prod before measurement, prod crawls ran at 200 ms between fetches.

Effects lag Google recrawl → owner recheck: Search Console page indexing + performance, Bing Webmaster Tools, 4-6 weeks post-deploy; offer reminder. Never claim ranking/citation gains.

Cleanup: stop servers, close browsers, delete scratch except evidence; report leftovers w/ path + size. npx cache = shared, leave.
