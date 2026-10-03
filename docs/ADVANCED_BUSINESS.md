# Advanced guide — business domain (Wengz)

This document describes the **business model**, **actors**, and **core workflows** implemented in the product. It is aimed at product owners, operations, and engineers who need shared language for features and policy.

---

## Product positioning

**Wengz** is a **service marketplace** where clients purchase **subscription packages** denominated in **credits**, then spend those credits to open **requests** for configurable **service types** (e.g. design, development, media). **Providers** fulfill work. **Project managers** oversee request ops; **finance managers** handle money flows; **super admins** configure the catalog and retain full platform control.

The application is **bilingual (English and Arabic)** end-to-end, including marketing surfaces, dashboards, transactional messaging, and notifications. UI copy lives in `messages/en.json` and `messages/ar.json`; toasts use `src/lib/error-handler.ts`, and outbound channels use `src/lib/notifications/` with **`locale`** aligned to the user (see `docs/ADVANCED_TECHNICAL.md`).

---

## Actors and permissions

| Role                | Typical use                                                                                      | Access (conceptual)                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Client**          | Buys packages, creates and tracks requests, messages, rates completed work                       | Client dashboard: subscriptions, payment proof, requests, notifications, profile                                                                        |
| **Provider**        | Sees assigned or available work, delivers outputs, collaborates on threads, requests withdrawals | Provider dashboard: my requests, available jobs, wallet, notifications, profile                                                                         |
| **Project manager** | Oversees client–provider requests and contact-leak moderation                                    | Admin: requests (list, assign/unassign, create-on-behalf, soft-delete/restore), contact leaks, messaging oversight, notifications, profile              |
| **Finance manager** | Handles money flows only                                                                         | Admin: finance (wallets, withdrawals, disputes, payouts), payments (proof review), subscriptions list, finance/payment settings, notifications, profile |
| **Super admin**     | Full platform control                                                                            | Full admin dashboard: users, services, packages, requests, payments, finance, settings, activity, contacts, contact leaks                               |

Registration and login are **credential-based** (email/password). **Self-serve** client registration and the creator form create accounts in **PENDING** status; login is blocked until an admin approves. Role is fixed per user account and enforced both in the **edge layer** (route protection) and in **tRPC** (procedure-level middleware: `adminProcedure` for super admin, `requestManagerProcedure`, `financeManagerProcedure`, plus shared helpers in `src/lib/roles.ts`).

Logged-in users can **change password** from their profile Security tab (min **8** characters; other sessions are invalidated and the user must sign in again). Anyone can use **forgot password** (`/auth/forgot-password`) to receive a one-time email link (**1 hour** TTL) and set a new password at `/auth/reset-password`. Super admins can also **send a reset link** from Admin → Users for support.

---

## Commercial model: packages and credits

- **Packages** bundle a **credit balance** and a **time-bounded entitlement** (`durationDays`, typically monthly). Packages may be scoped to **specific service types** or **support all services**, depending on catalog configuration.
- **Credits** are the **unit of spend** for opening and evolving requests. A **client subscription** stores **remaining credits** and an **end date**; inactive or expired subscriptions stop new spend unless business rules allow otherwise in code.
- **Free-trial semantics** exist in the data model (`isFreeTrialUsed`, `isFreePackage`) so the business can distinguish promotional or trial packages from paid tiers. The free package (`isFreePackage`) is configured in **Admin → Packages** (credits + duration days; price stays `$0`). Defaults: **500 credits**, **14 days**. Changes apply to **future** grants only (newly approved clients).

**Payment in the field**: clients choose a **payment method** on the payment page. **Bank transfer** and **InstaPay** (when enabled) are active and use **manual payment proofs** (receipt image + details) tied to a subscription; **finance managers / super admins** configure bank/InstaPay instructions under Settings and review approve/reject. Other methods (Fawry, Meeza, Visa, Mastercard) appear as **Coming soon**. Until approved, downstream fulfillment rules should align with your operational policy (the schema supports `PaymentProof` with `PENDING` / `APPROVED` / `REJECTED`).

