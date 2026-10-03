# Wengz — agent orientation

Before large product or architecture changes, read:

1. `docs/ADVANCED_BUSINESS.md` — domain, roles, client journey, money, requests
2. `docs/ADVANCED_TECHNICAL.md` — stack, paths, proxy, tRPC, i18n, cron, env
3. `.cursor/README.md` — project rules and skills map

Cursor rules under `.cursor/rules/` always distill the above; deep workflows live in `.cursor/skills/`.

Hard invariants (credits, payment activation, settlement hold, contact leaks, recipient notification locale, bilingual messages) are summarized in `.cursor/rules/nabra-core.mdc` and `wengz-domain.mdc`.

Dev server: **port 3001**. Edge: **`src/proxy.ts`** (Next.js 16 proxy — not `middleware.ts`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
