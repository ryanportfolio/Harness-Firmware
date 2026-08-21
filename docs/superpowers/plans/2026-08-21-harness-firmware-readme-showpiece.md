# Harness Firmware README Showpiece Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generated Harness Firmware README whose main animated infographic explains the recall, work, verify, refine, and sync feedback loop.

**Architecture:** Move advanced instructions into `GUIDE.md`. Generate `README.md` and four responsive variants of each SVG panel from repository facts. Node built-ins collect facts, render deterministic SVG, assemble Markdown, and fail CI when committed output is stale.

**Tech Stack:** Markdown, SVG, CSS keyframes, Node.js ESM built-ins, Node test runner, GitHub Actions, GitHub Markdown API, Playwright.

---

### Task 1: Split front door and manual

**Files:**
- Create: `GUIDE.md`
- Modify: `README.md`

- [ ] Move full-template variants, Codex notes, prose mode, doctor, context accounting, detailed work loop, runtime boundary, path inventory, forking, machine setup, requirements, and provenance into `GUIDE.md`. Preserve commands and links.
- [ ] Keep a temporary README with the definition, plugin commands, full-template link, short feedback-loop explanation, and links to the guide, contribution rules, changelog, and license.
- [ ] Run `rg -n "plugin marketplace add|prose mode|retarget-fork|setup-machine" README.md GUIDE.md`.
- [ ] Run `git diff --check`. Expect no whitespace errors.

### Task 2: Add checked facts

**Files:**
- Create: `scripts/readme/items.json`
- Create: `scripts/readme/lib.mjs`
- Create: `scripts/readme/facts.mjs`
- Create: `scripts/readme/readme.test.mjs`

- [ ] Write `items.json` with the exact 30-skill inventory and 8 core, 8 discipline, 14 specialist grouping from the approved design spec.
- [ ] Add failing tests:

```js
assert.equal(facts.skillCount, 30);
assert.equal(facts.adapterCount, 30);
assert.equal(facts.referenceFileCount, 6);
assert.deepEqual(facts.tierCounts, { core: 8, discipline: 8, specialist: 14 });
assert.deepEqual(facts.inventoryNames, facts.canonicalNames);
```

- [ ] Run `node --test scripts/readme/readme.test.mjs`. Expect FAIL because `facts.mjs` is absent.
- [ ] Implement `lib.mjs` with repository paths, GitHub light and dark tokens, XML escaping, UTF-8 writing, JSON reading, and frontmatter parsing.
- [ ] Implement `collectFacts()` from canonical skills, adapters, reference files, inventory, `CLAUDE.md`, skill bytes, and description characters. Throw on inventory or adapter drift.
- [ ] Run the test again. Expect PASS for counts, membership, and byte measurements.

### Task 3: Generate the feedback circuit first

**Files:**
- Create: `scripts/readme/panels.mjs`
- Create: `assets/readme/feedback-light.svg`
- Create: `assets/readme/feedback-dark.svg`
- Create: `assets/readme/feedback-narrow-light.svg`
- Create: `assets/readme/feedback-narrow-dark.svg`
- Modify: `scripts/readme/readme.test.mjs`

- [ ] Add tests requiring `role="img"`, `aria-label`, `<title>`, reduced-motion CSS, no script or remote URL, and exactly one visible label for `RECALL`, `WORK`, `VERIFY`, `REFINE`, `SYNC`, and `NEXT REPO`.
- [ ] Implement a shared SVG shell using system fonts and these tokens:

```js
export const THEMES = {
  light: { ink: "#1f2328", mute: "#59636e", rule: "#d1d9e0", accent: "#1a7f37", soft: "#dafbe1" },
  dark: { ink: "#f0f6fc", mute: "#9198a1", rule: "#3d444d", accent: "#3fb950", soft: "#12261e" }
};
```

- [ ] Implement a wide routed circuit and a narrow vertical board. Run one 12-second signal loop. Make `SYNC` to `NEXT REPO` dotted. Restore the complete circuit under reduced motion.
- [ ] Run the generator and tests. Expect four feedback assets and passing contracts.

### Task 4: Generate supporting panels

