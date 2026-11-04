---
name: climb-loop
description: "Hill-climb a target round after round: Opus, Sol and Astra rank our UI blind against named reference apps until all rank ours first, or a scripted eval climbs to perfect."
---

# Climb loop for Codex

Give the agent a hill it can measure → it climbs. Two hills:

- **Scripted hill** (prefer): program emits a number → push it up. Section 7.
- **Judged hill**: no program can measure it (UI taste) → council of three models ranks captures. Sections 1–6.

Neighbors: `$wow-loop` = written quality contract, binary checks, own critics. `$perf-loop` = speed/size targets. This skill = beat named rivals, judged by Opus + Sol + Astra, or an eval mined from history.

Invocation input: target (app, screens or eval) plus optional references and round cap. Discussing or editing this skill does not start it.

## Stop rules (read first)

- Round cap and usage budget agreed before round 1. Cap reached → stop, report, ask. Never raise the cap yourself.
- Before starting, state seat count × planned rounds; every judge call bills the user's subscriptions.
- Judges are read-only. Codex judges run with `-s read-only`. The Opus judge runs with `--tools "Read"` and `--permission-mode plan`, and its brief forbids edits.
- Never tell a judge the target, gate, round number, prior ranks, builder notes or which letter is ours.
- Never weaken a check, edit an eval case, or drop a reference to get a pass.
- Opus seat preflight fails → say so and report the council as Sol + Astra only, same-vendor as this session. Never call that result cross-vendor.
- Reference-product captures stay local in the screenshot folder. Never commit them to the repository.

## Why rank, not score

Absolute 1–10 scores drift. Observed in the source run: same screenshot, same model, three scores; in-thread judge called a change 6.5 → 9 while a fresh judge with rival screenshots called it 7 → 7.4; rival scores rose 8.3 → 9.1 with no change to their screenshots; judges who knew the target likely inflated. So: each judge ranks ours against frozen reference captures, per category, blind. References never change → any reference rank movement between rounds = judge noise, logged as drift.

## 1. Council

| Seat | Runs through | Model | Effort |
|---|---|---|---|
| Opus | `claude -p` child process, Claude subscription | `opus` alias | `high` |
| Sol | `codex exec` child process (plain, not `review`) | newest Sol, resolved per `$codex-review` | `high` |
| Astra | `codex exec` child process (plain) | Astra id from `$astra-review` | `medium` |

From Codex, Sol and Astra share this session's vendor; each child is still a fresh context. Opus is the only cross-vendor seat. Report says so. User names other models → honor, record.

Preflight, no inference:

- `codex --version`, `codex login status`, `codex exec --help` shows `-i/--image`, `-s/--sandbox`, `--output-schema`, `-o`.
- Opus seat: run the fail-closed preflight from `$claude-review` section 1 (subscription route proven, no API or provider variables). Stop the Opus seat if routing cannot be proven. Never accept or enable paid credits for the user.
- Do not probe models by spending usage.

Codex judge call. Brief on stdin, so multi-value `-i` cannot swallow it (verified codex-cli 0.166.0):

```bash
codex exec -m "$MODEL_ID" -c model_reasoning_effort=high -s read-only \
  --output-schema .agents/skills/climb-loop/references/rank.schema.json \
  -o "$RUN/sol.json" \
  -i "$CAP/A-sidebar-dark.png" -i "$CAP/B-sidebar-dark.png" -i "$CAP/C-sidebar-dark.png" \
  < "$RUN/brief.md" > "$RUN/sol.log" 2>&1
```

Opus judge call (brief lists absolute image paths; on native Windows keep `--tools "Read"`):

```bash
claude -p --model opus --effort high \
  --permission-mode plan --permission-prompts none --restricted \
  --tools "Read" --disable-slash-commands --strict-mcp-config \
  --no-session-persistence --no-chrome --output-format text \
  < "$RUN/brief.md" > "$RUN/opus.json" 2> "$RUN/opus.log"
```

`$RUN` = unique dir per seat per round under `.tmp/climb-loop/<slug>/`. Exit 0 + output parses against `references/rank.schema.json` = success. Anything else → report once, ask before a retry; never swap model or effort silently. A billing prompt or plan-limit message stops the Opus seat.

## 2. Contract (once, then frozen)

Write `.tmp/climb-loop/<slug>/contract.md`:

