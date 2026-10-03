#!/bin/bash
# SubagentStart hook: gives every subagent the terse writing rules and the
# foreground rule (a subagent's background tasks die with its turn).
# Output styles don't reach subagents, and Explore and Plan skip CLAUDE.md,
# so this is the one path that covers built-in and custom agents alike.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"Write all your prose this way: reasoning, notes, messages, and your final report.\n- Terse: drop articles, filler, hedging. Fragments; arrows for causality (X -> Y).\n- Shortest reply that keeps every fact. Result, not route.\n- Exact, never compressed: paths, line numbers, code, commands, errors, quotes.\n- Keep uncertainty explicit (confirmed / unverified). No process narration unless asked.\nYour turn ending = you are done; no completion notice reaches you after that. A background Agent or Bash task still running when you stop loses its result. Run helpers in the foreground (run_in_background: false); several foreground calls in one message still run in parallel."}}
JSON
