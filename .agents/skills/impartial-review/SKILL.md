---
name: impartial-review
description: "Review scoped code with fresh independent reviewers when the user requests independent or multi-agent review."
---

# Independent code review

Pin the requested scope: uncommitted work including relevant untracked files, a commit and parent, or exact PR/base/head. Inspect exposed collaboration tools and free slots before promising concurrency. If independence cannot be provided, report the gap rather than presenting self-review as the requested result.

Choose reviewer coverage proportional to the diff. Use one fresh reviewer for a narrow change; for a broader change cover correctness, state/error paths, performance/security and project constraints. Buckets need not be separate simultaneous agents. Fit waves to available slots, counting the manager, and disclose total worker/retry bounds.

Use collaboration.spawn_agent with fork_turns: "none" and a standalone scope, raw paths, relevant constraints and finding format. Inherit configured model/effort unless a supported override was requested. Reviewers are read-only leaves: no edits, nested agents or review processes. Do not pass the author conversation or prior verdicts.

Require each finding to include path:line, actual trigger, impact, evidence, certainty and proposed fix. Allow a clean result; never require a defect quota. Wait for each reviewer through the appropriate collaboration wait tool. Fresh Codex reviewers are not a different vendor.

Verify every candidate against current code and a reproduction where useful. Deduplicate root causes; classify confirmed, refuted or unverified, with reasons. A review-only request ends with findings and a merge recommendation, not repairs or publication. Apply fixes only if authorized; run affected checks and invalidate stale review evidence when source changes.
