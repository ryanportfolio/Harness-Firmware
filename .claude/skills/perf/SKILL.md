---
name: perf
description: >-
  Measure, diagnose and A/B web performance with a real browser engine (headless
  Chrome over the DevTools Protocol) instead of guessing. Use when the user says
  "why is this site slow", "improve the PageSpeed / Lighthouse score", "measure
  performance", "check Core Web Vitals / LCP / FCP / CLS / TBT", "profile the
  homepage", "did that optimization actually help", "/perf", or asks to optimize
  load time on any URL. Also use BEFORE shipping any change that touches
  bundling, chunk splitting, preload/prefetch hints, lazy loading, fonts or
  images - this skill exists because those changes routinely measure worse than
  doing nothing.
---

# perf

Web performance work fails in a specific way: the fix is plausible, the
reasoning is sound, and the change makes the site slower. The only defence is
measurement, and measurement has its own traps that quietly produce confident
wrong answers.

This skill is the measuring rig plus the traps. It is deliberately not a list of
optimizations.

Zero npm deps. Node 21+ (global `WebSocket`), verified on Node 24. Drives
`chrome.exe` / `google-chrome` directly. Set `CHROME_BIN` if it is somewhere odd.

## The three rules

**1. Never trust curl about the wire protocol.** `curl -w '%{http_version}'`
reports what that curl build supports, not what the server offers. The Schannel
curl that ships with Git Bash on Windows has no HTTP/2 compiled in at all, so it
answers `1.1` for an h2/h3 origin, every time, with no warning. `probe.mjs`
reads the protocol per request out of the browser. Use it.

This matters because HTTP/1.1 caps a browser at ~6 connections per origin and
h2/h3 do not. Any change to *how many* things are requested at once behaves
differently on the two transports. A local HTTP/1.1 test server will happily
tell you a preload change is a win when on the real h2 origin it is a loss.

**2. n=10, interleaved, report the spread.** LCP is often bimodal: a resource
either makes an extra round trip or it doesn't. A mean describes neither mode. A
median at n=5 lands in whichever mode got lucky. `ab.mjs` alternates arms and
prints p25/median/p75, and says "noise" when the interquartile ranges overlap.
If they overlap, there is no result yet.

**3. Separate deterministic facts from samples.** Bytes on the wire, request
count, chunk graph, wave count: identical every run, state them plainly. Timings:
distributions, always hedged. Reporting a 200ms LCP delta with the same
confidence as a 200KB byte delta is how a bad change gets shipped.

## Diagnose a URL

Works on any site, including ones you do not control.

```bash
node ~/.claude/skills/perf/probe.mjs --url https://example.com/ --profile mobile
```

Prints the negotiated protocol, Core Web Vitals with the LCP element **named**,
request waves, bytes by type and origin, unused JS, long tasks, failed requests.

Flags: `--profile mobile|desktop|none` (mobile and desktop match Lighthouse's own
emulation presets), `--runs N` for a distribution, `--waterfall` for every
request with its initiator, `--json out.json` to keep the data.

What to read first:

- **The LCP element.** Everything else is secondary to knowing what is actually
  being graded. It is frequently not what anyone assumed: a decorative
  full-viewport overlay, a background image, a heading that mounts late.
- **The waves.** Each `+Nms` boundary is a round trip: the browser could not
  request that wave until it had parsed the previous one. Three waves before the
  LCP element means two stalls that no amount of shrinking bytes will remove.
- **Unused JS.** A chunk that is 70% unused on this route is either mis-split or
  eagerly loaded for no reason.

## A/B a change you are about to ship

For a repo you control. Build both states, serve them side by side, compare.

```bash
# 1. what does production actually negotiate? (never assume, never curl)
node ~/.claude/skills/perf/probe.mjs --url https://example.com/ --runs 1 | grep Protocol

# 2. build baseline, stash it, build the candidate
git stash && npm run build && cp -r dist/public /tmp/base && git stash pop && npm run build

# 3. serve both the SAME way production serves (add --http2 if step 1 said h2/h3)
node ~/.claude/skills/perf/serve.mjs --dir /tmp/base    --port 5301 --http2 &
node ~/.claude/skills/perf/serve.mjs --dir dist/public  --port 5302 --http2 &

# 4. compare
node ~/.claude/skills/perf/ab.mjs --a https://127.0.0.1:5301/ --b https://127.0.0.1:5302/ \
  --runs 10 --labels before,after
```

`serve.mjs` sends brotli so throttled runs see production-shaped wire bytes, and
`no-store` so a cached asset can't contaminate one arm.

**Known limit, and it is a real one:** node's `http2` implements no stream
prioritization; most real CDNs do. So any conclusion that depends on request
*priority* (`fetchpriority`, preload ordering) is pessimistic on this rig and has
to be confirmed against the deployed site. If the local `fetchpriority` arm looks
identical to the default-priority arm, that is the rig ignoring priority, not
evidence that priority does nothing.

## Verify after deploying

The deployed build is the only one that counts. After a release, re-run the
probe against production and compare to the pre-release capture.

```bash
node ~/.claude/skills/perf/probe.mjs --url https://example.com/ --runs 7 --json after.json
```

Byte and request-count deltas confirm the intended change shipped. Timing deltas
confirm it mattered. Both, or the claim is unverified.

## Failure modes worth naming

- **The fix moves the problem instead of removing it.** Bundler `manualChunks`
  is the classic: naming a module into a different chunk can relocate an edge in
  the import graph rather than cut it, so the payload arrives in a different
  wave and the total is unchanged. Verify against the built output, not the
  config diff.
- **A dependency reachable from 2+ lazy chunks gets hoisted into the chunk they
  share** - which is usually the chunk every route loads. No chunking rule fixes
  that. The fix is at the source: reach the heavy module through `import()` only.
- **The optimization helps the metric and hurts the experience.** Preloading
  everything improves LCP and delays first paint. Report both; let the human
  decide.
- **Different LCP elements between arms.** Then the arms aren't measuring the
  same thing. `ab.mjs` warns; do not ignore it.
- **A build artifact left over from an earlier experiment.** Rebuild before
  measuring, and check the asset hashes match what you think you built.
- **Leaked browser processes.** An interrupted run leaves Chrome's whole process
  tree alive, and enough of them starve the next measurement of the CPU it is
  trying to characterise. This produces a wrong number, not an obviously broken
  one: it cost a 4.2s LCP page an 11.7s reading while this skill was being
  written. `probe.mjs` kills its own tree and warns when the machine is already
  dirty; if it warns, clear them (`taskkill /IM chrome.exe /F`, or
  `pkill -f chrome`) and start over rather than reasoning about the result.

## Reporting

State what was measured, on what transport, at what n. Give medians with spreads
for timings and flat numbers for bytes. If a result is inside the noise, say so
rather than picking the flattering median. If the honest answer is "this change
does not pay for itself", that is a successful use of this skill, not a failure:
it is worth strictly more than shipping it and finding out from users.
