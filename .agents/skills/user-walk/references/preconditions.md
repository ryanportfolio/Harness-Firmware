# Preconditions, known-path replay, estimate

All done by main session before any walker starts. `W` below = `node .claude/skills/user-walk/scripts/walk.mjs` (Codex: `.agents/skills/user-walk/scripts/walk.mjs`).

## 1. Target

URL walkers use: local dev server, preview deploy, or production. Prefer local or preview with seeded data. Production only with a test account, and never on real users' data. Note target in map header.

## 2. Account and data

- Signed-out features need nothing.
- Signed-in features need a test account or seeded data. Ask owner. Credentials through a file owner pastes into (`secret-file` skill where installed), never in chat.
- Make signed-in state once: `W <run>/login start --url <login page>`, log in with `fill`/`click`, `W <run>/login save-state <run>/auth.json`, `W <run>/login stop`. Pass `--storage-state <run>/auth.json` to every walker driver. Keep `auth.json` out of reports, screenshots shared outside the run, and commits. Delete it at cleanup.
- Login itself is not walked from saved state. Walking sign-in or sign-up as a goal → start signed out; sign-up decisions → `conversion-ux`.
- Features needing data that does not exist (an empty account has no history to export) → seed it first or list as not walked.

## 3. Skip list

Driver refuses clicks and Enter on controls whose name matches its default list: delete, remove, destroy, erase, wipe, discard, pay, purchase, buy, checkout, place order, upgrade, subscribe, unsubscribe, send, invite, publish, post, tweet, cancel plan/subscription/account, close account, deactivate.

The driver sees names only, not what a control does. So read each walked feature's write paths in code: any control that emails, messages, charges, deletes, or calls a third party with side effects goes on the list under its visible name (`--skip "archive|notify team|run export to S3"`). Ask owner for anything else walkers must not touch. `--skip` adds to the default list; it never replaces it.

## 4. Origins

Driver aborts top-level navigation to other origins and non-GET requests to them. Replay (step 5) writes `blocked.jsonl`. App needs a write to its own API on another host → confirm with owner → `--origin https://api.example.com` on every driver. Analytics and ad hosts stay blocked.

## 5. Known-path replay

For each goal, main session runs its known path through driver in `<run>/known-<n>/`:

```bash
node .claude/skills/user-walk/scripts/walk.mjs .tmp/user-walk/<run>/known-4 start --url <start> --goal "<goal>"
```

then `look` + one action per step, `end found`, `stop`. Two checks on the last screen, both from the screenshot and page text:

- scroll until the control or answer is on screen, counting each `scroll` (walkers scroll like users; trial: a 1-click path really took 1 click + 5 scrolls);
- read it: does it complete the goal? A page whose heading matches is not enough (trial: "What happens to your data?" never said whether submitted URLs are kept). No answer anywhere → Known steps `none`, a content finding; still walk it, to see where users look.

Result:

- measured known steps (from `summary`) → map's Known steps;
- path broken (control missing, gated, error) → fix map; if code says it should work, it is a product bug for report;
- shorter path found while replaying → update map;
- seconds per action → estimate below.

## 6. Estimate and budget

- Per-goal action budget for walker: `--max-actions` = max(15, 4 × known steps).
- Measured pace (willaicite.com trial, 2026-11-14, 6 goals of 1 to 6 actions): 38 to 64 s per walker agent, about 110k tokens each (page text per `look` dominates).
- Time per goal ≈ 30 s + 10 s × (known steps + 3). Total ≈ Σ per goal ÷ walkers at once (max 4) + replay time (seconds; driver start ≈ 2 s).
- State estimate before walking, time and tokens: `9 goals, 4 at a time, about 4 min, about 1M tokens`. Past 2× time → stop, report what finished, rethink.

## 7. Progress

One line per finished walker. `W <run> summary` anytime: live counts for every goal folder.