**Files:**
- Modify: `scripts/readme/panels.mjs`
- Create: `assets/readme/boot-{light,dark,narrow-light,narrow-dark}.svg`
- Create: `assets/readme/runtime-{light,dark,narrow-light,narrow-dark}.svg`
- Create: `assets/readme/skills-{light,dark,narrow-light,narrow-dark}.svg`
- Modify: `scripts/readme/readme.test.mjs`

- [ ] Extend accessibility, local-only, reduced-motion, and four-variant tests to every panel.
- [ ] Generate boot rows from current counts: kernel, skills, memory files, runtime boundaries, and validation.
- [ ] Generate the runtime bus from canonical skills to Claude Code and generated adapters to Codex, with shared repository memory.
- [ ] Generate exactly 30 skill cells in deterministic group-then-name order. Wide mode uses three banks. Narrow mode stacks them.
- [ ] Run `node scripts/readme/panels.mjs` and the Node tests. Expect 16 SVG assets and passing contracts.

### Task 5: Generate README and enforce freshness

**Files:**
- Create: `scripts/readme/readme.mjs`
- Create: `scripts/readme/build.mjs`
- Create: `scripts/readme/verify.mjs`
- Modify: `README.md`
- Modify: `scripts/readme/readme.test.mjs`

- [ ] Add tests for the generated marker, four `<picture>` blocks, installation before guide links, current counts, existing assets, and one generated list entry per canonical skill.
- [ ] Generate narrow-dark, narrow-light, wide-dark, and wide-light image sources in that order. Set `width="100%"` and sentence-level alt text.
- [ ] Use this lead: `A repo-resident operating layer for AI coding agents. Project knowledge, reusable workflows, and verification rules travel with the code they govern.`
- [ ] Keep installation commands selectable. Put the feedback circuit immediately after quickstart. Generate skill lists from inventory. Link advanced material to `GUIDE.md`.
- [ ] Make `build.mjs` run panels then README. Make `verify.mjs` snapshot all 17 generated files, rebuild, and fail with changed paths when output differs.
- [ ] Run:

```bash
node scripts/readme/build.mjs
node --test scripts/readme/readme.test.mjs
node scripts/readme/verify.mjs
```

Expected: all pass and freshness prints `README artifacts are current.`

### Task 6: Add CI gates

**Files:**
- Modify: `.github/workflows/validate-template.yml`

- [ ] Add:

```yaml
      - name: README facts and generated assets are valid
        run: node --test scripts/readme/readme.test.mjs

      - name: README generated output is current
        run: node scripts/readme/verify.mjs
```

- [ ] Run the existing adapter and Codex contract checks, then the new README test and freshness check. Expect every command to exit zero.

### Task 7: Render and close review

**Files:**
- Create temporarily: `.tmp/readme-specimen.html`
- Create temporarily: `.tmp/readme-880-light.png`
- Create temporarily: `.tmp/readme-880-dark.png`
- Create temporarily: `.tmp/readme-390-light.png`
- Create temporarily: `.tmp/readme-390-reduced.png`
- Modify only planned files when rendered evidence requires a fix

- [ ] Render `README.md` through GitHub's Markdown API with `mode=gfm` and wrap it in GitHub's current Markdown CSS.
- [ ] Capture 880 light, 880 dark, 390 light, and 390 reduced-motion views with Playwright.
- [ ] Require quickstart before advanced docs, readable loop labels, no horizontal overflow, correct theme blending, narrow sources at 390 pixels, complete reduced-motion output, no broken images, and no console errors.
- [ ] Fix one evidence-backed issue at a time. Rebuild, test, verify freshness, and recapture.
- [ ] Run closing verification:

```bash
node .claude/scripts/sync-codex-skills.mjs --check
node .claude/scripts/test-codex-contract.mjs
node --test scripts/readme/readme.test.mjs
node scripts/readme/verify.mjs
git diff --check
git status --short
```

Expected: zero contract violations, zero factual errors, current generated output, and only planned paths modified.

- [ ] Report branch, changed paths, test evidence, and captures. Commit, push, PR, merge, or release only when current authorization explicitly covers those actions.
