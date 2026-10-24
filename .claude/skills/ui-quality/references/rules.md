# Rules

Each rule names its source and how it is checked. Sources: a WCAG 2.2 success criterion with its level, a platform guideline (Apple Human Interface Guidelines, Material Design), Core Web Vitals, or Craft (practice without a standard behind it; say so when citing it). "Probe" names the check that measures it; "Manual" means a person or agent has to look.

The probe's `fail` covers WCAG A and AA, with one exception: a page where turning on reduced motion changes nothing on screen (MO1). AAA, platform and craft rules are otherwise advisory unless the project's own instructions raise them.

## See

| ID | Rule | Source | Checked by |
|---|---|---|---|
| SE1 | Body text at least 4.5:1 against what is behind it; large text (24 px, or 18.66 px bold) at least 3:1 | WCAG 1.4.3 AA | Probe `axe`, `contrast` |
| SE2 | Icons that carry meaning, input borders, focus rings and control edges at least 3:1 against neighbours | WCAG 1.4.11 AA | Manual; axe covers only part |
| SE3 | Colour is never the only signal: errors, status, required fields and links in text also differ by text, icon, weight or underline | WCAG 1.4.1 A | Manual |
| SE4 | Meaningful images have a text alternative; decorative ones are hidden from assistive technology | WCAG 1.1.1 A | Probe `axe` finds missing ones; whether the text makes sense is manual |
| SE5 | Both themes are checked on their own; dark-theme values are never assumed from light | Craft | Probe `dark` |

## Read

| ID | Rule | Source | Checked by |
|---|---|---|---|
| RE1 | At 320 CSS px wide nothing needs sideways scrolling and nothing is cut off, except content that needs two dimensions (data tables, maps, code) scrolling inside its own box | WCAG 1.4.10 AA | Probe `reflow` |
| RE2 | Text survives WCAG text spacing (line height 1.5, paragraph gap 2em, letter 0.12em, word 0.16em) without being cut off | WCAG 1.4.12 AA | Probe `spacing` |
| RE3 | Text can grow to 200% without lost content; never disable zoom in the viewport tag | WCAG 1.4.4 AA | Probe `axe` (viewport tag), `reflow` at 640, `textscale` as a stress test |
| RE4 | Body text at least 16 px on phones; lines about 45 to 75 characters on wide screens | Craft | Manual |
| RE5 | Fixed heights with hidden overflow around text are a bug waiting for a longer name or language | Craft | Probe `reflow`, `spacing`, `textscale` (clipped text) |

## Reach

| ID | Rule | Source | Checked by |
|---|---|---|---|
| RC1 | Every action works by keyboard alone | WCAG 2.1.1 A | Probe `focus` for Tab reach; Enter, Space, Escape and arrow keys are manual |
| RC2 | Focus can always leave a component; dialogs keep focus inside while open and return it to the opener on close | WCAG 2.1.2 A, 2.4.3 A | Probe `focus` notes loops; dialogs are manual |
| RC3 | Focus order follows the visual and reading order | WCAG 2.4.3 A | Probe lists the order; judging it is manual |
| RC4 | The focused element is always visibly marked | WCAG 2.4.7 AA | Probe `focus` |
| RC5 | Sticky headers, cookie bars and chat widgets never cover the focused element entirely | WCAG 2.4.11 AA (2.4.12 AAA for partly) | Probe `focus` |
| RC6 | The focus marker is at least as large as a 2 px outline around the element and changes contrast by 3:1 | WCAG 2.4.13 AAA | Probe `focus` flags weak markers |
| RC7 | Pointer targets at least 24 by 24 CSS px or spaced so a 24 px circle fits; 44 pt on Apple platforms and 48 dp on Android for touch | WCAG 2.5.8 AA; Apple HIG; Material | Probe `axe` (24 px), `phone` (44 px) |
| RC8 | Anything done by dragging also works with a single tap or click | WCAG 2.5.7 AA | Manual |
| RC9 | Content shown on hover or focus can be dismissed with Escape, hovered itself, and stays until dismissed | WCAG 1.4.13 AA | Manual |
| RC10 | Nothing essential depends on hover; touch screens have none | Craft | Manual |
| RC11 | A skip link or landmarks let keyboard users pass repeated navigation | WCAG 2.4.1 A | Probe `axe` (landmarks, best practice); manual |

