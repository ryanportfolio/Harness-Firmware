---
name: redesign-concepts
description: "$redesign-concepts: built UI screenshots → image_gen → 10 redesigns → owner picks → build plan. Brief only → design-prototypes."
---

# Redesign concepts

Critique an existing build from real screenshots and get generated redesigns of it. The images are design targets, not implementation: do not edit the product, commit images, or deploy. Default to 10 concepts; honor a different count. Not for exploring directions from a brief before anything is built.

Script paths are from the repository root; in a personal install, use the `scripts/` folder in this skill's directory.

## 0. Preflight and cost

- Needs an image generation tool exposed in this session (built-in `image_gen`) that accepts reference images, and a way to capture screenshots. Missing either: say so and stop; never draw concepts in code or call a paid API.
- Each image costs about 60-70k tokens on the user's subscription, so 10 images is roughly 700k. Say so before starting the batch.
- Use a fresh scratch dir inside the workspace that git ignores, for example `.tmp/redesign-<n>/`; the sandbox reads and writes only inside the workspace.
- Load the project's own UI or art-direction skill or reference first, if it has one, and carry its constraints into the identity line.

## 1. Capture

Screenshot the current build at desktop size (1440x900 unless the product targets another size) with the project's verification setup and browser rules (`AGENTS.md`). Cover each key screen and state, especially the busiest: first paint, an open menu or drawer, a filtered or search state, an admin view, a detail page. Reuse captures only if fresh. Keep originals where the project or user keeps screenshots; copy the chosen references into `<scratch>/refs/`.

## 2. Critique, then concepts

Look at every capture and list concrete problems: repetition, too many controls, jargon, weak hierarchy, things pushed below the fold. Write the concepts: one screen and one idea each, varied across composition, metaphor, hierarchy and interaction (recolors don't count). Mix user-facing and admin screens if both exist. Mark concepts that need data or backend the product lacks.

## 3. Prompts

Write `<scratch>/concepts.json` (format in the header of `scripts/make-prompts.mjs`), then run `node .agents/skills/redesign-concepts/scripts/make-prompts.mjs <scratch>`. It writes `prompts/NN-name.txt`, `prompts/NN-name.refs` (current screen first) and `index.md`. The shared brief asks for a calmer, plainer version of the same screen with the same identity and real data, a 1536x1024 opaque PNG at an exact path, and lists negatives such as "a copy of the screenshot with small changes", device frames, a color theme different from the screenshots, marketing heroes, emoji, lorem ipsum, garbled text and more than one screen. Add project negatives through `negatives`.

## 4. Generate

For each prompt without a valid `out/NN-name.png` (a PNG of 100 KB or more), call the image tool with that prompt and its refs as input images, and save to the exact path. Skipping valid outputs lets a rerun resume. `scripts/run-batch.sh <scratch> 3` drives separate `codex exec` processes three at a time instead; use it only when nested Codex runs are permitted here. A generated screen is hundreds of KB or more; a few-KB file was drawn some other way and does not count.

## 5. Review and present

Look at every image and note real flaws (invented labels, internal names in lists, garbled text, a copy of the screenshot). Regenerate only clear failures and say what changed. Show all images together with stable numbers, a one-line summary each, which need new data, and a recommended set with a concrete reason tied to the step 2 problems.

## 6. Fold picks into the build

On the owner's picks, write `<scratch>/synthesis.md` (copy it to the project's plans if the work outlives the session) resolving conflicts between concepts: one vocabulary across screens and the old terms it replaces, which existing features each idea replaces or hides, new data each needs and its source, and build order. Turn it into plan tasks or quality-loop checks. For a `wow-loop` or similar contract, add a versioned amendment with named checks and name each old check it retires because its feature is gone; never relax a check to make the new design pass.
