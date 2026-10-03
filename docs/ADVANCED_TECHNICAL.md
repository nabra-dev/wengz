# Advanced guide — technical architecture (Wengz)

This document maps **stack choices**, **runtime boundaries**, and **important code paths** so engineers can navigate the repo without spelunking every folder. It complements `docs/ADVANCED_BUSINESS.md` (domain). Keep this file aligned with `package.json` and `src/` when the stack changes.

Versions below are the **declared** ranges in `package.json` (lockfile may resolve newer patches).

---

## Stack overview

| Layer               | Technology                                                                                                                                                                                                           | Notes                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | **Next.js 16.3.x** (App Router)                                                                                                                                                                                      | Dev: `next dev --webpack -p **3001**`. Prod start: `next start` (default **3000** unless `PORT` set). Webpack forced because **next-pwa** needs it.                                             |
| UI                  | **React 18.3**, **Tailwind CSS 3.4**, **Radix** primitives, **Framer Motion**, **Recharts**, **lucide-react**, **Sonner**, **react-hook-form** + Zod resolvers, **react-datepicker**, **date-fns** / **date-fns-tz** | No Swiper (removed).                                                                                                                                                                            |
| API                 | **tRPC v11** + **TanStack Query v5**; **SuperJSON**                                                                                                                                                                  | Routers in `src/server/routers/`. OpenAPI via **trpc-to-openapi** + **zod-openapi**.                                                                                                            |
| Auth                | **NextAuth v4** (JWT, **Credentials** only)                                                                                                                                                                          | Passwords via **bcryptjs** (cost **12**); min 8 / max 128 (`passwordSchema`). Forgot/reset: hashed `PasswordResetToken` (1h).                                                                   |
| Data                | **PostgreSQL** via **Prisma 6**                                                                                                                                                                                      | `prisma/schema.prisma`; `DATABASE_URL` + `DIRECT_URL`.                                                                                                                                          |
| i18n                | **next-intl 4.x** — `en` / `ar`                                                                                                                                                                                      | `src/i18n/routing.ts`; `messages/*.json`; RTL for `ar`.                                                                                                                                         |
| Validation          | **Zod 3**                                                                                                                                                                                                            | Shared shapes in `src/lib/validations.ts` + routers.                                                                                                                                            |
| Cache               | **Redis** (`redis` client) or **Upstash** REST                                                                                                                                                                       | Optional — app runs without Redis (null cache + circuit breaker). See `src/lib/cache.ts`.                                                                                                       |
| File storage        | **Local disk** (live)                                                                                                                                                                                                | `src/app/api/upload/*` → `storage/` or `LOCAL_UPLOAD_DIR`. Served via `/api/files/[...path]`. AWS S3 / B2 SDKs + `next.config` image hosts are **present for future** use only — **not wired**. |
| PWA                 | **next-pwa** (devDependency)                                                                                                                                                                                         | Disabled when `NODE_ENV === "development"`.                                                                                                                                                     |
| Observability       | **Sentry** (`@sentry/nextjs`)                                                                                                                                                                                        | `sentry.*.config.ts`, tunnel `/sentry-tunnel`; toggle via `SENTRY_DSN` / `SENTRY_DISABLE`.                                                                                                      |
| Email               | **Nodemailer**                                                                                                                                                                                                       | SMTP env vars; templates under `src/lib/notifications/`.                                                                                                                                        |
| Landing AI          | **OpenAI** (HTTP API)                                                                                                                                                                                                | `src/app/api/landing/chat/route.ts` — optional; needs `OPENAI_API_KEY`.                                                                                                                         |
| Testing             | **Jest 30** + Testing Library; **Playwright**                                                                                                                                                                        | MSW available in devDeps. Husky + lint-staged on commit.                                                                                                                                        |
| Docs / API explorer | OpenAPI + Swagger UI                                                                                                                                                                                                 | `src/app/api/docs/`, `src/app/api/openapi.json/`; Pages REST bridge `src/pages/api/rest/[...trpc].ts`.                                                                                          |

