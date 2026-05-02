# Hermes Model Routing

This repo is best served by using different Hermes profiles for different kinds of work instead of forcing one model to do everything.

## Current profile map

- `second-brain`
  - Model: `glm-4.7-flash:latest`
  - Best for: broad reasoning, architecture review, planning, synthesis, and general orchestration

- `sbreason`
  - Model: `vaultbox/qwen3.5-uncensored:35b`
  - Best for: deeper general reasoning, longer synthesis, and alternative perspective checks

- `sbarch`
  - Model: `glm-4.7-flash:latest`
  - Best for: a clean-room architecture/planning sandbox when you want a separate context from `second-brain`

- `sbcode`
  - Model: `qwen3-coder:30b`
  - Best for: coding-heavy tasks, implementation details, and repo edits

- `sbdeep`
  - Model: `deepseek-coder-v2:16b`
  - Best for: deeper coding analysis, refactors, and debugging support

- `sbfast`
  - Model: `llama3.1:latest`
  - Best for: quick lightweight checks, short summaries, and cheap exploratory queries

- `sbvision`
  - Model: `qwen2.5vl:7b`
  - Best for: screenshot/UI vision work and multimodal inspection

- `sbsql`
  - Model: `sqlcoder:7b`
  - Best for: SQL generation, schema queries, and database reasoning

## Suggested orchestration pattern

1. Use `sbarch` or `second-brain` to decide the plan.
2. Use `sbcode` or `sbdeep` for implementation-heavy work.
3. Use `sbvision` for UI/screenshot review.
4. Use `sbsql` for database and query-heavy tasks.
5. Use `sbfast` for quick triage when full reasoning is unnecessary.

## Rules of thumb

- Keep one profile per task type so context stays cleaner.
- Prefer profile switching over changing the model mid-task.
- Use the smallest model that can reliably do the job.
- Keep secrets in the profile-specific `.env`, not in docs.
- Verify model behavior with real output quality, not just model size.

## Helpful commands

```bash
hermes profile list
hermes --profile sbarch chat -q "Review this architecture"
hermes --profile sbcode chat -q "Implement this change"
hermes --profile sbvision chat -q "Inspect this screenshot"
hermes --profile sbsql chat -q "Write the SQL for this report"
```
