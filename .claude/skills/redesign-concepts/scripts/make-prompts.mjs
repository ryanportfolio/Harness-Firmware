#!/usr/bin/env node
// Writes one image prompt per redesign concept from <dir>/concepts.json:
//   <dir>/prompts/NN-name.txt   the prompt, fed to codex exec on stdin
//   <dir>/prompts/NN-name.refs  screenshot paths for that concept, one per line, current screen first
//   <dir>/index.md              numbered list of concepts, ideas, data needs and output paths
// Run from the workspace root; every path it writes into a prompt is relative to that root,
// because codex exec resolves the save path from its own working directory.
//
// concepts.json:
// {
//   "product": "the Acme orders app",
//   "audience": "non-technical shop staff",            optional
//   "identity": "warm off-white page, deep green primary buttons, ...",
//   "negatives": ["stock photos"],                       optional, added to the shared list
//   "concepts": [
//     { "name": "calm-home", "screen": "home page, first paint",
//       "idea": "one search box and three recent orders; everything else behind 'More'",
//       "refs": ["refs/home.png"], "needs": "recent orders per user" }
//   ]
// }
// "refs" are relative to <dir>. "needs" names data or backend the product lacks today (optional).

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node make-prompts.mjs <scratch dir containing concepts.json>");
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(path.join(dir, "concepts.json"), "utf8"));
for (const key of ["product", "identity", "concepts"]) {
  if (!spec[key] || (Array.isArray(spec[key]) && !spec[key].length)) {
    console.error(`concepts.json: missing ${key}`);
    process.exit(1);
  }
}

const slash = (p) => p.split(path.sep).join("/");
const audience = spec.audience || "non-technical users";
const negatives = [
  "a copy of the screenshot with small changes",
  "device frames or laptop mockups",
  "dark mode",
  "a marketing hero",
  "emoji",
  "lorem ipsum",
  "garbled or misspelled text",
  "more than one screen",
  ...(spec.negatives ?? []),
];

fs.mkdirSync(path.join(dir, "prompts"), { recursive: true });
const index = [`# Redesign concepts: ${spec.product}`, ""];
let failed = false;
let written = 0;

spec.concepts.forEach((concept, i) => {
  const id = `${String(i + 1).padStart(2, "0")}-${concept.name}`;
  const refs = (concept.refs ?? []).map((ref) => slash(path.join(dir, ref)));
  const missing = refs.filter((ref) => !fs.existsSync(ref));
  if (!concept.name || !concept.screen || !concept.idea || !refs.length || missing.length) {
    console.error(`${id}: needs name, screen, idea and at least one existing ref${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
    failed = true;
    return;
  }
  const out = slash(path.join(dir, "out", `${id}.png`));
  const prompt = `Use your image generation tool (image_gen) to create ONE image and save it to ${out} in this workspace. Do nothing else - no code changes. If image_gen is not available, say so and stop; do not draw the image any other way.

The attached image(s) are screenshots of the CURRENT version of ${spec.product}: ${concept.screen}. It works, but it is busy. Your job: design a BETTER version of the same screen. Cleaner, calmer, more intuitive and easier for ${audience} to use. Fewer controls visible at once, plain everyday words instead of jargon, one obvious primary action per area, clear grouping, progressive disclosure.

The idea for this version: ${concept.idea}

Keep the product's visual identity from the screenshots: ${spec.identity}. Keep the same real data you can read in the screenshots (names, titles, numbers). Anything new the idea needs stays short and plausible.

Do NOT produce: ${negatives.join(", ")}.

Requirements: landscape 1536x1024 PNG, opaque background, save exactly to ${out}
`;
  fs.writeFileSync(path.join(dir, "prompts", `${id}.txt`), prompt);
  fs.writeFileSync(path.join(dir, "prompts", `${id}.refs`), `${refs.join("\n")}\n`);
  written += 1;
  index.push(`${i + 1}. **${concept.name}** (${concept.screen}): ${concept.idea.replace(/[.\s]*$/, ".")}${concept.needs ? ` Needs: ${concept.needs}.` : ""} Output: \`${out}\``);
});

fs.writeFileSync(path.join(dir, "index.md"), `${index.join("\n")}\n`);
console.log(`Wrote ${written} of ${spec.concepts.length} prompt(s) to ${slash(path.join(dir, "prompts"))} and ${slash(path.join(dir, "index.md"))}`);
if (failed) process.exitCode = 1;
