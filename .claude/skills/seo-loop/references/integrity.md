# Integrity: edits a round may not make

Both checks reward cheap-to-fake signals: dates, stats, quotes, author names, question headings, schema. Faked one passes gate + harms site: Google's [spam policies](https://developers.google.com/search/docs/essentials/spam-policies) cover most; an engine quoting an invented number quotes the owner saying it. Read before any content/markup edit; include in every reviewer brief.

## Never

- **Invent facts.** No stat, quote, source, price, date, award, client, author, credential, affiliation not already in repo or confirmed by owner. Gap → mark `owner input needed`, don't ship.
- **Bump dates.** `dateModified`, visible "updated" dates, sitemap `lastmod` change only w/ real content change on that page.
- **Show bots something else.** No user-agent/bot-IP branches changing content, links, markup ([cloaking](https://developers.google.com/search/docs/essentials/spam-policies)). Same for AI-only variants: `llms.txt`, Markdown copy, data files must not say what page doesn't.
- **Hide text/links**, or stuff keywords into titles, headings, alt text, copy.
- **Mark up invisible content.** Structured data = content visitor sees on that page ([structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)). No `AggregateRating`/`Review` of own business or products written by the business ([self-serving reviews](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)).
- **Generate pages at scale** for queries: per-city, per-keyword, templated pages w/ swapped nouns ([doorway + scaled content abuse](https://developers.google.com/search/docs/essentials/spam-policies)). New pages need owner go + reason a visitor wants each.
- **Pad for structure.** No FAQ blocks, question headings, "What is X?" openers added only to move `answerReadiness`. Add only when it answers a real visitor question; owner decides.
- **Buy, swap, plant links**; no sitewide footer links to other properties.
- **Redirect sneakily**: redirect sends everyone same place.
- **Change policy alone**: training-crawler rules, CDN/firewall bot settings, section-wide noindex, URL structure, redirect maps = owner's call.

## Allowed w/o asking

Fixes making existing truth readable: correct status codes + redirects, 1 canonical per page, sitemap + robots.txt consistency, hreflang pairs, valid JSON-LD for content already on page, unique titles + descriptions written from page's own content, server-rendered main content, real dates from content history exposed in markup.

New/rewritten copy (descriptions, intros, answer passages, headings) → `writing` skill, only facts already on site, owner approves before ship.

## Reviewer brief: integrity lens

For every changed visible string, attribute, JSON-LD field in round's diff:

1. Trace each factual claim to repo source or recorded owner approval. Untraceable → finding.
2. Compare structured data vs rendered page. Markup w/o visible content → finding.
3. Fetch 1 changed page w/ normal browser UA, `GPTBot` UA, `Googlebot` UA; content must match.
4. Every date change ↔ real content change in same diff.
5. Flag any "Never" pattern, even when checks improved.

Each finding: confirmed / refuted / unresolved + file + line.
