# Live site: scene floor + critique rounds

Use when a showpiece site's main experience is a real-time scene drawn in code (canvas, WebGL, shader, simulation). Static or editorial page → skip this file.

Source: one prompt the owner took from someone else's reported result, two builds seen here (liquid-glass landing page and a forged-knife page, both 2026-11), owner judged both strong. Two cases; which rule carried the result is untested. Change a rule on evidence from a later build, not to save time on the current one.

## Floor

Holds from the first build, before any round.

- **Alive at load.** Motion or attract mode from first frame, no input. Capture at load + 2 s, untouched: reads as a finished scene, never as a page waiting for the visitor.
- **Input in first second.** Pointer or key changes the scene within 1 s of first input. Touch or no-hover device → scene keeps its attract mode.
- **Fills window.** Canvas tracks resize; no letterbox, no scrollbar gap.
- **Frame rate.** Target 60 fps at 1920x1080 on a recent laptop GPU; 30 fps = floor. Never render faster than 60 fps: on a faster display draw every second or third display frame so pacing stays even (100 Hz → 50, 120 Hz → 60, 144 Hz → 48); extra frames cost GPU and battery and buy nothing. Cap device pixel ratio at 2. Frames over budget for a run of frames → lower internal render resolution in steps; raise it again only after sustained headroom, so it does not flip back and forth.
- **One scene.** The scene is the page's one heavy effect (`motion-design` skill, `references/web-effects.md`, "Cost and budget"). Stop its loop while the tab is hidden or the canvas is off screen.
- **Reduced motion and pause.** The scene runs on a live page, so `prefers-reduced-motion` gets a still or a slow fade of the same scene, and motion that autoplays longer than 5 s gets a visible pause control (web-effects.md, "Shared conventions"). Drop either only when the user says so.
- **Scroll.** Tie scene state to scroll position (hero object turns, light moves, material changes). Smooth scroll only when the brief asks; native scroll, keyboard and anchors keep working.
- **Sections.** Scene's material carries into the ordinary parts: buttons, labels, tables, footer. Hero scene over template sections = unfinished (SKILL.md, "Develop with deliberate choices").
- **Copy.** Real words for the subject, clear voice, sentence case. No lorem ipsum, no emoji as icons. State only facts you are sure of. Large display type carries names and live readings, not slogans: a section that wants a statement shows it as a picture in the scene; the hero headline is the one exception, a plain claim about what the subject does (second build, 2026-11: owner rejected every slogan-style display line; four rounds of self-review had not flagged them). Invented brand → say so in the delivery note; no invented awards, health claims, client names or figures that read as real.

## Rounds

Run at least 4 rounds on this kind of piece, unless the user sets another count. This replaces the "bound review effort" stop rule in SKILL.md until round 4 is done.

Each round:

1. **Capture.** 3+ screenshots, each a different moment, view or input state: untouched at load, mid-scroll, during pointer input, a late section, the footer. Across the run, cover every section, and the narrowest supported phone width at least once. Headed browser on the real GPU; a headless or software-rendered capture is not evidence for a WebGL scene.
2. **Read** every capture. Reading code is not a visual check.
3. **Judge** as a harsh art director. Compare with the best work of this kind, by name: the bar the brief gives, or specific works you can describe. Brief names no bar → a site featured on thefwa.com or an Awwwards site of the day. Cover type, spacing, motion, light, detail, the rhythm between sections, and any display line that states a slogan where a picture would do.
4. **Name the three weakest things.** Ranked, each tied to a capture and to what a visitor sees. This is a relative ranking: every piece has a bottom three, so naming them is not manufactured criticism. Never pad the list with invented defects; when an item is preference-level, label it so.
5. **Fix** all three. Central idea is the weak thing → rework the idea (SKILL.md, "Prove the direction at small scale"); no more effects on top.
6. **Check again.** Re-capture the same states, read them, confirm each fix landed and nothing else broke.
7. **Measure frame rate** at 1920x1080: idle, during scroll, during input. Under 30 fps anywhere → the next round's first fix is performance.

After round 4: continue while any of the three is more than preference-level; stop when all three are preference-level.

Same weakness in the top three two rounds running → change the approach; do not polish it a third time.

These rounds are self-review; say so in the delivery note. Independent critics → `wow-loop`, only when the user asks for it or has already authorized it.

## Delivery note adds

- Rounds run; per round, the three things named and what changed.
- Frame rate: numbers, resolution, GPU, how measured. Not measured on a real GPU → say so; never report a guess.
- Reduced motion and pause control: present, or dropped at whose request.