---

## High-level architecture

```mermaid
flowchart TB
  subgraph client [Browser / PWA]
    Pages[App Router pages src/app/locale]
    TRPCReact[tRPC React client]
  end

  subgraph edge [Edge / Node]
    MW[src/proxy.ts - next-intl + NextAuth]
    API[tRPC /api/trpc]
    Upload[Local upload /api/upload]
    SSE[/api/notifications/sse]
  end

  subgraph server [Server]
    Routers[src/server/routers]
    Lib[src/lib]
  end

  subgraph data [Data and integrations]
    PG[(PostgreSQL)]
    Redis[(Redis optional)]
    Disk[(Local disk storage)]
    Email[SMTP / Nodemailer]
    Sentry[Sentry]
  end

  Pages --> TRPCReact
  TRPCReact --> API
  Pages --> Upload
  Pages --> SSE
  MW --> Pages
  API --> Routers
  Routers --> Lib
  Lib --> PG
  Lib --> Redis
  Lib --> Disk
  Lib --> Email
  Lib --> Sentry
```

---

## Repository layout (practical map)

| Path                                             | Role                                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                                       | App Router: root `layout.tsx`, `globals.css`, `api/**`                                                                                                |
| `src/app/[locale]/`                              | Locale segment; groups `(auth)`, `(dashboard)` → `client/`, `provider/`, `admin/`                                                                     |
| `src/pages/api/rest/[...trpc].ts`                | OpenAPI/REST bridge for tRPC procedures                                                                                                               |
| `src/server/trpc.ts`                             | Context (`db`, `session`, `locale`, `req`), procedures (`public`, `protected`, `admin`, `requestManager`, `financeManager`, `staff`, provider/client) |
| `src/server/routers/`                            | Domain routers → `_app.ts` → `AppRouter` (auth, user, request, subscription, package, payment, provider, notification, admin)                         |
| `src/lib/db.ts`                                  | Prisma client singleton                                                                                                                               |
| `src/lib/auth.ts`                                | `authOptions` (Credentials)                                                                                                                           |
| `src/lib/env.ts`                                 | Production fail-fast for required secrets                                                                                                             |
| `src/lib/trpc/client.ts`                         | `createTRPCReact<AppRouter>()`                                                                                                                        |
| `src/components/providers/trpc-provider.tsx`     | React Query + tRPC provider                                                                                                                           |
| `src/lib/error-handler.ts`                       | Sonner toasts + tRPC/Zod mapping; optional `next-intl` `t`                                                                                            |
| `src/lib/notifications/`                         | Email, in-app, SSE; recipient **`preferredLocale`** via `localeForUser`                                                                               |
| `src/lib/user-locale.ts`                         | `preferredLocale` sync + batch/single lookup                                                                                                          |
| `src/lib/approve-delivered-request.ts`           | Client / staff-on-behalf delivery approval + settle                                                                                                   |
| `src/lib/provider-wallet.ts`                     | Settlement, 7-day hold, withdrawals, payouts                                                                                                          |
| `src/lib/finance-settings.ts`                    | Global credit price / commission / withdrawal settings                                                                                                |
| `src/lib/upload-storage.ts` / `upload-limits.ts` | Local upload paths and size caps                                                                                                                      |
| `src/proxy.ts`                                   | **Next.js 16 proxy** (replaces deprecated `middleware.ts`): next-intl + `withAuth`, locale rewrite, role redirects                                    |

> **Next.js 16:** Edge auth/i18n lives in `src/proxy.ts` by design. Do **not** add a parallel `middleware.ts` unless upgrading away from the proxy convention. See `AGENTS.md` and `node_modules/next/dist/docs/` for framework-breaking changes.

### HTTP API surface (App Router)

