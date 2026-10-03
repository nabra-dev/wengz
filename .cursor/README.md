# Cursor project config (Wengz)

Ground truth for product/engineering remains in **`docs/`**. This folder teaches Cursor agents how to stay aligned.

## Layout

| Path                | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `rules/*.mdc`       | Persistent rules (always-apply + glob-scoped)         |
| `skills/*/SKILL.md` | On-demand workflows agents should load when triggered |
| `agents/*.md`       | Subagent prompts (e.g. codebase-fit)                  |

## Rules

| File                                   | When                                               |
| -------------------------------------- | -------------------------------------------------- |
| `nabra-core.mdc`                       | Always — canon docs, stack, roles, hard invariants |
| `wengz-domain.mdc`                     | Always — credits/requests/payments/wallet/trust    |
| `wengz-roles-access.mdc`               | Admin/client/provider ACL files                    |
| `trpc-prisma-server.mdc`               | Server / Prisma                                    |
| `next-intl-and-app-router.mdc`         | App Router + messages                              |
| `errors-toasts-notifications-i18n.mdc` | Toasts + notifications                             |

## Skills

| Skill                        | Use when                                |
| ---------------------------- | --------------------------------------- |
| `codebase-fit-skills`        | Refreshing skills/rules from docs       |
| `wengz-domain-workflows`     | Request lifecycle / multi-role features |
| `wengz-credits-payments`     | Credits, proofs, wallet, finance        |
| `wengz-notifications-locale` | Email/in-app/SSE locale correctness     |

## Refresh workflow

Follow `skills/codebase-fit-skills/SKILL.md`: read ADVANCED business → technical → code → update rules/skills. Do not duplicate entire docs into rules — **link** and distill.
