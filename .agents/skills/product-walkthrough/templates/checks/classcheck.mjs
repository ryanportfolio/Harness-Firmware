// Lists classes the scenes use that have no rule in the product CSS (or in the scenes'
// own <style> blocks). A missing class means the replica renders differently from the
// product: the CSS chunk was not copied, the class was invented, or the product itself
// uses a class its build purged (report that one to the owner as a product bug).
//
// node checks/classcheck.mjs --css app.css [--css chunk-settings.css] [--ignore group,peer,wtx-] scenes [scenes/ch2.js ...]
//
// Arguments are scene files or folders of them. --ignore takes class prefixes that are
// hooks or markers with no rule by design (Tailwind's group and peer, the scene's own ids).
// Exit code 1 when anything is missing.
import fs from "node:fs";
import path from "node:path";
import { parseArgs, need } from "./lib/browser.mjs";

const args = parseArgs();
const cssFiles = [].concat(need(args, "css", "product stylesheet"));
const ignore = ["group", "peer", ...String(args.ignore || "").split(",").filter(Boolean)];
const files = [];
for (const a of args._.length ? args._ : ["scenes"]) {
  const st = fs.statSync(a);
  if (st.isDirectory()) for (const f of fs.readdirSync(a)) { if (f.endsWith(".js")) files.push(path.join(a, f)); }
  else files.push(a);
}
const sources = files.map((f) => [f, fs.readFileSync(f, "utf8")]);
// Scene sources join the haystack so classes defined in a scene's own <style> count.
const haystack = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n") + "\n" + sources.map(([, s]) => s).join("\n");
const esc = (c) => c.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (c) => new RegExp(reEsc("." + esc(c)) + "(?![a-zA-Z0-9_-]|\\\\)").test(haystack);

let total = 0;
for (const [file, raw] of sources) {
  // Blank out simple ${...} expressions (no nested template) so quotes inside them
  // cannot end a class="..." early; nested templates stay and get scanned themselves.
  const src = raw.replace(/\$\{[^{}`]*\}/g, " ");
  const used = new Set();
  const add = (s) => s.replace(/\$\{[^}]*\}/g, " ").split(/\s+/).forEach((c) => c && used.add(c));
  for (const m of src.matchAll(/class="([^"]*)"/g)) add(m[1]);
  for (const m of src.matchAll(/class='([^']*)'/g)) add(m[1]);
  for (const m of src.matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g)) for (const s of m[1].matchAll(/["'`]([^"'`]+)["'`]/g)) add(s[1]);
  const missing = [...used].filter((c) => !ignore.some((p) => c === p || c.startsWith(p + "/") || (p.endsWith("-") && c.startsWith(p))) && !has(c)).sort();
  total += missing.length;
  console.log(`${file}: ${missing.length ? `${missing.length} without a rule\n  ${missing.join("\n  ")}` : "all classes found"}`);
}
process.exitCode = total ? 1 : 0;
