---
name: writing
description: "Use for user-facing deliverables: website copy, product UI, onboarding, docs, emails, READMEs, captions, and release notes. Ordinary session replies use Caveman with built-in Unslop."
---

# Writing

Editorial rules distilled from a real editor's rulings. Every rule below exists because a shipped draft failed without it. The bar: a smart reader outside the domain gets it on first read, and nothing reads as AI-made.

Use this skill for user-facing deliverables, including text embedded in code or produced inside a chat answer for later publication. Keep the deliverable in its intended audience’s voice. Ordinary conversation, progress updates and explanations to the session user follow Caveman with built-in Unslop; do not apply this editorial workflow to them.

Applies to prose only. Code, API names, error strings, quoted artifacts, and attributed quotes are never reworded.

## Project voice

Before drafting for a repo, check for `.claude/reference/voice.md` (or whatever file that repo's CLAUDE.md indexes as its voice/style reference). If present, it records the owner's deliberate voice for that repo's copy: apply it on top of these rules and let it win where they conflict. These editorial rules are the floor; a project voice file is the owner overriding them on purpose. Explicit user choices and project voice take precedence over general editorial defaults.

## Before drafting

Settle these silently first, do not narrate them: who reads this; what they should understand, decide, or do; what the prompt is really asking (a question about a challenge may want judgment or fit, not the chronology); the hard constraints (length, format, required points); and which facts or examples carry the answer. Lead with that best material.

## Hard bans

- **Em dashes (U+2014), anywhere.** No en-dash or double-hyphen stand-ins. Use a period, comma, colon, or parentheses; a middle dot (U+00B7) for label-style separators. Reads as an AI tell.
- **Trailing periods on headings** (h1-h6, section titles, kickers, figure titles). Periods never appear in large display text at all.
- **Negation pivots, every disguise.** "Not just X, it's Y", "The point isn't X. It's Y", "This isn't about A; it's about B", "less about X than Y". Splitting across sentences doesn't cure it. Delete the denial half, open with the point. A negation survives only when it corrects a real misconception the reader holds, after the positive claim.
- **Negative-definition headings** ("Synthesis, not summary"). Say what it is.
- **Death metaphors** ("die", "dies", "killed") for removal or cuts. Say the specific verb: words are cut, a model is retired, a project is cancelled, a file is gone.
- **Invented coinages and insider jargon.** "Deliberation dial", "colophon", "the harness". Test: would a smart reader outside the domain have to ask? Replace with the plain phrase ("how hard the model thinks"). A term of art genuinely owned by the reader is fine, glossed at first use.
- **"Why this matters" sections or labels.** Stakes live inside the prose (the afternoon lost, the tokens burned), never under a label.
- **AI tells:** delve, robust, seamless, crucial, pivotal, testament, showcase, foster, leverage, utilize, vibrant, tapestry, landscape (abstract); "serves as" / "stands as" copula dodges; rule-of-three lists; "from X to Y" fake ranges; Title Case Headings; trailing summaries; "experts say" vague attribution; sycophantic openers and "hope this helps" closers.

## Rules

- **Lead with the point.** If a paragraph's payoff sentence could open it, move it up and cut the wind-up. Answer early; background only when truly needed.
- **Titles are plain and specific.** A reader who has not opened the piece can say what it is about from the title alone. Evocative only on top of specific ("Thinking on a budget" works; "The firmament moved" decodes to nothing). Descriptions are concrete promises, not atmosphere.
- **Plain words beat fancy ones.** Latinate dress-ups (prohibition, subsequent, corroborated, verbatim, ancillary, facilitate, commence, myriad) lose to the everyday phrase. Precision beats plainness only when they genuinely conflict; never swap an accurate technical name for a vaguer word.
- **No walls of text.** Paragraphs run 1-4 sentences; past ~60 words a paragraph needs a reason. Break at each new idea; let lists and white space carry structure.
- **State the rule, skip the flourish.** Cut aphorism capstones ("The cheapest token is the one never written"), dramatic justifications of self-evident rules, praise of the writing's own advice, and coined names nobody needs. Rules read as flat plain declaratives.
- **Don't tour the mechanism.** When a thing has levels or stages, say it has them and what the end state buys; walk the stops only when the reader must choose one. One example per claim, and only if the claim is unclear without it.
- **Stranger test.** Read each sentence as someone with zero domain context. Words with a domain and an everyday meaning ("fine", "weight", "bleed") default to the everyday one in the stranger's head. Fix by describing the observable thing, then stating what it means: "Thicker lines mean more models agreed" beats "Line weight marks agreement". Don't add a legend to rescue a term; replace the term with what the reader sees.
- **Name the thing before any framing.** "We use a skill called caveman for this" beats "The contract we actually run is...". Plain subject and verb first, conceptual label after, if at all.
- **Self-contained passages.** If a paragraph only lands for someone who has seen the artifact it references, show the artifact or cut the passage.
- **Word-tic sweep.** A word repeated across a draft ("true" 8 times, "real" 3) means the prose is orbiting an abstraction. Rewrite the leaning sentences into concrete statements.
- **Never talk down.** No framing that explains the reader to themselves ("adults learn what they can use").
- **Earn every claim.** Concrete detail beats self-description; never say passionate or innovative, show what it looks like. Never invent details, numbers, or sources: invented specificity is worse than vague prose.
- **Keep a voice.** Vary rhythm. Short sentences, then a longer one. First person where genuine; a little asymmetry; have a view. Sterile "clean" prose is still a tell. When matching a writer's sample, mirror their rhythm and habits rather than upgrading them to corporate prose; explicit user voice choices override general style defaults.
- **Tell the making as it happened.** A claim about how something was built is a fact and gets verified like one. A method distilled after the work is presented as distilled afterward, not as the recipe that produced it.
- **Shorter and denser wins.** Any sentence that can go without loss, goes.

## Review pass

On the finished draft, in order:

1. Search for em dashes and double-hyphen stand-ins; replace every one.
2. Strip trailing periods from headings.
3. Hunt negation pivots, including split-sentence forms.
4. Jargon and fancy-word sweep: every term either glossed, owned by the reader, or replaced.
5. Paragraph length: split or cut anything past 4 sentences.
6. Flourish hunt: for each paragraph ask "which sentence is performing rather than informing" and delete it.
7. Stranger-test captions, labels, and any sentence with a double-reading word.
8. Count repeats of abstract nouns and adjectives; rewrite the sentences that lean on them.
9. Title check: does it say what the reader gets, unopened?

## Verdict

For an explicitly requested prose review, close with a verdict. Ordinary drafting and code reviews do not require an editorial verdict:

- **PASS**: nothing in Hard bans or Rules is still violated.
- **FAIL**: at least one violation remains. Name each one and the rule it breaks.

Then label every remaining note:

- **Requirement**: fixes a Hard bans or Rules violation. The draft does not ship until applied. Any open requirement means the verdict is FAIL.
- **Suggestion**: optional improvement (tighter phrasing, alternative title, tone tweak). The draft can ship without it.

Never leave a note unlabeled, and never end the review without the PASS/FAIL line.

## Anti-patterns

- Don't trade one tell for another (em dashes -> semicolon storms, fancy word -> sidegrade synonym).
- Don't reword quoted artifacts, attributed quotes, code, or error strings.
- Don't sanitize a distinctive voice into bland professional prose.
- Code comments and commit subjects follow repository conventions. Do not run this editorial review on ordinary session replies, or rewrite identifiers or technical content.
