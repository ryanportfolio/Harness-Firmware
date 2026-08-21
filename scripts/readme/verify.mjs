import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { absolute } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const names = ["boot", "feedback", "runtime", "skills"];
const variants = ["light", "dark", "narrow-light", "narrow-dark"];
const generated = ["README.md", ...names.flatMap((name) => variants.map((variant) => `assets/readme/${name}-${variant}.svg`))];
const before = new Map(generated.map((relativePath) => [relativePath, fs.existsSync(absolute(relativePath)) ? fs.readFileSync(absolute(relativePath)) : null]));

execFileSync(process.execPath, [path.join(here, "build.mjs")], { stdio: "ignore" });

const changed = generated.filter((relativePath) => {
  const prior = before.get(relativePath);
  const current = fs.readFileSync(absolute(relativePath));
  return prior === null || !prior.equals(current);
});

if (changed.length) {
  for (const relativePath of changed) process.stderr.write(`STALE: ${relativePath}\n`);
  process.exit(1);
}

process.stdout.write("README artifacts are current.\n");
