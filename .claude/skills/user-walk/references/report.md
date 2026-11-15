# Friction report

Run `node <walk.mjs> <run> summary` → `summary.json` (one row per goal folder). Compare each goal with map's known path.

## What counts

- **Wasted steps** = walker actions − known steps (floor 0), broken into backtracks (`back`, `home`, return to a screen seen earlier), dead ends (screen entered then left by going back with nothing done there), extra screens (visited, not on known path's screens). Count these, not raw clicks.
- Shorter path than known that skipped a needed confirmation, undo or review step → finding, not a win. Destructive or costly step with no confirmation or undo (from map) → finding.
- Hesitations and misread labels from walker notes + reply, even with 0 wasted steps.
- `found` checked against map's end state. Wrong end state → outcome `wrong end`.

## Ranking (cost to user per attempt)

1. Not reached: `gave-up`, budget spent, `wrong end`, or Known steps `none` (site never answers the goal).
2. Reached, most wasted steps first; tie → dead ends and backtracks before scrolls.
3. Reached with 0 wasted, hesitations or misleading labels.
4. Smooth: 0 wasted, no hesitation (listed, not ranked).

How often users need each feature is unknown to the run; owner may reorder by importance.

## Evidence labels

Every finding carries one or more, with location:

- `Log`: `steps.jsonl` row in goal folder (`goal-4/steps.jsonl:7`).
- `Observed`: walker note or reply, or screenshot path.
- `Measured`: known-path replay.
- `From code`: `file:line`.

Single walk → mark `1 walk`. Confirmed = second fresh walker hits the same friction, or log + code explain it. Offer repeat walks for top single-walk findings; never claim a pattern from one walk.

## Fix and hand-off

Each finding: concrete change (rename "Reports" to the word walker searched for, link screen A to B, move control above the fold) + next step: fix in code, `climb-loop`, `ui-quality`, `conversion-ux` or `product-walkthrough` (SKILL.md table). Never judge look, accessibility or conversion here; name the skill.

## Template (report is for the owner: normal prose)

```markdown
# User walk: <site> (<date>)

Commit <sha> · <URL> · <test account / signed out> · <n> walkers (fresh agents, <model>), <k> at a time · <total time> · skip list: default + <extra>

## Ranked friction
| # | Feature | Goal given | Outcome | Known | Walker | Wasted (back / dead end / extra screens) | What went wrong | Evidence | Fix | Next |
|---|---|---|---|---|---|---|---|---|---|---|

## Smooth
<features reached with no wasted steps and no hesitation>

## Not walked and limits
<skip-list paths, role-gated features, missing data, driver or walker failures>
Walkers read the whole page's text at once, as a screen reader would; a sighted visitor scans and scrolls. Friction below the fold and from visual prominence is under-counted. Viewport <w × h>; no touch emulation.

## Feature names changed
<rows added, renamed or removed in .claude/reference/features.md>

## Product bugs seen
<list or none>
```
