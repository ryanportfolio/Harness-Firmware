---
name: ui-quality
description: "Quality floor for everyday UI (forms, dashboards, settings, app screens): build with every state + saved design decisions; audit by measuring rendered page (axe-core + focus, reflow, text spacing, reduced motion, contrast over images, layout shift). Use: $ui-quality, 'audit accessibility', 'is this UI production-ready', 'check this page on mobile'. Ambitious look → showpiece; conversion → conversion-ux."
---

# UI quality

Makes sure everyone can see, read, reach and operate a screen, in every state it can be in. Covers the everyday interfaces `showpiece` leaves alone: forms, tables, dashboards, settings, account and app screens, plus the quality floor under any ambitious page.

It does not choose a look. Style, palette and type come from the project's design system or from `showpiece` and `frontend-design`. It does not judge whether a flow converts; that is `conversion-ux`.

## Rules that override everything here

- **Measure, don't tick.** A finding comes from the probe, a screenshot or code you read, and says which. Never mark a rule as met because it seems likely.
- **Say what was not measured.** The probe covers part of the rules. An audit lists what it could not see, and never calls a screen "accessible" or "WCAG compliant".
- **The repository wins.** Its instructions, design tokens, theme files and component library beat anything in this skill. Follow them; report a conflict instead of overriding it.
- **Never assume the stack.** Detect it from the project's manifest files; if nothing is detectable and it matters, ask.
- **No made-up specifics.** If no measurement or source backs a number, label it a judgment call.

## Modes

- **Build** a screen, component or flow: [build.md](references/build.md). Read the saved design decisions, cover every state, then run audit mode on the result before calling it done.
- **Audit** an existing page, flow or component: [audit.md](references/audit.md). Run the probe on every state, verify what it reports, do the checks it cannot, and report.

[rules.md](references/rules.md) lists every rule with its source (a WCAG 2.2 success criterion, a platform guideline, or craft) and whether the probe measures it.

## The probe

`scripts/probe.mjs` loads each URL in headed Chrome, offscreen and muted, and measures:

| Check | What it measures |
|---|---|
| `axe` | axe-core WCAG 2.2 A/AA and best-practice rules at 1280 px and at 375 px with touch |
| `contrast` | text contrast over images and gradients that axe marks as needing review, from pixels behind the text |
| `focus` | Tab through the page: focus visible (pixel difference focused vs not), focus hidden under fixed or sticky UI, off-screen focus, loops |
| `reflow` | sideways scrolling and cut-off content at 320 and 640 CSS px (400% and 200% zoom of 1280) |
| `spacing` | text newly cut off under WCAG 1.4.12 text spacing |
| `textscale` | text newly cut off when all text is doubled (a stress test beside 1.4.4) |
| `motion` | animations, videos and moving pixels with and without reduced motion |
| `shift` | layout shift (CLS) during load |
| `dark` | axe contrast under the dark colour scheme, when the page has one |
| `phone` | 375 px screenshot, axe at that width, controls under 44 px |

Install the two packages for this run only, from the project root, then run it against a URL the project serves:

```bash
npm i --no-save axe-core@latest playwright-core@latest
node .agents/skills/ui-quality/scripts/probe.mjs --url http://localhost:3000/settings --out <screenshot dir>
```

Options: `--url` (repeat for several), `--out`, `--storage-state <file>` (a saved Playwright sign-in), `--wait-for <css>`, `--settle <ms>` (default 1500), `--max-tabs <n>` (default 80), `--skip <check,check>`, `--strict` (exit 1 on any fail). It writes `report.md`, `report.json` and screenshots, and takes about 30 to 45 seconds per URL. Exit 2 means the run is incomplete: no Chrome, no packages, bad arguments, or a URL that could not be audited (its error is in the report).

Severity in the report: `fail` is a measured WCAG A/AA failure, `review` needs a person to decide, `advisory` is AAA, best practice or a platform guideline. The probe can be wrong; [audit.md](references/audit.md) lists its known false positives.

## Neighboring skills

- `showpiece`: ambitious creative direction. Its work still has to pass this skill's floor.
- `conversion-ux`: whether users can decide and act in a flow. Its screen checks lean on this skill for accessibility.
- `redesign-concepts`, `design-prototypes`: image concepts before or after a build.
- `writing`: wording of labels, errors and empty states once this skill has said what each must tell the user.
- When installed: `frontend-design` (visual styling).

## Codex use

Use the request accompanying $ui-quality as the target: a URL, a route, a component path or a description. This skill is standalone. Live pages you do not own are read-only. The probe uses the repository's `launchPlacedChrome()` from `scripts/lib/launch-chrome.mjs` when it exists and otherwise launches Chrome directly, offscreen and muted; it never runs headless. Without a way to run headed Chrome, audit from code and supplied screenshots, label findings "from code, not measured", and list what could not be checked. Save its output where the project's instructions put screenshots. An audit delegated to an exposed subagent gets these rules, the URLs and states, the output folder and the headed-Chrome rule in its brief. Stop any dev server you started for the audit when you finish.
