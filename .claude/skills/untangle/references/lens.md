# Lens: what counts as a problem

One question for any two pieces: should these change together? Three wrong answers + special cases. Each problem needs the listed evidence; without it, drop.

## Hidden links: must change together, code doesn't show it

| Shape | Evidence |
|---|---|
| Copied logic or values (constants, validation rules, formulas) | every copy's `path:line`; at least one copy already drifted, or co-change pair |
| Module reads global, env, file or shared state another module sets | writer + reader `path:line`; no import or parameter connects them |
| One feature split across folders by layer | co-change pairs with `crossDir: true` and high `share`; same feature name in each folder |
| Call order or convention callers must know (init before use, `close()` after every write) | callers that follow it + at least one that doesn't, or a bug fix commit that added it |
| Parallel lists that must match (route table + nav menu + sitemap, enum + switch per value) | every list `path:line`; an entry present in one, missing in another |

## Needless links: tied together, change for different reasons

| Shape | Evidence |
|---|---|
| Callers reach into internals (private fields, inner structure, file layout of another module) | caller `path:line` + internal it touches; a commit where an internal change forced a caller change |
| Stable code imports more volatile code | import edge; `fileChanges` counts from `co-change.json` showing the imported side changes far more |
| General function with a parameter or branch only one caller understands | parameter `path:line` + the one caller |
| Shallow module: interface as complex as its body, changes whenever internals do | interface vs body size; co-change between module and its callers |

## Surplus: no reason of its own to change

| Shape | Evidence |
|---|---|
| Pass-through wrapper | wrapper body forwards unchanged; caller list |
| Extension point, option or config that never varies | every call site passes the same value, or one implementation only |
| Dead code | no reference (grep across repo incl. dynamic lookups, routes, config, tests); not an entry point |
| Comment restating what the next line does, or narrating history ("fixed in round 3") | comment `path:line`. Keep why-comments, comments naming an outside fact the code can't show, and TODOs naming a known gap |
| Test that can't fail (passes if code returns nothing) or tests internals instead of behavior | test `path:line` + what it asserts |

## Special cases: design signals

Code existing for one situation instead of following from how the system works:

- `if` on one id, name, value or env
- parameter added for one caller
- swallowed exception (empty or log-only catch)
- retry, sleep or timeout outside timing code
- skipped or disabled test
- flag set by one module to stop another's behavior

List each with `path:line` + the situation it handles (from code or `git log -L`/blame). Not a fix target one by one: redesign uses them to find what the system actually needs. Rule 4 in SKILL.md: a special case that guards data, security, accessibility or a needed fallback stays (fix may move it).

## Not problems

Style, naming taste, formatting, file length alone, missing patterns or best practices with no change they make harder, duplication whose copies change for different reasons (keep it), vendored and generated code (read for links only).