| Route family                                                            | Purpose                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| `/api/trpc/[trpc]`                                                      | tRPC                                              |
| `/api/auth/[...nextauth]`                                               | NextAuth                                          |
| `/api/locale`                                                           | Locale cookie (POST preferred; GET fallback)      |
| `/api/upload`, `/init`, `/chunk`, `/complete`, `/abort`, `/provider-cv` | Local uploads                                     |
| `/api/files/[...path]`                                                  | Authenticated file serve + ACL                    |
| `/api/notifications/sse`, `/unread-count`                               | Realtime + badge                                  |
| `/api/cron/*`                                                           | Scheduled jobs (`CRON_SECRET`)                    |
| `/api/forms/contact`                                                    | Public contact form                               |
| `/api/landing/chat`                                                     | Landing AI chat (OpenAI)                          |
| `/api/health`                                                           | Health check                                      |
| `/api/docs`, `/api/openapi.json`                                        | API explorer (super-admin gated where applicable) |
| `/api/debug-notify`                                                     | Dev/debug notify helper                           |

Empty/stub dirs (no `route.ts` yet): `src/app/api/push/`, `src/app/api/webhooks/stripe/` — not live features.

---

## Request path: tRPC

1. Client calls `trpc.*` hooks from `@/lib/trpc/client` (typed by `AppRouter`).
2. HTTP hits `src/app/api/trpc/[trpc]/route.ts` → `fetchRequestHandler` with `createTRPCContext`.
3. Context resolves **session** (NextAuth) and **locale** from cookies (`getLocaleFromCookie` in `src/server/trpc.ts`).
4. Routers use **Zod** inputs and throw **`TRPCError`**; `errorFormatter` attaches flattened **Zod** details.

---

## Passwords and session invalidation

| Concern         | Implementation                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy          | `passwordSchema` in `src/lib/validations.ts` — trim, **min 8 / max 128**. Register, creator apply, reset, `user.changePassword`, admin create user. Login accepts any non-empty password (legacy). |
| Hashing         | **bcryptjs** cost **12**.                                                                                                                                                                          |
| Forgot / reset  | `src/lib/password-reset.ts` + `src/lib/issue-password-reset.ts`. Raw token emailed; **SHA-256** stored; **1h TTL**, single-use. Needs `NEXTAUTH_URL` or `NEXT_PUBLIC_APP_URL`.                     |
| Change password | Profile Security → `user.changePassword` only; sign-out afterward.                                                                                                                                 |
| Admin support   | `admin.sendPasswordResetLink`.                                                                                                                                                                     |
| Session kill    | `User.passwordChangedAt`; JWT + `src/proxy.ts` reject older tokens; DB `Session` rows deleted.                                                                                                     |
| Login hardening | Email normalize; dummy bcrypt timing; rate limits; maintenance allows **staff** only (`isStaffRole`).                                                                                              |

---

## Internationalization

- **Routing**: `src/i18n/routing.ts` — use **`Link` / `redirect` / `useRouter` / `usePathname` from `@/i18n/routing`**, not raw `next/navigation` (`localePrefix: "as-needed"`).
- **Language switch**: `POST /api/locale` + `router.replace(..., { locale })`; syncs `User.preferredLocale` (`src/lib/user-locale.ts`).
- **Public redirects**: `resolvePublicRequestOrigin` / `publicRedirectUrl` (`src/lib/request-origin.ts`) behind reverse proxies.
- **Messages**: `messages/en.json`, `messages/ar.json` via `NextIntlClientProvider`.
- **RTL**: Locale layout sets `dir` for Arabic.
- **Notifications**: Single-recipient helpers resolve **recipient `preferredLocale`**, not actor `ctx.locale`. Staff fan-out groups by each admin’s preferred locale.

---

## Background and scheduled work

All cron routes require `Authorization: Bearer ${CRON_SECRET}` (in production `CRON_SECRET` is required by `src/lib/env.ts`).

