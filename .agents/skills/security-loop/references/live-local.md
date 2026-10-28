# Live-local check

Part of Step 4 of the loop, and only when the user opted in with `live-local`. This part is ours; upstream has no counterpart.

Some candidates end Step 4 as `needs_validation` because the deciding fact is runtime behavior: what a page renders, whether a request is refused, what the app stores. Source reading and single-function harnesses cannot show it. This step runs the owner's app once on loopback with dummy data and checks those candidates through the app's normal interface. It is the owner-local tier from SKILL.md applied to the whole app, with the same limits: rule 6 holds in full, and nothing here reaches a deployed or shared system.

## When it runs

All of these must hold:

- the user asked for `live-local` in this run;
- the app's paths are owner-local as SKILL.md defines them;
- at least one candidate, usually a `needs_validation` record from Step 4, has a blocker that the running app could settle, and its class is one of injection, cross-site scripting, server-side request forgery, authentication, or authorization.

Skip the step when any of these holds. Every candidate then keeps its Step 4 verdict.

- The paths are source-only. Source-only code never runs under this step.
- The repository has no lockfile, so the exec tree has no dependencies (Layout in SKILL.md).
- The app needs a service that cannot run on loopback and has no local mock or stub: a managed database with no local equivalent, or a third-party identity provider with no stub, for example.
- There is no way to seed a datastore with dummy principals.
- The app does not answer on loopback within the start time limit.
- The user budget cannot cover the agents under Cost.

Record every skip and its reason for the report.

## Bringing the app up

The parent starts the app once per run, in the exec tree, before any agent launches. Checking agents never start, restart, or reconfigure it.

1. Create an agent root for the app, for example `<output>/agents/live-local-app/`, and use its `scratch/` as the home, temp, and data folder for every process below.
2. Pick free loopback ports for the app, its local datastore, and a callback listener. Bind every process to `127.0.0.1` or `localhost`, never to all interfaces.
3. Start each process from the empty-environment template in SKILL.md. Replace `timeout 120` with a start time limit: the server runs in the background, and the parent polls its loopback port until it answers or the limit passes (about 120 seconds). Use the repository's own start command and choose the one closest to a normal build that still runs on loopback.
4. Pass only named variables with dummy values: the ports, the datastore URL on loopback, dummy signing keys, and the local URLs of mocks. List each name and dummy value in `run-metadata.json`. Never copy the ambient environment or any `.env` file.
5. Point every outbound call to a real service (mail, payments, storage, identity, model providers) at a local mock or stub on loopback. Prefer the repository's own test mocks. A call that cannot be redirected is a skip condition for every candidate whose path reaches it.
6. Run a small listener on the callback port that logs every inbound request (method, path, headers, time) to the app root's scratch. It lets a check observe a server-side request made by the app without that request leaving the machine.
7. Seed the datastore with the repository's own seed or migration command, or a small fixture written into the app root's scratch. Seed at least two dummy accounts per role, so every cross-account and cross-role check has a separate actor and victim. Use obviously fake names, emails, and passwords.
8. Append each long-running process to `<output>/processes.log` with its pid, port, and full command. When the step ends, stop every listed process, confirm each pid is gone, and confirm each port is free.

No new installs. The exec tree's dependencies come only from the lockfile with install scripts disabled, as SKILL.md requires. Do not install Docker, Podman, a database server, or any other tool. A service the repository cannot run from its own installed dependencies is a skip condition.

Where a candidate reproduces only because of a development flag, a test-only route, or a mock authentication provider in this local start, Step 6 reachability applies: the result does not confirm the record.

## Mapping agent

One fresh agent maps the running app before any check. It reports what it sees; it tests nothing.

Codex: inspect the current tools and launch the mapping agent with the exposed multi-agent tools. `multi_agent = true` does not prove the tools are exposed. Fresh agents are the point of this step, so the parent checks for agent tools before bringing the app up: when no agent tools are exposed, the step is skipped and the report says so. The main thread never maps the app itself.

