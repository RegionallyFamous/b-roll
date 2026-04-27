# Architecture Decision Records

Lightweight log of non-obvious decisions that shaped the codebase.
Each record is a short, dated markdown file with context, decision,
consequences, and alternatives considered. Newest first.

| # | Title | Date | Status |
|---|-------|------|--------|
| 0001 | [Server-canonical icon live-swap](0001-icon-live-swap-server-canonical.md) | 2025-xx-xx | Accepted |
| 0002 | [Universal `.wp` bundle format](0002-universal-wp-bundle-format.md) | 2025-xx-xx | Accepted |
| 0003 | [API versioning separate from plugin releases](0003-api-version-tracks-separately.md) | 2026-04 | Accepted |
| 0004 | [Zero server-side telemetry](0004-zero-server-side-telemetry.md) | 2026-04 | Accepted |

## How to write a new ADR

1. Copy the template below into `docs/adr/NNNN-<slug>.md` (next free number).
2. Fill in every section — `Context` is the most important, `Alternatives considered` is the second.
3. Add a row to the table in this file.
4. Open the PR with the ADR as a separate commit so reviewers can discuss the decision independently of the implementation.

```markdown
# ADR NNNN: <title>

- **Status:** Proposed | Accepted | Superseded by ADR-N
- **Date:** YYYY-MM-DD
- **Context:** Why does this decision need to be made? What did the previous state look like?
- **Decision:** The actual choice, stated in one or two sentences.
- **Consequences:** What does this make easy? What does it make hard or impossible?
- **Alternatives considered:** One paragraph per option we evaluated, with the reason we didn't pick it.
```
