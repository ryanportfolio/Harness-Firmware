# Build mode

For a new screen, component or flow, or a change to one. The order matters: decisions first, states second, code third, audit last.

## 1. Read what the project already decided

- Repository instructions, then the design system in code: tokens, theme files, CSS variables, Tailwind config, a component library. These are the record. Reuse an existing component before writing a new one.
- The saved decisions file, `design/system.md`, if it exists, and `design/pages/<page>.md` for the page you are building. A page file overrides the main file for that page only.
- Detect the stack from the manifests (`package.json` dependencies, `pubspec.yaml`, `Package.swift` or `*.xcodeproj`, `build.gradle` with Compose, `composer.json`, `Gemfile`). If nothing is detectable and the stack changes what you write, ask. Load the matching stack traps in [rules.md](rules.md).

## 2. Make the missing decisions once

Decide only what the code and the decisions file do not already settle, write it down in `design/system.md`, and keep it short. Record what the code cannot show. Do not copy token values that live in code; point to the file.

- **Density:** spacious (marketing and reading pages), standard, or dense (dashboards, admin tables). It sets the spacing scale and row height.
- **Text:** body size (at least 16 px on phones), line length, and the type scale steps in use.
- **Colour roles:** surfaces, text, one accent for the primary action, status colours used only for status. Contrast of each text and control pair measured in every theme the product ships (rules SE1, SE2, SE5).
- **Focus style:** one visible marker for every control, at least a 2 px outline or equivalent with 3:1 contrast (RC4, RC6). Use `:focus-visible`.
- **Targets:** 24 px minimum on the web, 44 px for touch-first products; 44 pt or 48 dp in native apps (RC7).
- **Motion:** two or three duration steps and what each is for, and the reduced-motion version of each (MO1, MO4).
- **Test widths:** 320, 375, 768 and 1280 CSS px, or the product's own breakpoints.

When a decision changes later, update the file in the same change as the code. A decisions file that no build reads goes stale. Audit mode compares code with it and reports drift.

## 3. List every state before writing markup

For each screen, write the states it can be in and what the user sees and can do in each. A state with no design is a bug the first user will find.

| State | Ask |
|---|---|
| Default | Real content at realistic length, not placeholder text |
| Empty | First use (explain and give the one action that fills it), no results (say what was searched and how to widen it), cleared by the user |
| Loading | Under 1 s: nothing. 1 to 10 s: skeleton or progress that keeps the layout's space. Over 10 s: progress with a way to cancel or leave |
| Partial | Some data arrived, some failed or is still coming |
| Error | Network, validation, not found, no permission, server. Each says what happened and what to do next, and keeps the user's input |
| Success | Confirmation that names what changed; undo where the action can be undone |
| Disabled or read-only | Why it is unavailable and how to make it available |
| Offline or slow | What still works; what will retry |
| Signed out, other roles | What a visitor or a lower-permission user sees |
| Hostile content | Longest name, a word with no break points, huge numbers, long currency formats, text 30 to 40 percent longer after translation, right-to-left if supported, one item and many items |

## 4. Build

- Native elements first: `button`, `a`, `label`, `input`, `select`, `dialog`, `details`. A custom control needs its role, name, state and keyboard behaviour (OP1, RC1).
- Forms: visible labels; hints before the field; `autocomplete` attributes; paste allowed; errors next to the field and kept on resubmit; a linked summary when several fail (OP3, OP4, OP5).
- Reserve space for images, embeds and late data (ST1). Never change an element's size on hover or press (ST2).
- Long lists over about 50 items: paginate or virtualise.
- Respect `prefers-reduced-motion` and `prefers-color-scheme` if the product has a dark theme.

## 5. Audit what you built

Serve it locally and run [audit.md](audit.md) at quick depth on every state you listed in step 3 that a URL can show. Fix every `fail` before calling the work done, and say which states you could not reach and why.
