# Audit mode

## Depth

- **Quick:** the probe on each URL and state, every `fail` verified, the report. Use after a build and for a single screen.
- **Full:** quick, plus the manual checks below and every `review` item decided. Use when the user asks for an audit or before a launch.

Pick from the request; ask only when the scope is unclear and large.

## 1. List what to audit

Write the URLs and the states each needs ([build.md](build.md) step 3 has the list). States the bare URL does not show need a way in: a query string, seeded data, a feature flag, a mocked response, or a signed-in session. For a signed-in session, sign in once in a Playwright script and save `context.storageState({ path })` to a file under `.tmp/`, then pass `--storage-state`. Never put credentials in the report or in a committed file.

A state you cannot reach goes in the report as not checked, with what access would reach it.

## 2. Run the probe

```bash
node .agents/skills/ui-quality/scripts/probe.mjs --url <url> --url <url> --out <screenshot dir>
```

Run it on the project's own server, not on a production site you do not own. Use `--wait-for <css>` when content arrives after load, and `--skip` to leave out checks that do not apply (`dark` for a light-only product). Several URLs share one browser; run separate probes one after another on shared hardware.

No running app (no server, missing secrets, a native app): read the code against [rules.md](rules.md) and label every finding "from code, not measured". For native apps use a simulator and screenshots, and say which device and text size you checked.

## 3. Verify before reporting

Open the screenshot and the element for every `fail`, and for every `review` at full depth. Drop what is wrong and say how many you dropped. Known false positives:

- `focus:invisible` or `focus:weak` next to an animation: moving pixels count as a change, so a marker can look stronger or weaker than it is.
- `contrast:composited` with a low worst-5% value but a high median: the text box also covers an icon or border. Look at the text.
- `reflow:horizontal-scroll` caused by a carousel, code block or table that should scroll inside its own box: the fix is the container's overflow, not the content.
- `reflow:cut-off`: an off-canvas element that is visible and not marked hidden; real if it holds content a user needs.
- `shift:cls` on first visit only: a consent banner or font swap. Still real for new visitors.
- `motion:reduced` as `review` for a loop that is off screen: check it once scrolled into view.
- `axe` best-practice items: advisory; report them only when they matter to this product.

## 4. Do what the probe cannot (full depth)

- Keyboard beyond Tab: Enter and Space on every control, Escape on dialogs, menus and popovers, arrow keys in tabs, menus, radios and grids. Dialogs keep focus inside and return it on close.
- Names and text: do labels, alt text, button names and error messages make sense read alone?
- Forms: submit empty, submit wrong, submit twice, go back. Errors next to the field, input kept, summary focused when several fail.
- Status messages: does a saved, filtered or failed state announce itself? Check `aria-live` or `role="status"` in the code.
- Hover and drag: anything shown on hover is reachable by focus and dismissable with Escape; anything dragged has a click alternative.
- Content the probe skips: canvas, WebGL, video captions, cross-origin iframes.
- A screen reader pass (NVDA on Windows, VoiceOver on macOS and iOS, TalkBack on Android) when one is available. Without one, say so.
- Drift: compare the code with `design/system.md` and report differences.

## 5. Report

Lead with the result, then the detail.

1. **Fix first:** up to five findings, most harmful first, each one line with its fix.
2. **Coverage:** URLs and states checked, depth, widths, themes, and what was not checked and why. Copy the probe's "Not measured" list and remove what you checked by hand.
3. **Findings**, one per row:

| Severity | Where | Measured | Rule | Fix |
|---|---|---|---|---|
| Blocker, Major or Minor | URL, viewport, element, screenshot file | what was observed, with the number and the threshold | rule ID and source from rules.md, or Unmatched | concrete change, with code or copy where it helps |

Severity is about people, not the probe's label. **Blocker:** some users cannot complete the task (no keyboard access, focus hidden, content lost at 320 px, a required field with no label). **Major:** a WCAG A or AA failure that makes the task harder, or motion that ignores reduced motion. **Minor:** AAA, platform and craft items. Mark each finding Measured (probe or a check you ran), Observed (screenshot or manual check), or From code.

Never conclude "accessible" or "compliant". Say what passed, what failed and what was not checked.
