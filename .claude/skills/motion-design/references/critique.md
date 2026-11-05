# Critique questions

A fixed set of viewer questions for judging a finished piece, chosen by what kind of piece it is. Use them as the judged checks of a `wow-loop` contract, or as the checklist for a review by hand. They ask what the viewer gets; craft rules (easing, flash, timing numbers) stay in the other references.

## Pick the type

Record one line in `BRIEF.md`: `Type: pitch`, or two types joined with `+` (`Type: pitch + explainer`). Two types get the union of their questions, each asked once. Pick by what the viewer should do when it ends:

| Type | The viewer ends up | Examples |
|---|---|---|
| pitch | wanting to act: visit, buy, install, play | promo, launch film, game trailer |
| explainer | knowing how something works or what it does | feature demo, product walkthrough |
| story | feeling something about a case or a person | case study, narrative film |
| game | having played: their input drives the picture | playable demo, interactive scene |
| tool | getting a task done on a screen that moves | UI motion, a hero animation on a working page |

A game trailer is a pitch: the viewer watches it. Use `game` only when the viewer has input.

## Questions every piece gets

- `point`: Watched once, does the piece leave a single belief the viewer could repeat in plain words?
- `pace`: Is each shot or hold as long as its content needs and no longer, with changes timed to a word, a beat or an action?
- `read`: Can every word that matters be read at the size it ships, against what sits behind it, before it leaves?
- `own`: Hide the name and logo: is it still clearly about this subject, and not any product of its kind?
- `sound` (only when the piece has audio): Can the voice be heard over everything, with music and effects saved for moments that matter? With no voice: do music and effects drive the cut on the beat and stay clean?

## Questions by type

The decisive question is marked. A failure on it always fails the piece.

| Type | Adds |
|---|---|
| pitch | `open` (decisive), `shown`, `land` |
| explainer | `loop` (decisive), `open`, `shown`, `land` |
| story | `pull` (decisive), `open`, `land` |
| game | `feel` (decisive), `again` |
| tool | `task` (decisive) |

- `open`: Would the first 2 s stop this audience mid-scroll, and do they pose a question the piece goes on to answer?
- `shown`: Each time a caption or the voice makes a claim, is the real thing doing it on screen at that moment?
- `land`: Does the last beat hand this audience a next step, a payoff, or a callback to the opening?
- `loop`: Is it one project or task carried start to finish, each step causing the next, with no detour into a feature list?
- `pull`: Does every scene close on an open question that makes the next scene wanted?
- `feel`: Does the picture answer each input immediately and visibly enough for the player to tell what they did?
- `again`: When the player fails, can they see why, and retry with one action?
- `task`: Can someone do what the screen is for without hunting for where to look?

## Turning them into contract checks

- One judged, gating check per question: `q-open`, `q-point`. Write its pass condition for this piece, naming the audience from `BRIEF.md` ("a developer who has never heard of the product").
- Every answer cites evidence: the timestamp and what the viewer sees and hears there. A verdict with no timestamp is not evidence; rerun that critic.
- Severity uses wow-loop's anchors. A failed decisive question, or a failed `point`, is a blocker. Otherwise ask: would this audience stop watching or stop believing at that moment? Yes → major. It only costs attention (a slow patch, a generic part) → minor.
- `point` is answered blind: the critic writes the one sentence before reading `BRIEF.md`; the orchestrator compares it with the brief's feeling-and-job line. A different belief fails the check. In wow-animation this check is the stranger test.
- `open` on a vertical or feed piece is judged twice, with sound and muted, at phone size. Feeds autoplay muted.
- `own`: the critic watches with the subject's name and logo covered and names what else the piece could be for. A plausible rival or a whole category fails it.
- `read` timing is scripted, not judged: add a `check.sh` step that walks the engine's caption records (`a` and `b` are start and end seconds, see [web-engine.md](web-engine.md)) and fails any caption whose `b - a` is under 0.25 s per word of its text plus 1 s, or under 20 frames (the rule in [story.md](story.md)). Critics then judge only size and contrast. A piece not built on that engine has no caption records: critics judge timing too.

## Protect the strongest moment

Each critic also names the piece's strongest moment: its timestamp and why it works. The orchestrator records the one most critics name in wow-loop's state. Every repair brief lists it as off-limits unless a gating check fails inside it. From the next round, critics confirm it still holds after their own assessment; a strongest moment that got weaker is a major regression finding. Repairs that improve weak parts often flatten the best one, and no other check notices.

## Source

The idea of viewer questions chosen by piece type, with one decisive question per type, comes from raea's critique rubric (`sdk/guides/craft/rubric.md` in shinyobjectz/raea, reviewed 2026-11-05), which follows the method of pbakaus/impeccable. The questions here are reworded for our pipeline; no text was copied. The blind `point` answer, the muted `open`, the scripted reading time and the protected strongest moment are ours.
