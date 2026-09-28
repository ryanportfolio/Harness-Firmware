# Triage

Measure every performance dimension that applies to the project, rank the results, and hand the user a table to choose the focus from. Triage finds and ranks problems. It changes no code, and its numbers never serve as the acceptance baseline.

## Choose the dimensions

List each dimension that applies to the project. Use the measurement method from the named reference.

| Dimension | What to measure | Method |
| --- | --- | --- |
| Loading and readiness | Time to visible content and to a successful first action, cold and warm, on the main routes or launch path | [Loading](loading.md) |
| Delivery size | Compressed transfer and decoded bytes per route or artifact; the largest bundles, assets and dependencies | [Loading](loading.md) |
| Rendering | Frame-time distribution and hitch count in the heaviest scene, animation or scroll | [Rendering](rendering.md) |
| Input responsiveness | Time from input to visible response on the main interactions | [Rendering](rendering.md) |
| Memory | Peak, retained after idle, and growth over repeated cycles of the main journey | [Services](services.md) |
| Service latency and throughput | Latency percentiles, completed operations per second, and errors at a stated load | [Services](services.md) |
| CPU, disk and startup | Process startup, CPU time and I/O on the sustained workload | [Services](services.md) |

Add a dimension the project has that this list misses, such as battery use, build time or cold start of a serverless function. Keep every row. A dimension that does not apply gets "not applicable" and the reason. A dimension the available tools cannot measure gets "not measured" and the missing capability. Never drop a row silently.

## Measure

Use the same setup rules as the full loop: a representative optimized build, one preflight run per method, controlled cache and warmup, and serial runs on shared hardware. Give each dimension a short run set: at least three runs for quick deterministic scenarios, and a stated smaller plan for expensive ones. Record units, run counts and spread, and keep raw evidence paths.

Profile each dimension far enough to name its top contributor: the largest module or asset, the longest main-thread task, the slowest query, the fastest-growing allocation. Stop there. Deeper diagnosis happens after the user picks a focus.

## Compare against a reference

A number alone does not show a problem. Compare each row with, in order of preference:

1. An existing project budget.
2. A published reference, labeled inferred: for example the `1000 / target FPS` frame budget, or current official web-vitals thresholds checked against their documentation.
3. No reference. Say so and rank the row by judged user impact, labeled as judgment.

## Present the table

| Rank | Dimension | Scenario | Measured (unit, runs, spread) | Reference (source) | Gap | Top contributor | Confidence | Fix cost | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Rank by how far each row misses its reference, weighted by user impact, and state the ordering rule used. Keep passing rows in the table, marked passing. Put "not applicable" and "not measured" rows last.

After the table, name the row you would pick and why in one or two sentences. Then stop and wait for the user to choose. Do not start an optimization round on your own choice. An unattended run with nobody to choose ends here and reports the table.

The chosen dimension becomes the primary metric. Record a full baseline for it before the first round; triage runs are too few to accept a change against.
