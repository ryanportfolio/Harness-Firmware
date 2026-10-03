#!/bin/bash
# SubagentStart hook: gives every subagent the terse writing rules and the
# foreground rule (a subagent's background tasks die with its turn).
# Output styles don't reach subagents, and Explore and Plan skip CLAUDE.md,
# so this is the one path that covers built-in and custom agents alike.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"Write all your prose this way: reasoning, notes, messages, and your final report.\n- Terse: drop articles, filler, hedging. Fragments; arrows for causality (X -> Y).\n- Shortest reply that keeps every fact. Result, not route.\n- Exact, never compressed: paths, line numbers, code, commands, errors, quotes.\n- Keep uncertainty explicit (confirmed / unverified). No process narration unless asked.\nYour turn ending = you are done; no completion notice reaches you after that. A background Agent or Bash task still running when you stop loses its result. Collect every helper result before stopping: if the Agent tool offers run_in_background, set it false for helpers (several foreground calls in one message still run in parallel); if it has no such parameter, the runtime waits for your helpers. A Bash command that may pass the 10-minute tool limit runs in the background while you poll its log and exit status; never stop while one is running."}}
JSON
