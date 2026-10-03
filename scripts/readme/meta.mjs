// The repository's About panel (description, website, topics), kept in repo.json.
//   --lint   validate repo.json offline (pull requests)
//   --check  compare repo.json with the live repository, exit 1 on drift (default branch)
//   --apply  push repo.json to GitHub through gh api
import { execFileSync } from "node:child_process";
import { readJson } from "./lib.mjs";

const meta = readJson("scripts/readme/repo.json");
const mode = process.argv[2];

function lint() {
  const errors = [];
  if (!/^[\w.-]+\/[\w.-]+$/.test(meta.repo ?? "")) errors.push("repo must be owner/name");
  if (!meta.description || meta.description.length > 350) errors.push("description must be 1-350 characters");
  if (meta.homepage && !/^https:\/\/\S+$/.test(meta.homepage)) errors.push("homepage must be an https URL or empty");
  if (!Array.isArray(meta.topics) || meta.topics.length > 20) errors.push("topics must be an array of at most 20");
  for (const topic of meta.topics ?? []) {
    if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(topic)) errors.push(`invalid topic: ${topic}`);
  }
  if (errors.length) {
    for (const error of errors) console.error(`repo.json: ${error}`);
    process.exit(1);
  }
}

function gh(args, input) {
  return execFileSync("gh", args, { encoding: "utf8", input });
}

lint();
if (mode === "--lint") {
  console.log("repo.json is valid.");
} else if (mode === "--apply") {
  gh(["api", "-X", "PATCH", `repos/${meta.repo}`, "-f", `description=${meta.description}`, "-f", `homepage=${meta.homepage}`]);
  gh(["api", "-X", "PUT", `repos/${meta.repo}/topics`, "--input", "-"], JSON.stringify({ names: meta.topics }));
  console.log(`Applied repo.json to ${meta.repo}.`);
} else if (mode === "--check") {
  const live = JSON.parse(gh(["api", `repos/${meta.repo}`]));
  const drift = [];
  if (live.description !== meta.description) drift.push(`description: ${live.description}`);
  if ((live.homepage ?? "") !== meta.homepage) drift.push(`homepage: ${live.homepage}`);
  if ([...live.topics].sort().join() !== [...meta.topics].sort().join()) drift.push(`topics: ${live.topics.join(", ")}`);
  if (drift.length) {
    for (const line of drift) console.error(`Live ${line} differs from repo.json. Run node scripts/readme/meta.mjs --apply.`);
    process.exit(1);
  }
  console.log("Live repository metadata matches repo.json.");
} else {
  console.error("usage: node scripts/readme/meta.mjs --lint | --check | --apply");
  process.exit(2);
}
