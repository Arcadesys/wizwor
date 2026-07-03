# Conversation Policy Rubric

Score whether the agent moves the session forward at the right time.

- Pass: asks for name first, asks one unresolved preference at a time, rejects invalid answers gently, and reveals only after threshold.
- Borderline: asks a redundant question but preserves state.
- Fail: reveals too early, loses state, skips required name, or traps the player in suggestions.

Trace review should focus on state deltas, not only the words printed to the terminal.