## Operate and understand

| ID | Rule | Source | Checked by |
|---|---|---|---|
| OP1 | Every control has an accessible name, a role and its state (pressed, expanded, selected, checked) | WCAG 4.1.2 A | Probe `axe` for missing names; state changes are manual |
| OP2 | A control's visible text is part of its accessible name | WCAG 2.5.3 A | Probe `axe` |
| OP3 | Fields have visible labels; a placeholder is not a label | WCAG 3.3.2 A | Probe `axe` for missing labels; placeholder-only is manual |
| OP4 | Errors say which field and what to do, sit next to the field, and keep what the user typed; several errors also get a summary that takes focus after submit | WCAG 3.3.1 A, 3.3.3 AA | Manual: submit the form wrong |
| OP5 | Sign-in allows password managers and paste; no puzzle or memory test without an alternative | WCAG 3.3.8 AA | Manual |
| OP6 | Information already given in the same process is filled in or selectable, not asked again | WCAG 3.3.7 A | Manual |
| OP7 | Help links and contact options stay in the same place across pages | WCAG 3.2.6 A | Manual |
| OP8 | Status changes (saved, 3 results, upload failed) are announced without moving focus | WCAG 4.1.3 AA | Manual |
| OP9 | One primary action per screen; destructive actions are distinct and confirmed or undoable | Craft; Apple HIG | Manual |
| OP10 | Disabled controls say why, or stay enabled and explain on use | Craft | Manual |

## Motion

| ID | Rule | Source | Checked by |
|---|---|---|---|
| MO1 | With reduced motion on, decorative and scroll-driven motion stops or becomes a fade; the final state still shows | WCAG 2.3.3 AAA; this skill treats it as a floor because large or parallax motion can cause dizziness and nausea in people with vestibular disorders | Probe `motion` |
| MO2 | Anything that moves, blinks or auto-advances for more than 5 seconds beside other content can be paused, stopped or hidden; carousels stop on focus and hover | WCAG 2.2.2 A | Probe `motion` flags candidates; the control is manual |
| MO3 | Nothing flashes more than three times a second | WCAG 2.3.1 A | Manual |
| MO4 | Durations fit the distance and size of the change (small UI 100 to 200 ms, larger panels 200 to 400 ms); exits faster than entrances; press feedback within 100 ms | Craft; Material motion | Manual |

## Stability

| ID | Rule | Source | Checked by |
|---|---|---|---|
| ST1 | Layout shift under 0.1; reserve space for images, ads, banners and late data | Core Web Vitals | Probe `shift` |
| ST2 | Hover, press and focus styles never change an element's size or move its neighbours | Craft | Manual |

## Stack traps

Common ways a stack breaks the rules above. Check the ones that match the detected stack.

- Tailwind: `focus:` styles also show on mouse click, so teams remove them; use `focus-visible:` instead of removing focus styles. `outline-none` without a replacement fails RC4.
- CSS resets with `*:focus { outline: none }` fail RC4 everywhere at once.
- `hidden md:block` and similar hide content on phones; check that nothing a phone user needs is behind it.
- `overflow-x: hidden` on `html` or `body` turns a reflow failure into silently cut-off content; the probe reports it as `reflow:cut-off`.
- `height: 100vh` on phones sits under the browser bars; use `100dvh` or `min-height`.
- `user-scalable=no` or `maximum-scale=1` in the viewport tag fails RE3.
- Emoji or icon fonts as the only label for a control fail OP1 and render differently per platform; use an SVG with an accessible name on the control.
- `title` as the only name is unreliable; touch and many screen readers ignore it.
- React and other component frameworks: a `div` with `onClick` has no role, no Tab stop and no Enter key; use `button` or `a`.
- Native apps (React Native, Flutter, SwiftUI, Compose): the probe does not apply. Check targets against 44 pt or 48 dp, Dynamic Type or font scaling at the largest size, and screen reader labels in a simulator.
