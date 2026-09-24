// Reports whether the committed README and its SVG panels match a fresh build.
//
// Drift is a warning, never a failure: a project that adds, removes, or hand-edits skills or
// README text keeps a green build. The warning names each stale file and the fix command.
// The build runs in a scratch directory, so this check never changes the committed files.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectFacts } from "./facts.mjs";
import { absolute } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const names = ["boot", "feedback", "runtime", "skills"];
const variants = ["light", "dark", "narrow-light", "narrow-dark"];
const generated = ["README.md", ...names.flatMap((name) => variants.map((variant) => `assets/readme/${name}-${variant}.svg`))];
const fix = "run node scripts/readme/build.mjs to rebuild the README";
const prefix = process.env.GITHUB_ACTIONS === "true" ? "::warning::" : "WARN: ";
const warn = (message) => process.stdout.write(`${prefix}${message}\n`);

const out = fs.mkdtempSync(path.join(os.tmpdir(), "readme-verify-"));
try {
  const facts = collectFacts();
  for (const warning of facts.warnings) warn(warning);
  const build = spawnSync(process.execPath, [path.join(here, "build.mjs")], { env: { ...process.env, README_OUT_DIR: out }, encoding: "utf8" });
  if (build.status !== 0) throw new Error(`build.mjs failed: ${(build.stderr || build.stdout).trim()}`);
  const normalize = (bytes) => bytes.toString("utf8").replaceAll("\r\n", "\n");
  const stale = generated.filter((relativePath) => {
    if (!fs.existsSync(absolute(relativePath))) return true;
    return normalize(fs.readFileSync(absolute(relativePath))) !== normalize(fs.readFileSync(path.join(out, relativePath)));
  });
  if (stale.length) {
    for (const relativePath of stale) warn(`${relativePath} is stale; ${fix}`);
  } else {
    process.stdout.write("README artifacts are current.\n");
  }
} catch (error) {
  warn(`README artifacts were not checked: ${error.message.split("\n")[0]}; ${fix}`);
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}
