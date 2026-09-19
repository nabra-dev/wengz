# Advanced guide — business domain (Wengz)

This document describes the **business model**, **actors**, and **core workflows** implemented in the product. It is aimed at product owners, operations, and engineers who need shared language for features and policy.

---

## Product positioning

**Wengz** is a **service marketplace** where clients purchase **subscription packages** denominated in **credits**, then spend those credits to open **requests** for configurable **service types** (e.g. design, development, media). **Providers** fulfill work; **super admins** configure the catalog, review certain money flows, and oversee the platform.

The application is **bilingual (English and Arabic)** end-to-end, including marketing surfaces, dashboards, transactional messaging, and notifications. UI copy lives in `messages/en.json` and `messages/ar.json`; toasts use `src/lib/error-handler.ts`, and outbound channels use `src/lib/notifications/` with **`locale`** aligned to the user (see `docs/ADVANCED_TECHNICAL.md`).

---

## Actors and permissions

| Role            | Typical use                                                                 | Access (conceptual)                                                                          |
| --------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Client**      | Buys packages, creates and tracks requests, messages, rates completed work  | Client dashboard: subscriptions, payment proof, requests, notifications, profile             |
| **Provider**    | Sees assigned or available work, delivers outputs, collaborates on threads, requests withdrawals | Provider dashboard: my requests, available jobs, wallet, notifications, profile |
| **Super admin** | Manages users, services, packages, requests oversight, payment verification, provider payouts | Admin dashboard: users, services, packages, subscriptions, requests, payments, finance, notifications |

Registration and login are **credential-based** (email/password). Role is fixed per user account and enforced both in the **edge layer** (route protection) and in **tRPC** (procedure-level middleware).

---

## Commercial model: packages and credits

- **Packages** bundle a **credit balance** and a **time-bounded entitlement** (`durationDays`, typically monthly). Packages may be scoped to **specific service types** or **support all services**, depending on catalog configuration.
- **Credits** are the **unit of spend** for opening and evolving requests. A **client subscription** stores **remaining credits** and an **end date**; inactive or expired subscriptions stop new spend unless business rules allow otherwise in code.
- **Free-trial semantics** exist in the data model (`isFreeTrialUsed`, `isFreePackage`) so the business can distinguish promotional or trial packages from paid tiers.

**Payment in the field**: clients submit **payment proofs** (e.g. bank transfer details and a receipt image) tied to a subscription; **admins** review and approve or reject. Until approved, downstream fulfillment rules should align with your operational policy (the schema supports `PaymentProof` with `PENDING` / `APPROVED` / `REJECTED`).

## Provider earnings and withdrawals

Completed request work is settled into a **provider wallet** (credits + USD) using two **global** settings (not per service):

- **Credit price (USD)** — value of one credit for settlement (e.g. `$1`).
- **Platform commission (%)** — share taken from gross settlement before the provider is credited (e.g. `10%`).

Example: a request costing `500` credits with `$1`/credit and `10%` commission settles as **$500** gross, **$50** platform, **$450** / **450** credits to the provider.

Providers store **payout details** (bank account or e-wallet number) and can **request a withdrawal**. That request holds the amount as pending until a super admin reviews it **manually**:

- **Approve / mark as paid** after sending the money off-platform, with a **reason** (for example a transfer reference).
- **Reject** with a **reason**, which returns the held funds to the available balance.

Admins can also **record a payout** against a provider’s available balance when they send money without a prior request. There is no automated payout gateway; operations handle the transfer, then record status and reason in the app.

Settlement value is independent of what the client paid for a **package**; packages remain the client subscription product.

---

## Service catalog and pricing logic

**Service types** are admin-configurable and drive:

- **Per-request credit cost** (base cost for that service).
- **Attributes** (structured Q&A, options, multiselect) that can **add to** the credit total.
- **Priority surcharges** (low / medium / high) expressed as additional credits per service configuration.
- **Revisions**: each service defines **free revision allowance**, **paid revision cost**, and whether paid revisions **reset** the free counter—so the business can tune quality-of-service vs. margin.
- **Max delivery**: each service defines a **maximum estimated delivery time in minutes**; providers cannot set a start-work estimate above that cap.

When a client creates a request, the system can persist **base**, **attribute**, and **priority** components of cost for auditing and display (`baseCreditCost`, `attributeCredits`, `priorityCreditCost`, `creditCost` on `Request`).

---

## Request lifecycle (operational view)

Requests move through statuses such as **pending**, **in progress**, **delivered**, **revision requested**, **completed**, and **cancelled** (see `RequestStatus` in the schema). Typical expectations:

1. **Creation** — Client spends credits according to service rules; optional attachments and structured answers are stored on the request.
2. **Assignment** — A provider may be linked to the request; “available” listings help providers discover unassigned work where the product supports it.
3. **Collaboration** — **Comments** support messages, system lines, and deliverable-style posts; unread flags support inbox-style UX.
4. **Completion and reputation** — A **rating** can tie to a completed request, feeding provider quality signals.

**Watchers** on a request allow additional stakeholders to follow activity where the product uses that relation.

---

## Notifications and channels

The business relies on **timely, localized** communication:

- **In-app** notifications (stored per user, read/unread).
- **Email** and **WhatsApp** where integrated, with templates that respect **locale** when invoked from server flows.

Operational jobs (e.g. **subscription expiry warnings**) are designed to run on a schedule via an HTTP **cron** endpoint; see `src/app/api/cron/check-subscriptions/route.ts` and your hosting provider’s scheduler.

---

## Trust, safety, and compliance (surface level)

- User records support **soft delete** (`deletedAt`) and **registration IP** for abuse-oriented workflows.
- **System settings** (`SystemSettings` key/value) allow storing configurable policy without code changes for supported keys.

For legal, finance, and DPA details, extend this document in your own wiki; the codebase reflects **technical** enforcement points, not regulatory advice.

---

## Glossary

| Term              | Meaning                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| **Credit**        | Spendable unit from an active subscription used to create or extend request work |
| **Package**       | Sellable bundle of credits + duration (+ optional service scope)                 |
| **Service type**  | Configurable line of work with pricing, attributes, and revision rules           |
| **Request**       | A unit of client–provider work tracked through statuses, comments, and ratings   |
| **Payment proof** | Client-submitted evidence for manual verification of off-platform payment        |
| **Provider wallet** | Provider earnings from completed requests, tracked in credits and USD          |
| **Withdrawal**    | Provider request (or admin-recorded payout) reviewed manually with status + reason |

---

## Related documents

- `docs/ADVANCED_TECHNICAL.md` — architecture, i18n wiring, and implementation map (includes notification and toast pointers)
