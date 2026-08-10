---
description: Multi-agent perfection loop for any deliverable. Recon, one spec, one implementer, adversarial screenshot-verified critique until an evidence gate passes. Use when the user says /wow-loop, asks for "wow factor" or "dial it to 11".
---

# Wow loop — evidence-gated pursuit of utterly perfect

Produces a deliverable that survives adversarial review, not one that merely looks done. The loop ends when verifiers armed with screenshots and measurements fail to break it, never when the work "seems finished". Subject-agnostic: the same shape works for a WebGL intro, a landing page, a slide deck, or a PDF.

`$ARGUMENTS` names the target when invoked as a slash command; otherwise take the deliverable from conversation context.

## Step 0: Isolation and determinism first

Before any agent runs, establish the substrate that makes verification trustworthy:

- Fresh worktree off freshly fetched main. Each concurrent workstream gets its own ports AND its own build output dir (e.g. `NEXT_DIST_DIR=.next-dev2`); two processes sharing one build dir silently corrupt each other.
- Seeded randomness only in the deliverable. Any animation or generated content must be reproducible.
- Build a capture hook into the work itself: a way to freeze the deliverable at any named state (`hold(percent)`, `beat(name)`) so a screenshot taken twice is byte-identical. If frames are not reproducible, every later verdict is a guess.
- Every agent that starts a server kills it before returning and proves the port is free.

## Step 1: Recon (ground truth, no opinions)

One read-only agent gathers what every later agent will rely on: exact code excerpts with line refs, live measurements (rendered positions, computed styles, timings), existing test pins, reusable pieces. Designers and implementers never work from memory or assumption; stale recon is how confident agents build the wrong thing. If a claim can be measured live, measure it rather than derive it.

## Step 2: Spec (one director, nothing left to taste)

Competing concepts from 2 independent designers are worth it for wide solution spaces; otherwise go straight to one director. Either way the output is ONE spec with exact values: dimensions, colors from the project's token vocabulary, timing tables, band/beat names, file layout, test plan, and a risk list. The spec is the single source of truth; if the implementer has to make a taste decision, the spec failed.

## Step 3: Implement (sole owner of hot files)

Exactly one implementer edits the deliverable per round. Parallel editors on shared files collide and silently clobber each other. The implementer self-verifies with the capture hook before returning: held-state screenshots at the spec's named beats, one natural uncontrolled run, accessibility variants (reduced motion, no-JS, keyboard). The implementer must READ its own screenshots before claiming them.

## Step 4: Adversarial verify (try to break it, on evidence)

Two or more verifiers with distinct lenses, each prompted to DISPROVE the work:

- An experience lens: does each beat land as intended for a human, judged from fresh screenshots at held states plus a natural run, compared against the reference or baseline in the same session.
- An engineering lens: independent test/typecheck/build runs, full diff read hunting regressions, scope violations, nondeterminism, accessibility damage, leaked processes.

Non-negotiables for verifiers: treat implementer claims as untrusted; read every screenshot cited; measure instead of eyeballing (pixel stats, bounding boxes, timings) whenever a finding could be argued; name exact evidence paths; label each finding confirmed or refuted with severity.

## Step 5: Fix and re-verify (the loop)

Confirmed findings go to one fixer whose brief is those findings and nothing else. The fixer reproduces each defect before fixing it and proves each fix with the same evidence discipline. Then verifiers run again against the fixed state. Repeat until a round produces zero confirmed findings or only honestly named residuals with causes. Cap rounds (about 5) and report unresolved residuals plainly rather than looping forever.

- Severity filters that gate the fix stage must match the words verifiers actually use: major, moderate, blocker, high, medium. A finding dropped by a too-narrow regex is a defect that ships.
- Mid-loop user feedback becomes a mandatory named check in the verifier prompts, not a note: "if X is still true, that is a CONFIRMED major finding titled exactly Y".

## Step 6: Final gate (orchestrator's own eyes)

The orchestrator, not an agent, runs the last pass: full test suite, typecheck, production build, banned-pattern sweeps (project copy rules), a natural end-to-end run, and its OWN reading of the money-shot frames. Only then ship. Report residuals with causes; never absorb them silently.

## Anti-patterns

- Don't end the loop because the work looks done; end it because adversaries armed with evidence failed to break it.
- Don't let any agent claim a visual it did not read, or verify a visual claim by reading code.
- Don't run parallel implementers on the same hot file, or parallel servers on a shared build dir.
- Don't trust one capture angle: vary pointer position, viewport, scroll state, and timing so state-dependent defects get seen.
- Don't average away a regression: compare against the reference in the same session, same viewport, same method.
- Don't skip reproducing a defect before fixing it, and don't accept a fix without a fresh capture proving it.
- Don't hide residuals; name them, with causes, in the final report.