- It drives the app in headed Chrome through `launchPlacedChrome()` (`scripts/lib/launch-chrome.mjs`). Where the repository lacks it, it passes `--window-position=-2400,-2400`. It always passes `--mute-audio` and uses a fresh profile. The browser is never headless, because headless Chrome falls back to software rendering, and never minimized, because a minimized window throttles rendering to about one frame per second; either would make timing and rendering checks invalid.
- Codex runs do not inherit Claude Code's environment, so the parent sets `CHROME_PLACE=offscreen` for the browser process.
- It opens only loopback URLs. A Playwright route handler aborts every request to a host other than `127.0.0.1` or `localhost`, and the agent lists the aborted hosts in its result.
- It signs in as each dummy role in turn and lists the pages, forms, and HTTP requests it sees.
- It ties each page, form, and request to the source route or handler in the audit tree, by file and line.
- It writes the route map, the aborted hosts, and the roles it could and could not sign in as into its `result.json`, under the result contract in SKILL.md (Briefs).

Screenshots go where the user's instructions put them, else under `<output>/screenshots/`.

## Checking agents

One fresh agent per selected class that has candidates: injection, cross-site scripting, server-side request forgery, authentication, and authorization. Candidates in other classes keep their Step 4 verdict.

A checking agent's brief holds only: the candidates in its class with their linked units' checks and artifact paths, the route map, the dummy accounts it may use, the callback listener's port and log path, the rules from SKILL.md with the owner-local tier rules, the browser rules above, and the `confirmed`, `needs_validation`, and `rejected` branches of `scripts/report-schema.json` verbatim. Never another agent's conclusion.

Rule 3 holds: no checking agent hunted a candidate it checks or validated it in Step 4. The mapping agent checks nothing.

For each candidate, the agent:

1. reproduces the claimed path through the app's normal interface: a page, a form, or an HTTP request to the loopback app;
2. acts as one dummy account against another dummy account's data when the claim crosses accounts or roles, and never against its own data only;
3. stops at the smallest observed wrong result: one unauthorized dummy record read or changed, one rendered value that should have been escaped, one request logged by the callback listener;
4. records the exact request or browser action, the dummy account used, and what the app returned, rendered, or stored.

It never repeats a check to measure load and never sends traffic meant to slow or stop the app. If the app stops answering, the agent records that and stops; the parent decides whether to restart it.

Checking agents run in parallel against one app: spawn them concurrently with the exposed multi-agent tools and wait for every result. When no agent tools are exposed, the step is skipped and the report says so; the main thread never runs a check in an agent's place. Give each agent its own dummy accounts from the seed, or run the agents one after another when the seed has too few.

Evidence goes only to the agent's scratch, named as `agents/<agent id>/artifacts/<path>`. The parent promotes it with `promote-artifact.mjs` after the agent finishes, as for every other local check. A rejected file is not evidence. Each check is added to the candidate's linked units with the agent's own `agent_id` and `reviewed_paths`, `method: "local"`, and a `result` that starts with `[owner-local]`.

## Verdicts

Each checking agent writes one JSON object per candidate, in the Step 4 verifier form: `{"decision": "confirmed|needs_validation|rejected", "record": { ... }}`. The step adds no verdict, field, schema change, or validator change.

- **Demonstrated** through the app's interface: proposed `confirmed`. `execution` describes only the bounded local check performed: the attacker's dummy account, the minimal input in `payloads`, the steps in `instructions`, and in `observed_result` only what the app returned, rendered, stored, or sent.
- **Refuted by the running app**: proposed `rejected`, with the control that refused the request named in `reason` (a middleware, a template escape, an ownership check the source reading missed). A failed reproduction with no identified control is not a disproof; that candidate stays `needs_validation`.
- **Still blocked** by something loopback cannot show (a proxy rule, a provider policy, a deployment setting): stays `needs_validation`, with `blockers` narrowed to what remains and the local part of the plan removed when this step settled it.

Every proposed change is a material replacement under verification.md Step 6. Each goes to a fresh verifier that did not hunt, validate, or check that candidate, before the record enters `findings.json`. Without budget for that verifier, the candidate keeps its Step 4 verdict and the report says so. The same holds when no agent tools are exposed: the re-verification is skipped, the candidate keeps its Step 4 verdict, and the report says so; it is never done in the main thread.

## Cost

One mapping agent, up to one checking agent per selected class that has candidates, and one fresh re-verifier per proposed change. They count against a user budget like any other agents. Reserve them before launching; when the budget cannot cover them, skip the step and say so in the report.

## Report

`REPORT.md` item 1 gains one line: live-local ran, was skipped (with the reason), or was not requested; and, when it ran, how many records it moved to `confirmed`, to `rejected`, and kept as `needs_validation`.