## Provider earnings and withdrawals

Completed request work is settled into a **provider wallet** (credits + USD) using **global** finance settings (not per service):

- **Credit price (USD)** — value of one credit for settlement (production: `$0.008`).
- **Platform commission (%)** — share taken from gross settlement before the provider is credited (production: `0%`).
- **Min withdrawal (USD)** / **Withdrawal fee (USD)** — provider cash-out thresholds (production: min `$1`, fee `$0`).
- **Payment instructions** — bank + InstaPay details shown to clients (seeded from production).

Example: a request costing `500` credits with `$0.008`/credit and `0%` commission settles as **$4.00** gross to the provider.

**Settlement is not immediately withdrawable.** On client approval, the provider share is credited as **on hold** for **7 days** (`PROVIDER_EARNINGS_HOLD_DAYS`). It appears in the wallet (held balance + ledger status) but cannot be withdrawn until a release job moves it to **available**. Withdrawal requests only draw from available balance.

Providers can **open a dispute** on a ledger settlement or withdrawal from the wallet page if something looks wrong. Disputes are reviewed **manually** by **finance managers or super admins** (open → under review → resolved/rejected) and do **not** automatically change wallet balances.

Providers store **payout details** (bank account or e-wallet number) and can **request a withdrawal** from available funds. That request holds the amount as pending until a **finance manager or super admin** reviews it **manually**. Two **global** withdrawal settings apply:

- **Minimum withdrawal (USD)** — providers cannot request less than this amount (default `$1`).
- **Withdrawal fee (USD)** — fixed fee stored on the withdrawal; the amount deducted from the wallet is the requested total, and admins should pay out **requested − fee**.

Withdrawal review:

- **Approve / mark as paid** after sending the money off-platform, with a **reason** and a **required proof image** (e.g. transfer receipt).
- **Reject** with a **reason** and a **required proof image**, which returns the held funds to the available balance.

Finance managers / super admins can also **record a payout** against a provider’s available balance when they send money without a prior request. There is no automated payout gateway; operations handle the transfer, then record status and reason in the app.

Settlement value is independent of what the client paid for a **package**; packages remain the client subscription product.

---

## Service catalog and pricing logic

**Service types** are admin-configurable and drive:

- **Per-request credit cost** (base cost for that service).
- **Attributes** (structured Q&A: text, select/multiselect, number, **file upload**, **voice record/upload**) that can **add to** the credit total (text/choice/number only; file and voice answers do not add credits).
- **Revisions**: each service defines **free revision allowance**, **paid revision cost**, and whether paid revisions **reset** the free counter—so the business can tune quality-of-service vs. margin.
- **Max delivery**: each service defines a **maximum estimated delivery time in minutes**; providers cannot set a start-work estimate above that cap.

When a client creates a request, the system can persist **base** and **attribute** components of cost for auditing and display (`baseCreditCost`, `attributeCredits`, `creditCost` on `Request`).

---

## Client journey (end-to-end)

Canonical happy path and side exits. Technical pointers live in `docs/ADVANCED_TECHNICAL.md`; this section is the **business contract** for client ops.

