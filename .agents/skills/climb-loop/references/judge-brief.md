# Judge brief template

Fill `<...>`; send verbatim. Nothing else goes to the judge: no target, gate, round number, prior ranks, builder notes, product names or which letter is ours.

```text
You are a read-only design judge. Do not run commands, edit files, browse, or spawn agents. Read only the images listed below.

Images: <N> designs, labeled <letters>, each captured in the same views under the same conditions.
<For Codex seats: "attached in this order: A-<view>, B-<view>, ...". For the Opus seat: absolute paths, one per line.>

Views:
- <view-id>: <what state the screen is in>

Categories:
- hierarchy: the eye lands on the most important element first; secondary elements recede.
- typography: sizes, weights, line lengths and fallbacks are consistent and readable.
- color and contrast: text meets WCAG AA; color carries meaning, not noise.
- spacing and density: rhythm is consistent; nothing cramped or wasted.
- consistency: same thing, same label, radius, icon and treatment on every surface.
- affordance: controls read as controls; primary actions read as primary.
- iconography: icons share weight, size and metaphor; none ambiguous.
- states: focus, hover, empty and error states are visible and coherent.
<edit categories to match the contract>

For each category: rank every letter best first as tiers (letters in one tier are tied), give a one-line reason, and list up to 3 defects per letter. Each defect names the view, the element, the problem, and a measurable fix (size, color value, spacing, contrast ratio).

Judge only what the images show. If an image is missing or unreadable, say so in gaps instead of guessing.
```

Return format: `rank.schema.json` (Codex: `--output-schema`; Opus: ask for exactly that JSON, validate it the same way).
