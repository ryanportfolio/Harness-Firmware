import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ACTIONS, NOTICE, detect, render } from "./write-ci-workflow.mjs";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "write-ci-workflow.mjs");

function project(t, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ci-workflow-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  }
  return root;
}

const yamlFor = (root) => render(detect(root));
const cli = (root, ...args) => spawnSync(process.execPath, [script, "--root", root, ...args], { encoding: "utf8" });
const ciPath = (root) => path.join(root, ".github", "workflows", "ci.yml");

// A Python with PyYAML, when this machine has one. CI runners and most dev boxes do.
const python = ["python3", "python", "py"].find((exe) => spawnSync(exe, ["-c", "import yaml"], { encoding: "utf8" }).status === 0);
function parseYaml(text) {
  const r = spawnSync(python, ["-c", "import json, sys, yaml; print(json.dumps(yaml.safe_load(sys.stdin.read())))"], { input: text, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test("npm: lockfile picks npm ci and only existing scripts become steps", (t) => {
  const root = project(t, {
    "package.json": { scripts: { test: "vitest run", build: "vite build", lint: "eslint ." } },
    "package-lock.json": "{}",
    ".nvmrc": "22\n",
  });
  const y = yamlFor(root);
  assert.match(y, /node-version-file: \.nvmrc/);
  assert.match(y, /cache: npm/);
  assert.match(y, /run: npm ci\n/);
  assert.match(y, /- name: Test\n {8}run: npm run test\n/);
  assert.match(y, /- name: Build\n {8}run: npm run build\n/);
  assert.doesNotMatch(y, /lint|Typecheck/);
});

test("node: package manager follows the lockfile", (t) => {
  const pkg = { scripts: { build: "tsc" } };
  const cases = [
    [{ "pnpm-lock.yaml": "" }, ["pnpm/action-setup@", "version: latest", "cache: pnpm", "run: pnpm install --frozen-lockfile", "run: pnpm run build"]],
    [{ "pnpm-lock.yaml": "", "package.json": { ...pkg, packageManager: "pnpm@10.4.0" } }, ["pnpm/action-setup@", "run: pnpm run build"]],
    [{ "yarn.lock": "" }, ["cache: yarn", "run: yarn install --frozen-lockfile", "run: yarn run build"]],
    [{ "yarn.lock": "", ".yarnrc.yml": "" }, ["corepack enable", "run: yarn install --immutable"]],
    [{ "bun.lock": "" }, [ACTIONS.setupBun, "run: bun install --frozen-lockfile", "run: bun run build"]],
    [{ "bun.lockb": "" }, [ACTIONS.setupBun]],
    [{}, ["node-version: 'lts/*'", "run: npm install\n"]],
  ];
  for (const [extra, expected] of cases) {
    const y = yamlFor(project(t, { "package.json": pkg, ...extra }));
    for (const e of expected) assert.ok(y.includes(e), `${JSON.stringify(extra)} missing ${e}\n${y}`);
  }
  const managed = yamlFor(project(t, { "package.json": { ...pkg, packageManager: "pnpm@10.4.0" }, "pnpm-lock.yaml": "" }));
  assert.doesNotMatch(managed, /version: latest/);
  assert.doesNotMatch(yamlFor(project(t, { "package.json": pkg, "bun.lock": "" })), /setup-node/);
  assert.doesNotMatch(yamlFor(project(t, { "package.json": pkg, "yarn.lock": "", ".yarnrc.yml": "" })), /cache: yarn/);
  assert.match(yamlFor(project(t, { "package.json": { ...pkg, engines: { node: ">=20" } } })), /node-version-file: package\.json/);
});

test("npm default test placeholder is not a test step", (t) => {
  const root = project(t, {
    "package.json": { scripts: { test: 'echo "Error: no test specified" && exit 1' } },
    "package-lock.json": "{}",
  });
  const y = yamlFor(root);
  assert.doesNotMatch(y, /npm run test/);
  assert.ok(y.includes(NOTICE), "no runnable command falls back to the notice");
});

test("TypeScript without a typecheck script runs tsc --noEmit", (t) => {
  const files = { "package.json": { devDependencies: { typescript: "^5" }, scripts: { build: "vite build" } }, "tsconfig.json": "{}" };
  assert.match(yamlFor(project(t, { ...files, "package-lock.json": "{}" })), /- name: Typecheck\n {8}run: npx tsc --noEmit\n/);
  assert.match(yamlFor(project(t, { ...files, "pnpm-lock.yaml": "" })), /run: pnpm exec tsc --noEmit/);
  // A typecheck script wins over the fallback.
  const scripted = yamlFor(project(t, { ...files, "package.json": { ...files["package.json"], scripts: { "type-check": "tsc -b" } } }));
  assert.match(scripted, /run: npm run type-check/);
  assert.doesNotMatch(scripted, /npx tsc/);
  // tsconfig.json without typescript as a dependency: no typecheck.
  assert.doesNotMatch(yamlFor(project(t, { "package.json": { scripts: { build: "x" } }, "tsconfig.json": "{}" })), /Typecheck/);
});

test("Python with uv uses setup-uv and uv run", (t) => {
  const root = project(t, {
    "pyproject.toml": '[project]\nname = "x"\nrequires-python = ">=3.11"\ndependencies = []\n\n[dependency-groups]\ndev = ["pytest>=8"]\n\n[tool.mypy]\nstrict = true\n',
    "uv.lock": "",
    "tests/test_a.py": "def test_a():\n    assert True\n",
  });
  const y = yamlFor(root);
  assert.ok(y.includes(`uses: ${ACTIONS.setupUv}`));
  assert.doesNotMatch(y, /setup-python/);
  assert.match(y, /run: uv sync --locked\n/);
  assert.match(y, /- name: Typecheck\n {8}run: uv run --with mypy mypy \.\n/);
  assert.match(y, /- name: Test\n {8}run: uv run pytest\n/);
});

test("Python with pip installs requirements, the package and pytest", (t) => {
  const root = project(t, {
    "requirements.txt": "requests\n",
    "requirements-dev.txt": "black\n",
    "requirements-docs.txt": "sphinx\n",
    "pyproject.toml": '[project]\nname = "x"\n\n[project.optional-dependencies]\ntest = ["coverage"]\n\n[tool.pytest.ini_options]\naddopts = "-q"\n',
    ".python-version": "3.10\n",
    "pkg/test_mod.py": "def test_x():\n    pass\n",
  });
  const y = yamlFor(root);
  assert.match(y, /python-version-file: \.python-version/);
  assert.match(y, /run: \|\n {10}python -m pip install --upgrade pip\n {10}pip install -r requirements\.txt\n/);
  assert.match(y, / {10}pip install -r requirements-dev\.txt\n/);
  assert.doesNotMatch(y, /requirements-docs/);
  assert.ok(y.includes(`          pip install -e ".[test]"\n`));
  assert.match(y, / {10}pip install pytest\n/, "pytest config alone does not declare pytest");
  assert.match(y, /- name: Test\n {8}run: python -m pytest\n/);
  assert.doesNotMatch(y, /Typecheck/);

  const typed = yamlFor(project(t, { "requirements.txt": "pytest\nmypy\n", "mypy.ini": "[mypy]\n", "test_a.py": "" }));
  assert.match(typed, /python-version: 3\.x/);
  assert.doesNotMatch(typed, /pip install pytest|pip install mypy/);
  assert.match(typed, /run: mypy \.\n/);

  // pip install -e . skips dependency groups, so pytest declared only there is still installed.
  const grouped = yamlFor(project(t, { "pyproject.toml": '[project]\nname = "x"\n\n[dependency-groups]\ndev = ["pytest"]\n', "tests/test_a.py": "" }));
  assert.match(grouped, / {10}pip install -e \.\n {10}pip install pytest\n/);

  // Dependencies but no tests and no typechecker: nothing to run, so the notice.
  assert.ok(yamlFor(project(t, { "requirements.txt": "flask\n" })).includes(NOTICE));
});

test("Rust builds locked when Cargo.lock exists and tests", (t) => {
  const locked = yamlFor(project(t, { "Cargo.toml": "[package]\nname = \"x\"\n", "Cargo.lock": "" }));
  assert.match(locked, /run: cargo build --locked\n/);
  assert.match(locked, /run: cargo test\n/);
  assert.match(yamlFor(project(t, { "Cargo.toml": "" })), /run: cargo build\n/);
});

test("Go vets, builds and tests with the go.mod version", (t) => {
  const y = yamlFor(project(t, { "go.mod": "module example.com/x\n\ngo 1.23\n" }));
  assert.ok(y.includes(`uses: ${ACTIONS.setupGo}`));
  assert.match(y, /go-version-file: go\.mod/);
  for (const c of ["go vet ./...", "go build ./...", "go test ./..."]) assert.ok(y.includes(`run: ${c}\n`), c);
});

test("nothing detected: a notice and the firmware job, no fake test", (t) => {
  const root = project(t, { "README.md": "# x\n", ".claude/scripts/sync-codex-skills.mjs": "" });
  const y = yamlFor(root);
  assert.ok(y.includes(`::notice title=No CI commands detected::${NOTICE}`));
  assert.match(y, /run: node \.claude\/scripts\/sync-codex-skills\.mjs --check\n/);
  assert.doesNotMatch(y, /npm|pytest|cargo|go test/);
  assert.doesNotMatch(yamlFor(project(t, { "README.md": "" })), /firmware:/, "no firmware job without the script");
});

test("one job per detected stack, plus shared workflow settings", (t) => {
  const root = project(t, {
    "package.json": { scripts: { build: "x" } },
    "go.mod": "module x\n\ngo 1.22\n",
    "Cargo.toml": "",
    ".claude/scripts/sync-codex-skills.mjs": "",
  });
  const y = yamlFor(root);
  for (const j of ["node", "go", "rust", "firmware"]) assert.match(y, new RegExp(`^  ${j}:$`, "m"));
  assert.match(y, /^# Generated by \/init-project \(\.claude\/scripts\/write-ci-workflow\.mjs\)\. Safe to edit/);
  assert.match(y, /^ {4}branches: \[main\]$/m);
  assert.match(y, /^ {2}pull_request:$/m);
  assert.match(y, /^ {2}cancel-in-progress: true$/m);
  assert.match(y, /^permissions:\n {2}contents: read$/m);
  assert.doesNotMatch(y, /\r/);
});

test("generated YAML parses", { skip: python ? false : "no Python with PyYAML on this machine" }, (t) => {
  const fixtures = [
    { "package.json": { devDependencies: { typescript: "5" }, scripts: { test: "x" } }, "tsconfig.json": "{}", "yarn.lock": "", ".yarnrc.yml": "" },
    { "pyproject.toml": '[project]\nname = "x"\n[project.optional-dependencies]\ndev = ["pytest"]\n', "tests/test_a.py": "" },
    { "go.mod": "go 1.22\n", "Cargo.toml": "", ".claude/scripts/sync-codex-skills.mjs": "" },
    { ".claude/scripts/sync-codex-skills.mjs": "" },
  ];
  for (const files of fixtures) {
    const doc = parseYaml(yamlFor(project(t, files)));
    assert.equal(doc.name, "CI");
    assert.deepEqual(doc.permissions, { contents: "read" });
    // PyYAML follows YAML 1.1, where a bare `on` key loads as true. GitHub reads it as "on".
    assert.deepEqual((doc.on ?? doc.true).push.branches, ["main"]);
    for (const [id, job] of Object.entries(doc.jobs)) {
      assert.equal(job["runs-on"], "ubuntu-latest", id);
      assert.ok(job.steps.length > 0, id);
      for (const s of job.steps) assert.ok(typeof (s.run ?? s.uses) === "string", `${id}: ${JSON.stringify(s)}`);
    }
  }
});

test("print mode writes nothing", (t) => {
  const root = project(t, { "go.mod": "go 1.22\n" });
  const r = cli(root);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /Detected:\n- go \(Go 1\.22 from go\.mod\)/);
  assert.equal(r.stdout, yamlFor(root), "stdout is the workflow alone, so it can be redirected and diffed");
  assert.equal(fs.existsSync(path.join(root, ".github")), false);
});

test("--write creates ci.yml and refuses to overwrite without --force", (t) => {
  const root = project(t, { "go.mod": "go 1.22\n" });
  let r = cli(root, "--write");
  assert.equal(r.status, 0, r.stderr);
  const written = fs.readFileSync(ciPath(root), "utf8");
  assert.equal(written, yamlFor(root));

  fs.writeFileSync(ciPath(root), "# hand edited\n");
  r = cli(root, "--write");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /already exists; not overwriting.*--force/s);
  assert.equal(fs.readFileSync(ciPath(root), "utf8"), "# hand edited\n");

  r = cli(root, "--write", "--force");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(ciPath(root), "utf8"), written);

  r = cli(root, "--force");
  assert.notEqual(r.status, 0, "--force without --write is an error");
});