- **References**: 2+ products ours must beat, named by user. None named → ask.
- **Views**: states captured identically for ours and every reference: viewport, theme (light and dark), data fixture, zoom. Name each view.
- **Categories** (edit per product): hierarchy, typography, color and contrast, spacing and density, consistency (labels, radius, icons across surfaces), affordance (controls read as controls), iconography, states (focus, hover, empty, error).
- **Gate**: every admitted seat ranks ours alone in the top tier in every category, two consecutive fresh rounds on the same commit.
- **Scripted floor**, after every edit, no judge call: axe-core clean on each view, WCAG AA contrast on text tokens, zero console errors, views outside the edit pixel-stable. Gating floor failure → no judge round.
- User names a numeric bar ("9/10") → record it in `state.json` only, translate to the gate above. A lower bar may relax the gate (top two tiers, fewer categories) only after the user confirms which.

Capture rig: headed Chrome on the real GPU via `launchPlacedChrome()` (`scripts/lib/launch-chrome.mjs`), never headless, never minimized, audio muted. Each parallel agent launches its own instance; an MCP browser server is shared by the whole session, one driver at a time. Captures go to the screenshot folder the user's instructions name, else `.tmp/climb-loop/<slug>/captures/`. Reference captures taken once in round 0, reused unchanged. Browser launches and the local server need process and network approval; without a browser, say the judged hill cannot run rather than judging from code.

## 3. Judge brief

Template: [references/judge-brief.md](references/judge-brief.md). Per seat per round: reshuffle letter mapping; keep mapping in `state.json`, outside the brief; file names carry letter + view only. Recognizable rival chrome limits blinding → record it.

Output: [references/rank.schema.json](references/rank.schema.json). Ranking as tiers, best first; reason; up to 3 defects per letter (view, element, problem, measurable fix). Orchestrator maps letter → ours, keeps ours' defects, keeps rival defects only as rationale.

## 4. Loop

1. **Round 0 (baseline)**: capture all, all three seats judge untouched UI. Record start tiers.
2. **Staged admission** (cost): only Sol judges until Sol's gate passes; then add Opus; when Opus passes, add Astra. Cheapest/fastest seat first; user may reorder. Acceptance = all seats pass in the same round on the same commit; a pass on an older commit is stale.
3. **Build**: one writer, isolated worktree per `AGENTS.md`. Fix ours' defects ordered by seats citing them, then category where ours ranks lowest. Scripted floor after each edit.
4. **Next round**: new captures of ours, new shuffle, fresh judge processes. Never resume a judge session.
5. **Ratchet**: gate passes and change is mergeable → open PR per `AGENTS.md` (its review gate applies). Further climbing (stricter gate, more references, more views) goes on a stacked branch in a new worktree; the mergeable PR stays intact.
6. **User taste** ("too grayscale"): append a named, versioned contract amendment; builder gets it, judges never see it as a goal.
7. Save `state.json` (round, seats admitted, mapping, tiers, commit, spend) after every round.

Two rounds in a row with no tier gain in any category → stop, write one sentence on the assumption both rounds shared, test it before round 3.

## 5. Report

- PR body (normal prose): history table rounds × seat × category, ours' tier; drift row with every reference tier change (expected zero).
- Per shipped change: annotated before/after (arrow + one line) so the user can see subtle diffs.
- Attribution: seats that ran, observed model/effort per seat (or requested, resolution unverified), rounds where a seat sat out and why (staged, quota, failure), blinding limits, total judge calls.

## 6. Resume

`state.json` exists for `<slug>` → reload contract, mapping history and last commit. Commit changed since last round → re-capture ours, rerun admitted seats before building more.

## 7. Scripted climb

Fuzzy problem → eval → climb. Fits skill descriptions, kernel size, MCP or tool text, prompt behavior.

1. Mine own history for cases where agents did the wrong thing (session transcripts, review findings, `pitfalls.md`). Categorize.
2. Each case → eval with a programmatic pass condition. Run current state on every target model; record baseline (source run: about 60 of 88).
3. Climb to perfect on every target model. Commit; freeze cases.
4. Flip objective: cut cost (source run: tool descriptions to a third of their size) while staying perfect. Mid-climb regressions are expected (66 → 63 of 85); recover by changing the subject, never the cases.
5. Commit the eval with the change → later edits stay testable. Source run result: 52% fewer tool tokens, 78% with tool search on.

No council needed here; the project's normal PR review still applies.

Source: Theo, "Agents Sucked At UI (Until Today)", 2026-11-03, https://www.youtube.com/watch?v=xq0eB8vxeqk. Figures above are that one run's, not benchmarks.
