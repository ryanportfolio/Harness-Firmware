# Project memo

Six questions settle what the project is before config gets written. Repo answers first, user second.

1. What is it?
2. Who is it for?
3. What is it not?
4. What does done look like?
5. What's the smallest version that proves it?
6. What features does the user want in it?

## Answer from the repo first

Read-only sources: README, manifest `description`, `docs/`, a filled `What this project is` section, routes, commands, entry points, open issues when `gh` reaches them. Draft one answer per question, with its source.

- Section already filled and still matching the code → reuse it; ask nothing it answers. Never rewrite a filled section unless the user asked for that.
- Existing code usually answers 1, 2 and the built part of 6. 3, 4 and 5 are intent and seldom in code → ask, unless a doc states them.
- Empty or new repo → ask all six.

Never invent an answer. An answer inferred from code is a draft: show it to the user marked as inferred, and write it only after they confirm or correct it.

## Ask once

One round: inferred drafts to confirm + open questions, together with the other setup questions (profile, prose mode, deploy). Use the six questions as worded above. One line per answer is enough.

Push back once, only where an answer can't steer work:

- 2 names a crowd ("everyone", "developers") → ask for one real person or one specific role who would use it first. Write the role into files, never the person's name, unless the user asks for the name to be written.
- 3 empty or "nothing" → offer 2-3 likely non-goals drawn from answers 1 and 2 (no accounts, no mobile app, single user) to accept or strike. Include parts an existing service or library should cover in place of new code (payments, sign-in, email).
- 4 not checkable ("works well") → ask for the few things it must do every time, each something the user could open, click or run to check.
- 5 as big as 6 → ask which one feature proves the idea can work if the rest never ships. Smallest version answers "can this be done?", not "is this ready for users?".

The brief needs two choices the six answers may not give: feature priority order, and which done checks and features belong in the smallest version. Not given → ask in the same round. Still not given → write them as unknown in the brief; never guess an order or an assignment.

User skips a question → leave it unknown, list it in the report, continue setup. A skipped question never blocks the other setup steps.

## Where answers go

| Question | Lands in |
|---|---|
| 1 what, 2 who, 3 not, 4 done | `CLAUDE.md` → `What this project is`, replacing its FILL IN marker |
| 5 smallest version, 6 wanted features | `docs/specs/YYYY-MM-DD-project-brief.md` |

`What this project is` loads every turn and Codex reads it too. Cap ~10 lines, normal prose:

```markdown
<What it is and who it is for, in one or two sentences.>

- Not: <what it will not do or become>
- Done: <the result someone can check>
- Won't compromise on: <short list, only when the user named some>
- First build: `docs/specs/<date>-project-brief.md`
```

- Unanswered line → omit it and report it. No answers to 1 and 2 → keep the FILL IN marker; `doctor.mjs` keeps warning until it is filled.
- Glossary of team terms: optional, only when the user gave one and the cap still holds.

Brief: normal prose, the user's own words. Three parts:

1. Smallest version: what it contains and the one claim it proves.
2. Done checks: answer 4 split into rows, one checkable behavior per row, each marked required for the smallest version, later, or unknown. Usually 5-10 rows; fewer is fine. Never pad the table with rows the user didn't give.
3. Wanted features in the user's priority order (order unknown → say so and keep the order given), one line each, each marked in, out, or unknown for the smallest version. Parts the user chose to cover with an existing service or library are listed as such, with the service when named.

Don't repeat non-goals; don't add features the user didn't name. The first build session turns each done-check row into a test or check before calling that version done.

- Brief feeds the first build session (`brainstorming`, `writing-plans`). Setup writes it and stops: answering the memo does not authorize building anything.
- Smallest version already shipped and no unbuilt features wanted → no brief, no `First build` line.
- Built features belong in `.claude/reference/features.md` (`user-walk` owns it). Never put planned features there.
- `First build` line goes once that version ships.