| Route                                                 | Cadence (suggested) | Behavior                                                                                                                             |
| ----------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/api/cron/check-subscriptions/route.ts`       | Daily               | ~day-7 expiring warn; deactivate expired; notify. Dedupes by notification `type` (`subscription_expiring` / `subscription_expired`). |
| `src/app/api/cron/check-delivered-approvals/route.ts` | ~15 min             | 1h client reminder; 12h `needsManualApproval` + staff notify.                                                                        |
| `src/app/api/cron/release-provider-holds/route.ts`    | ~1 hour             | Release ledger `HOLD` rows past `availableAt` into wallet available.                                                                 |

### Activity / audit log

- **`ActivityLog`** in Prisma — immutable rows (actor, role, action, entity, message, metadata, level).
- Writers: `src/lib/activity-log.ts`, `src/lib/request-activity.ts` (includes `request.approve_on_behalf`).
- Admin UI: `/admin/activity` → `admin.getActivityLogs`.

---

## Caching and performance

- `src/lib/cache.ts` — Upstash REST **or** traditional Redis; SuperJSON; graceful no-op if unset.
- Hot reads: `getOrSetCached` (packages, service types, active subscription, unread counts). Mutations: `src/lib/cache-invalidation.ts`.
- `src/lib/session-user-cache.ts` — short-TTL session revalidation (memory + Redis).
- `src/lib/performance.ts` — tRPC middleware on protected procedures.
- `src/lib/cache-monitor.ts` — cache observability helpers.
- Pattern deletes use `SCAN` (not `KEYS`).
- Uploads: local disk; attachments up to **500MB** chunked (`init` → `chunk` → `complete`); small files ≤20MB single-shot; payment proofs ≤10MB.
- Landing media: compressed assets under `public/images/landing`.

---

## Quality gates (commands)

| Command                                                            | Purpose         |
| ------------------------------------------------------------------ | --------------- |
| `npm run lint`                                                     | ESLint (Next)   |
| `npm run type-check`                                               | `tsc --noEmit`  |
| `npm run test:ci`                                                  | Jest + coverage |
| `npm run test:e2e`                                                 | Playwright      |
| `npm run format` / `format:check`                                  | Prettier        |
| `npm run db:migrate` / `db:migrate:deploy` / `db:push` / `db:seed` | Prisma          |

**Lint-staged** (Husky): ESLint, Prettier, related Jest for touched `*.{js,jsx,ts,tsx}`.

**E2E:** `playwright.config.ts` targets **port 3001** (same as `npm run dev`). Prod `npm start` defaults to 3000 unless `PORT` is set.

**Deploy:** see `docs/DEPLOY.md` (Hostinger VPS + GitHub Actions). CI runs type-check + lint; production build runs on the VPS.

---

## Mobile client API (Expo / native)

Client-only native apps (see `apps/mobile`) authenticate with a **Bearer JWT**, not cookies.

| Concern     | Implementation                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login       | `POST /api/rest/auth/mobile-login` (`auth.mobileLogin`) — **CLIENT** role only; returns `accessToken`, `expiresIn`, `user`                                                                      |
| Auth header | `Authorization: Bearer <accessToken>` on tRPC REST, `/api/upload/*`, `/api/files/*`                                                                                                             |
| Locale      | `X-Locale: en\|ar` (or `Accept-Language`) → `ctx.locale` + `preferredLocale` sync                                                                                                               |
| Context     | [`src/lib/mobile-auth.ts`](src/lib/mobile-auth.ts), [`src/lib/request-session.ts`](src/lib/request-session.ts), [`createTRPCContext`](src/server/trpc.ts)                                       |
| Inbox       | Poll `GET /api/rest/notification` — do not rely on SSE                                                                                                                                          |
| Push        | Register via `POST /api/rest/notification/push-device` or `/api/push/subscribe`; fan-out from `createNotification` via Expo Push API ([`src/lib/push.ts`](src/lib/push.ts), `PushDevice` model) |
| OpenAPI     | Bearer scheme `Authorization` documented in [`src/server/openapi.ts`](src/server/openapi.ts)                                                                                                    |

Web cookie sessions remain unchanged. Tokens are NextAuth-compatible JWTs signed with `NEXTAUTH_SECRET` and invalidated when `passwordChangedAt` advances.

---

## Environment and secrets (non-exhaustive)

Treat as a **checklist** — verify each module for exact names. Production fail-fast (`src/lib/env.ts`): `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `CRON_SECRET`.

| Category                 | Sample keys                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Database                 | `DATABASE_URL`, `DIRECT_URL`                                                                                        |
| Auth / app URL           | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `PORT`                                                    |
| Cron                     | `CRON_SECRET`                                                                                                       |
| Redis                    | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, or `REDIS_URL` / `REDIS_HOST` + `REDIS_PORT`                  |
| Email (SMTP)             | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `CONTACT_FORMS_RECIPIENT` |
| Uploads                  | `LOCAL_UPLOAD_DIR`                                                                                                  |
| Analytics / SEO          | `NEXT_PUBLIC_GTM_ID`, `GOOGLE_SITE_VERIFICATION`                                                                    |
| Sentry                   | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DISABLE`                                                            |
| Landing chat             | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TEMPERATURE`, `OPENAI_MAX_TOKENS`                                         |
| Seed                     | `SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD`                                                                         |
| Object storage (planned) | AWS/B2 SDKs in deps; no live `AWS_*` upload path yet                                                                |

---

## Role access (implementation pointers)

| Concern                 | Location                                                                      |
| ----------------------- | ----------------------------------------------------------------------------- |
| Role enums + path ACL   | `src/lib/roles.ts`                                                            |
| Edge redirects          | `src/proxy.ts`                                                                |
| tRPC procedures         | `src/server/trpc.ts`                                                          |
| Admin nav filter        | `src/app/[locale]/(dashboard)/dashboard-shell.tsx`                            |
| Domain rules            | `docs/ADVANCED_BUSINESS.md`                                                   |
| Recipient notify locale | `src/lib/notifications/index.ts` (`localeForUser`) + `src/lib/user-locale.ts` |
| Staff approve delivered | `src/lib/approve-delivered-request.ts` + `admin.approveRequestOnBehalf`       |

`staffProcedure` exists but is unused by routers — prefer request/finance procedures.

Maintenance mode: **staff** may log in; clients/providers blocked (`src/lib/auth.ts`). Existing JWTs are not revoked on toggle.

---

## Tooling and agent notes

- **TypeScript**: strict; path alias `@/*` → `./src/*`.
- **reactStrictMode**: currently `false` in `next.config.js` (intentional — document if re-enabled).
- **AGENTS.md** / **CLAUDE.md**: Wengz orientation + Next.js 16 agent rules — read `node_modules/next/dist/docs/` before assuming older App Router APIs.
- **Cursor project config**: `.cursor/README.md` maps rules (`nabra-core`, `wengz-domain`, roles, tRPC, i18n, notifications) and skills (`wengz-domain-workflows`, `wengz-credits-payments`, `wengz-notifications-locale`, `codebase-fit-skills`). Refresh via the codebase-fit skill after large refactors.

---

## Related documents

- `docs/ADVANCED_BUSINESS.md` — domain and workflows
- `docs/DEPLOY.md` — VPS / GitHub Actions deploy
- `docs/WENGZ_KNOWLEDGE.md` — assistant/knowledge summary
- `docs/WENGZ_INTENT_PLAYBOOKS.md` — landing chat intents
- `src/lib/error-handler.ts` — Sonner toasts and `errors.*` keys
- `src/lib/notifications/` — multi-channel notifications
- `.cursor/rules/nabra-core.mdc` — concise agent-oriented project summary
