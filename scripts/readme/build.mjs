import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const script of ["panels.mjs", "readme.mjs"]) {
  execFileSync(process.execPath, [path.join(here, script)], { stdio: "inherit" });
}
