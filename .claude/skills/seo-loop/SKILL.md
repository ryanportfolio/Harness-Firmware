---
name: seo-loop
description: "SEO/AEO/GEO fix rounds, measured. Use: /seo-loop, 'improve SEO'."
---

# SEO loop

Goal: site easier to index, attribute + quote, via measured rounds on own source. 2 deterministic checks gate every round. Rankings + real AI citations lag weeks, not measured here → claim only check results.

- `scripts/seo-check.mjs` (skill folder: `.claude/skills/seo-loop/` Claude Code, `.agents/skills/seo-loop/` Codex): crawl, status + redirects, robots.txt, sitemap, canonical, noindex, hreflang, titles, descriptions, JSON-LD syntax.
- willaicite (`geo-audit`): AI crawler access per bot incl. firewall blocks, raw-HTML renderability, answer-readiness, topical focus, evidence, structured data, freshness, entity, SEO foundation.

[checks](references/checks.md): finding meanings, sources, fix locations. [integrity](references/integrity.md): before any content/markup edit + in every reviewer brief. Speed/Core Web Vitals → `perf-loop`; a11y → `ui-quality`.

## Scope

- Site + source repo; edits via source → build → PR. Never edit live site. Audit request or no repo → triage only.
- Measure target: production build served locally (host's build + preview cmd), else deploy preview. Dev server = diagnostic only. Live prod = read-only baseline.
- Build identity: record commit SHA, build + serve cmds, URL; confirm served page = that build (marker in HTML, or a just-changed string).
- Key pages ≤5: start page + 1 per template (article, product, docs, landing) + owner's picks. No source → pick distinct layouts from nav/sitemap. seo-check crawls site; willaicite per key page.
- No permission to change hosting, CDN, DNS, Search Console, firewall, publish, deploy.

## Tools

```
node .claude/skills/seo-loop/scripts/seo-check.mjs <url> --out <dir>/seo.json [--max-pages 200] [--urls list.txt]
npx -y github:ryanportfolio/willaicite#v1.4.0 <page-url> --json --out <dir>/geo-<slug>.json
node .claude/skills/seo-loop/scripts/seo-check.mjs diff <before.json> <after.json>
```

- seo-check: Node 20+, no deps. Exit 0 no fail, 1 fail findings, 2 incomplete. 200 ms between fetches, none on localhost.
- willaicite: pinned tag; never `npx geo-audit` (unrelated npm pkg). Audits localhost as is. Always exits 0, prints a score even for 404 or dead page → validity = diff's job.
- diff: same tool + same start URL. Exit 0 nothing new, 1 new fail/warn or lower willaicite dimension score, 2 not comparable (other tool/URL, page not reached w/ HTTP 200). Info findings ignored.
- Paths: `.tmp/seo-loop/<yyyymmdd-hhmm>/round-<n>/`, round-0 = baseline. `<slug>` = URL path, `/` → `-`, start page = `home`.

## Baseline + triage

Request names no finding ("improve SEO", skill alone) → triage; else baseline, then rounds.

1. Run both tools on target → round-0. Read output, not only exit codes.
2. Run again → round-0b; diff each pair. Any fixed/new → find drift cause (date-relative freshness, A/B, random content), record before rounds.
3. Triage table, no edits. Columns: finding (seo-check rule, or willaicite dimension + evidence line), pages, severity, why (checks.md row; willaicite: its recommendation `why`), fix location, effort, owner input? Same issue in both tools → 1 row, higher severity. Order: access + indexing fails (robots, status, noindex, canonical, crawler access, renderability) → other fails → warns; tie → more pages first. Info → count line under table.
4. Stop; user picks focus. Unattended → table = report, outcome "triage only".

willaicite overall score = context, never target: weights = judgment from studies; its cited replication found formatting-only edits ~useless.

## Rounds

1 implementer, 1 fix class/round (1 rule or 1 dimension finding), usually 1 template/config change. Record first: target finding ids, expected effect, pages to watch.

1. Edit source. Content/markup → integrity first.
2. Rebuild + serve as baseline; confirm build identity.
3. Rerun seo-check on site; willaicite on key pages + every page change touches.
4. Diff vs last kept state. Keep only if: target findings gone, diff exit 0 everywhere else, project build + tests pass.
5. Independent review (below). Confirmed issue → fix + re-measure, or revert.
6. Fail → revert this round only. Next round ← full record, not best result.

Stop: ≤5 rounds default; 2 consecutive w/o kept fix; next fix needs owner.

## Owner decisions

Never alone; list pending w/ exact proposed change:

- Training-crawler rules (`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`, `meta-externalagent`, others willaicite lists as training): licensing choice. Retrieval crawlers gate citations. Report groups separately, as willaicite labels them.
- CDN/firewall bot rules: outside repo → report setting.
- New facts, figures, quotes, authors, credentials, prices, dates; key-page copy (draft via `writing`).
- Section-wide noindex/robots, URL changes + redirect maps, new pages.

## Independent review

Per round before keep: fresh agent per lens, standalone brief: request, diff, before/after JSON paths, build + serve cmds, integrity.md. Claude Code: `Agent` tool, fresh context. Implementer claims = unverified.

- Integrity: integrity.md brief, every changed string, attribute, JSON-LD field.
- Regression: changed pages + same-template pages render + work; canonical, hreflang, sitemap agree; nothing hidden. Layout/copy change → headed Chrome via `launchPlacedChrome()` (`scripts/lib/launch-chrome.mjs`) if repo has it, else `--window-position=-2400,-2400`; always `--mute-audio`; never headless; screenshots where user's instructions say, else round folder.

Reviewer → confirmed / refuted / unresolved + evidence paths. Unavailable → report gap; self-review ≠ independent.

## Report

Outcome: **Target met** (chosen findings gone, reviews pass) / **Improved, target unmet** / **Inconclusive** (runs not comparable, review missing) / **No kept fix** / **Triage only**. Before/after table (finding counts per rule, willaicite dimension scores per page), kept + discarded rounds, pending owner decisions, evidence paths, seo-check `limits` + willaicite `limitations`.

Effects lag Google recrawl → owner recheck: Search Console page indexing + performance, Bing Webmaster Tools, 4-6 weeks post-deploy; offer reminder. Never claim ranking/citation gains.

Cleanup: stop servers, close browsers, delete scratch except evidence; report leftovers w/ path + size. npx cache = shared, leave.