| #   | Step                         | Business rule                                                                                                                                                                                                                      | Client surface / outcome                       |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | **Discover**                 | Marketing drives signup; bilingual landing.                                                                                                                                                                                        | `/` → CTA `/auth/register`                     |
| 2   | **Register**                 | Self-serve creates `CLIENT` + `PENDING`; stores preferred locale + registration IP. Allowed even in maintenance.                                                                                                                   | Application-received email; staff notified     |
| 3   | **Wait / reject / re-apply** | Login blocked while PENDING. REJECTED may re-register same email → back to PENDING. Soft-deleted APPROVED cannot reclaim email via register.                                                                                       | Login toasts; no dashboard access              |
| 4   | **Approve + free trial**     | Super admin approve (or admin-create) grants configured free package **once** (`isFreeTrialUsed` on subscription). Silent skip if free package missing/inactive.                                                                   | Active free sub; welcome + approval mail       |
| 5   | **Login / security**         | Credentials JWT; forgot/reset 1h; profile change-password kills other sessions. Maintenance blocks **new** client login (live JWTs not revoked).                                                                                   | Home `/client`                                 |
| 6   | **Browse / subscribe paid**  | Paid packages only in catalog (free hidden). Subscribe creates **inactive** sub; prior active plan stays usable until payment approve. Concurrent PENDING proof blocked.                                                           | `/client/subscription` → `/client/payment`     |
| 7   | **Payment proof**            | Bank / InstaPay (when enabled); amount = package USD price; image required. Other rails Coming soon.                                                                                                                               | Proof PENDING; FM/SA review                    |
| 8   | **Payment approve / reject** | Approve: deactivate other actives, activate paid sub, **reset** period from package duration (credits keep subscribe-time snapshot). Reject: cancel that pending sub only.                                                         | Can spend only on **active + non-expired** sub |
| 9   | **Credits & expiry**         | Spend unit = remaining credits. Soft gate: `endDate >= now` on create/revision. Cron: ~day-7 warning, then deactivate + expired notify. Cancel sub = **immediate** cut-off. No staff top-up / credit refund helpers in product UI. | Dashboard + shell credits chip                 |
| 10  | **Create request**           | Active sub; package includes service; base + attribute credits (file/voice add 0); contact-leak scan on title/desc (strict) and Q&A text (brief). Staff may create on behalf (same deduct).                                        | `/client/requests/new` → status `PENDING`      |
| 11  | **Collaborate**              | Messaging after provider assigned; unread flags; contact-leak on messages.                                                                                                                                                         | Request detail thread                          |
| 12  | **Delivery SLA**             | On deliver: `deliveredAt`. 1h → client reminder. 12h → `needsManualApproval` (client + staff UI). PM/SA may **Approve for client** from admin request detail.                                                                      | Reminder + staff complete path                 |
| 13  | **Revision**                 | Free allowance then paid cost (requires active sub). Feedback scanned for leaks **before** status/credit change.                                                                                                                   | `DELIVERED` ⇄ `REVISION_REQUESTED`             |
| 14  | **Approve + settle**         | Client or staff-on-behalf approve → `COMPLETED`; provider wallet hold starts (7 days). Approve does **not** require an active subscription.                                                                                        | Provider (+ client if staff) notified          |
| 15  | **Rate**                     | Once per completed request; optional review text (leak-scanned).                                                                                                                                                                   | Reputation signal for provider                 |
| 16  | **Notify / profile**         | In-app + email + SSE. Locale switcher updates `preferredLocale`. Currency switcher is **display-only** (USD stored; EGP presentation rate).                                                                                        | `/client/notifications`, `/client/profile`     |

**Side exits (do not skip in ops training)**

- Reject → re-apply; admin deactivate (`deletedAt`) blocks login without wiping credits.
- Staff soft-delete request → `CANCELLED` + hidden; **no credit refund**; restore clears `deletedAt` but status stays cancelled.
- Upgrade: unused credits on the deactivated prior plan are **not** carried to the new paid plan.
- Expiry mid-request: new spend/revisions blocked; in-flight work and client approve still allowed.
- Dead segment: `/client/topup` (no page). Self `deleteAccount` API exists without client UI.

---

## Request lifecycle (operational view)

Requests move through statuses such as **pending**, **in progress**, **delivered**, **revision requested**, **completed**, and **cancelled** (see `RequestStatus` in the schema). Typical expectations:

1. **Creation** — Client spends credits according to service rules; optional attachments and structured answers are stored on the request. **Request managers / super admins** may also create a request **on behalf of an approved client** (Admin → Requests → Create Request): the **client** is required, an optional **provider** can be assigned at create time, and the same validations apply (active subscription, package includes the service, sufficient remaining credits). Credits are always deducted from the **client’s** subscription; the staff actor is recorded in the activity log.
2. **Assignment** — A provider may be linked to the request (at creation or later via assign/unassign); “available” listings help providers discover unassigned work where the product supports it.
3. **Active work (provider concurrency)** — A provider may actively work on **one** request at a time (`IN_PROGRESS` or `REVISION_REQUESTED`). Delivering frees the slot. Exception: if they have a **revision requested**, they may also start **one** additional `IN_PROGRESS` job (revision + one new). Assigned-but-not-started (`PENDING`) and `DELIVERED` (awaiting client) do not consume the slot.
4. **Collaboration** — **Comments** support messages, system lines, and deliverable-style posts; unread flags support inbox-style UX. Free-text fields (request title/description, messages, revision feedback, deliverables) are scanned for **off-platform contact leaks** (phone/email, WhatsApp/Telegram/LinkedIn/etc. links, handles, solicitation phrases in EN/AR) — including common **obfuscation** (spaced/spoken digits, `at`/`dot` emails, `w.h.a.t.s.a.p.p`, Arabic-Indic digits) — and rejected so client–provider work stays on Wengz. **Super admins are exempt** (ops/testing). Q&A answers still allow bare phones/emails when they belong on the artwork, but block chat-app outreach. Each block writes `security.contact_leak` to **Activity** (warn); after **5** blocks in **15 minutes** the user is rate-limited (`security.contact_leak_rate_limited`) and request managers are notified. Super admins and project managers review these events on **Admin → Contact leaks** (`/admin/contact-leaks`) and can **Clear strikes** to lift a false-positive lockout (`security.contact_leak_cleared`).
5. **Delivery approval SLA** — When work is **delivered**, `deliveredAt` is recorded. If the client has not approved within **1 hour**, they receive a reminder email/notification. If still not approved after **12 hours**, the request is flagged `needsManualApproval` (visible to client and staff). **Project managers / super admins** can **Approve for client** from the admin request detail (settles provider earnings; notifies client + provider). There is no automatic approve.
6. **Completion and reputation** — A **rating** can tie to a completed request, feeding provider quality signals.

**Watchers** on a request allow additional stakeholders to follow activity where the product uses that relation.

**Audit / activity log** — every request lifecycle mutation writes an immutable `ActivityLog` row (`entityType: Request`) with actor, role, timestamp, and optional **reason/note** when the user supplied one (revision feedback, deliverable message, review text). Chat messages log metadata only (`commentId`, length) — full text stays in `RequestComment`. Covered actions include create (client or staff-on-behalf), claim, admin assign/unassign, accept, start work, status/deliver, revision, approve, message, rate, soft-delete, restore. Cron approval work is summarized in a single `cron.deliveredApprovals` row. Super admins review this under **Activity**; filter by `request.` or a request id.

---

## Notifications and channels

The business relies on **timely, localized** communication:

- **In-app** notifications (stored per user, read/unread).
- **Email** and **in-app** notifications localized to each **recipient’s** `preferredLocale` (not the acting staff session language).

Operational jobs (e.g. **subscription expiry warnings**, **delivered-approval reminders**, **provider earnings hold release**) are designed to run on a schedule via HTTP **cron** endpoints; see `src/app/api/cron/check-subscriptions/route.ts`, `src/app/api/cron/check-delivered-approvals/route.ts`, `src/app/api/cron/release-provider-holds/route.ts`, and your hosting provider’s scheduler.

---

## Trust, safety, and compliance (surface level)

- User records support **soft delete** (`deletedAt`) and **registration IP** for abuse-oriented workflows.
- **Self-serve signup** (client register + creator/provider form) creates users with `approvalStatus: PENDING`. They cannot sign in until an admin **approves** (free trial + welcome email run on approve for clients). Admin-created users are **APPROVED** immediately. Soft-delete remains a separate deactivate path from pending/rejected.
- **System settings** (`SystemSettings` key/value) allow storing configurable policy without code changes for supported keys.

**Maintenance mode** — when enabled (super admin only toggle), **clients and providers** cannot log in; **all staff** (super admin, project manager, finance manager) may still sign in.

For legal, finance, and DPA details, extend this document in your own wiki; the codebase reflects **technical** enforcement points, not regulatory advice.

---

## Role capability matrix (implemented)

| Capability                                      | Client | Provider | PM  | FM  | Super admin |
| ----------------------------------------------- | :----: | :------: | :-: | :-: | :---------: |
| Self-serve register / apply (PENDING)           |   ✓    |    ✓     |     |     |             |
| Buy / manage subscription + payment proof       |   ✓    |          |     | ✓\* |     ✓\*     |
| Create / revise / approve / rate requests       |   ✓    |          | ✓†  |     |     ✓†      |
| Approve delivered on behalf of client           |        |          |  ✓  |     |      ✓      |
| Claim / start / deliver work + wallet           |        |    ✓     |     |     |             |
| Assign / unassign / create-on-behalf / soft-del |        |          |  ✓  |     |      ✓      |
| Contact-leak review + clear strikes             |        |          |  ✓  |     |      ✓      |
| Withdrawals / disputes / payouts / finance set. |        |    ✓‡    |     |  ✓  |      ✓      |
| Users, packages, services, activity, contacts   |        |          |     |     |      ✓      |
| Maintenance mode toggle                         |        |          |     |     |      ✓      |

\* Review / configure only (not client purchase).  
† Staff create-on-behalf, messaging oversight, and approve-on-behalf for stuck DELIVERED; clients still own rate.  
‡ Provider opens withdrawal/dispute; FM/SA reviews.

---

## Known gaps / backlog (from role audit)

Documented so product and engineering stay aligned; not every schema field is a shipped feature.

| Gap                               | Notes                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Request watchers**              | `RequestWatcher` exists in Prisma; no manage UI/API for adding stakeholders.                                                   |
| **Public contact inbox vs PM**    | Contact-form notifications may target PMs, but `/admin/contacts` is **super-admin only** — grant ACL or stop notifying PMs.    |
| **Priority pricing UI**           | Schema has per-service priority credit costs; create-request currently stores `priorityCreditCost: 0` (not client-selectable). |
| **Card / Fawry / Meeza rails**    | Shown as Coming soon; only bank transfer + InstaPay are live.                                                                  |
| **WhatsApp notification channel** | Not a live outbound channel; knowledge copy must not promise it.                                                               |
| **Object storage**                | Uploads are local disk today; remote hosts are configured for future S3/B2.                                                    |
| **Credit refunds**                | No refund on staff cancel request or subscription cancel; `addCredits` helper unused.                                          |
| **Upgrade credit carry**          | Approving a paid plan deactivates the prior active plan without moving leftover credits.                                       |
| **Subscription cache**            | Client subscribe/cancel may leave shell credits stale until TTL or payment approve.                                            |
| **Maintenance session eviction**  | Toggle blocks new client login; existing client JWTs keep working until expiry.                                                |

---

## Glossary

| Term                | Meaning                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Credit**          | Spendable unit from an active subscription used to create or extend request work                                    |
| **Package**         | Sellable bundle of credits + duration (+ optional service scope)                                                    |
| **Service type**    | Configurable line of work with pricing, attributes, and revision rules                                              |
| **Request**         | A unit of client–provider work tracked through statuses, comments, and ratings                                      |
| **Payment proof**   | Client-submitted evidence for manual verification of off-platform payment                                           |
| **Provider wallet** | Provider earnings from completed requests (available + 7-day hold + withdrawal pending), tracked in credits and USD |
| **Withdrawal**      | Provider request (or admin-recorded payout) reviewed manually with status + reason                                  |

---

## Related documents

- `docs/ADVANCED_TECHNICAL.md` — architecture, i18n wiring, and implementation map (includes notification and toast pointers)
