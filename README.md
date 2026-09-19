# internal-tools — Fintech Ops Console (KYC review queue + read-only refunds view)

**TLDR To run it:** `npm ci && npm run setup:demo && npm run dev` → http://localhost:3000.
Sign in as `reviewer@example.com` / `reviewer-demo-pass`. Details in
[Quick start](#quick-start).

A prototype internal tool built to evaluate whether engineers can build and own
tools like this in-house. Two modules exist:

- **KYC review queue** — reviewers approve or reject pending cases with a
  required reason, and every decision is recorded in an append-only history.
- **Refunds (read-only)** — a table of seeded refund requests with a status
  filter. It was added to check that the shared layout, auth, authorization
  helpers, database setup and table components can be reused by a second
  module. It has no actions: nothing in the app can approve, edit or pay a refund.

> **Demo — synthetic data only.** Every case, name and email in this repo is
> fictional. There are no real identity documents or personal data.

## Prerequisites

- Node.js >= 24 (see `.nvmrc`; run `nvm use` to select it). Developed on
  Node 24.19.0; the clean-start sequence below was last verified on
  Node 24.21.0 / npm 11.19.0.
- npm (ships with Node). No Docker, cloud accounts, or API keys are needed.

## Quick start

```bash
npm ci
npm run setup:demo   # creates .env if missing, applies migrations, seeds demo data
npm run dev          # http://localhost:3000
```

`setup:demo` is repeatable and non-destructive: it only creates rows that do not
already exist, so decisions you have made in the demo are kept.

### After pulling new commits

Run `npm ci` again. `npm ci` (and `npm install`) regenerates the Prisma client
via the `postinstall` script, so the generated client always matches
`prisma/schema.prisma`. `npm run setup:demo` and `npm test` also regenerate the
client themselves before seeding, so an existing checkout with a stale client
(for example one that predates a newly added model) recovers on its own.

### Demo accounts

| Role     | Email                  | Password             | Can do                                                    |
| -------- | ---------------------- | -------------------- | --------------------------------------------------------- |
| viewer   | `viewer@example.com`   | `viewer-demo-pass`   | Read cases and history; read refund requests              |
| reviewer | `reviewer@example.com` | `reviewer-demo-pass` | Read, and approve/reject pending cases; read refund requests |

Roles are attached to the account in the database and read from the server-side
session. There is no role switcher; sign out and sign in as the other account.

These are **local demo accounts only**. They are not enterprise SSO, MFA,
employee provisioning/deprovisioning, or production identity management. Public
sign-up is disabled; accounts are created only by the seed script.

## Commands

| Command                            | What it does                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run setup:demo`               | Create `.env` (if missing) with a random `BETTER_AUTH_SECRET`, `prisma generate`, `prisma migrate deploy`, seed accounts + cases + refunds |
| `npm run reset:demo:destructive`   | **Destructive.** Drops `prisma/dev.db`, re-applies all migrations and re-seeds. All demo decisions are lost.     |
| `npm run dev`                      | Start the Next.js dev server                                                                                   |
| `npm run build` / `npm start`      | Production build / serve                                                                                       |
| `npm run typecheck`                | `tsc --noEmit` (strict)                                                                                        |
| `npm test`                         | Vitest suite against the real route handlers on an isolated `prisma/test.db`                                    |
| `npm run db:migrate`               | `prisma migrate dev` (development schema changes)                                                              |

### Clean-start verification

The sequence used to verify a fresh clone with a fresh database (no `.env`,
no `prisma/*.db`, no `node_modules`):

```bash
git clone https://github.com/gracez03/internal-tools.git && cd internal-tools
npm ci                          # postinstall runs prisma generate
npm run setup:demo              # .env + migrations + seed (fresh prisma/dev.db)
npm run typecheck
npm test                        # isolated prisma/test.db, 47 tests
npm run build
npm start                       # http://localhost:3000 — sign in with a demo account
npm run reset:demo:destructive  # optional: wipe prisma/dev.db and re-seed
```

Note: `npm test` prints several `prisma:error` lines. These are expected — the
append-only tests attempt UPDATE and DELETE against case_history and assert
the database trigger rejects them. The suite passes 47/47.

### Environment

Copy `.env.example` to `.env` (or let `setup:demo` do it). Variables:

- `DATABASE_URL` — SQLite file, default `file:./dev.db` (relative to `prisma/`)
- `BETTER_AUTH_SECRET` — session signing secret. Never commit the real value.
- `BETTER_AUTH_URL` — base URL used for Better Auth origin checks, default `http://localhost:3000`

`.env`, `prisma/*.db` and `.next/` are git-ignored.

## What the app does

- **Login** (`/login`) — Better Auth email/password. Wrong credentials show an
  error; sign-up returns `400` because it is disabled.
- **Queue** (`/cases`) — 20 seeded cases with search (ID, name, email) and
  status / risk filters. Pending cases sort first. Empty state when nothing matches.
- **Case detail** (`/cases/[id]`) — case fields, decision panel and full
  history (who, when, previous → new status, reason). 404 page for unknown IDs.
- **Decide** — reviewers approve or reject a *pending* case with a required
  reason (3–1000 chars, trimmed). Viewers see an explanatory notice instead of
  the form. Decided cases show "Decisions are final" and no form.
- **Persistence** — decisions live in SQLite and survive refresh and restart.
- **States** — client validation, loading (`loading.tsx`), empty, 404, error
  boundary (`error.tsx`), and network / conflict errors on the decision form.
- **Refunds** (`/refunds`) — read-only table of 10 seeded refund requests
  (request ID, customer, amount in cents, currency, status, requested date,
  reason) with a status filter. Both roles can read it; unauthenticated
  requests to the page redirect to `/login` and to `GET /api/refunds` get `401`.
  There is no detail page and no write endpoint.
- A persistent **"Demo — synthetic data only"** banner is shown on every page.

### Capability status

**Implemented (real logic, tested):**

- Email/password login with server-side sessions (Better Auth); sign-up disabled
- Two roles (`viewer`, `reviewer`) with a server-enforced permission map
- KYC queue with search and status/risk filters; case detail with history
- Approve/reject of pending cases with a required reason; pending-only
  transition; conflict (`409`) on repeated, stale or concurrent decisions
- Append-only decision history (transactional write + SQLite triggers) that
  snapshots the actor's id, email, name and role at decision time
- Read-only refunds table with a status filter and `GET /api/refunds`
- Same-origin check on the decision endpoint
- Idempotent demo setup, destructive reset, isolated test database

**Simulated (synthetic stand-ins, no real integration):**

- KYC cases: seeded fictional applicants with a free-text `summary` and a
  pre-assigned risk level. There is no document upload, identity verification,
  sanctions/PEP screening or risk scoring — the case *is* the seed row.
- Refund requests: 10 seeded rows. No payment processor, ledger or money movement.
- Users: two seeded demo accounts. No directory, SSO or provisioning.

**Not built:**

- Any write path for refunds (approve/reject/pay), refund detail page
- Admin UI for users/roles, password reset, MFA, session management
- Pagination, sorting controls, bulk actions, case assignment, SLA timers,
  comments or attachments
- Generic audit log beyond `case_history`; audit of logins
- CI configuration, deployment configuration, monitoring

## Architecture

```
prisma/
  schema.prisma            Better Auth tables + KycCase + CaseHistory + RefundRequest
  migrations/*/migration.sql  includes the append-only triggers on case_history
  seed.ts, seed-data.ts    demo accounts (Better Auth password hashing) + 20 cases + 10 refunds
scripts/
  setup-demo.ts            non-destructive setup;  reset-demo.ts  destructive reset
src/lib/                   SHARED foundation (see note below)
  db.ts                    Prisma singleton (globalThis guard)
  auth.ts                  Better Auth instance: Prisma adapter, sign-up disabled,
                           `role` field with input:false so clients can't set it
  session.ts               Actor {id,email,name,role} derived only from the session
  authz.ts                 Permission map per role; can() / requirePermission()
  history.ts               appendHistory(tx, actor, entry) — the only history writer
  errors.ts                AppError (401/403/404/400/409) + JSON error responses
src/modules/kyc/           KYC-SPECIFIC business logic
  types.ts                 Zod schemas: statuses, risk levels, decision input, filters
  service.ts               listCases / getCaseWithHistory / decideCase
src/modules/refunds/       REFUNDS (read-only)
  types.ts                 Zod schema: refund statuses, status filter parsing
  service.ts               listRefunds — the module's only operation
src/app/
  login/                   login page + client form
  cases/                   queue (server component) + filters, loading, error
  cases/[id]/              detail page, DecisionForm (client), not-found
  refunds/                 read-only table (server component) + status filter, loading, error
  api/auth/[...all]        Better Auth handler
  api/cases, api/cases/[id], api/cases/[id]/decision   JSON endpoints
  api/refunds              GET only
src/components/            AppHeader, DemoBanner, Badge, DataTable, Alert, SignOutButton
tests/                     Vitest: authz, decisions, queue-filters, refunds-read, global-setup
```

`history.ts` is the exception: it writes KYC case history and is coupled to
the KycCase model. Generalising it is a design decision the next module that
needs history will have to make.

### Where the security-relevant logic lives

| Concern | File(s) |
| --- | --- |
| Actor derived from the session only (`{id, email, name, role}`) | `src/lib/session.ts` |
| Permission map + `can` / `requirePermission` (401 / 403) | `src/lib/authz.ts` |
| Better Auth config (`disableSignUp`, `role` field `input: false`) | `src/lib/auth.ts` |
| Decision logic (validation, pending-only transition, transaction, 409) | `src/modules/kyc/service.ts` → `decideCase` |
| Refunds read (permission check, no writes) | `src/modules/refunds/service.ts` → `listRefunds` |
| History writes (the only writer; transaction client only) | `src/lib/history.ts` → `appendHistory`; seed rows in `prisma/seed.ts` |
| Append-only triggers on `case_history` | `prisma/migrations/20260918181319_init/migration.sql`, `prisma/migrations/20260918201300_history_actor_snapshot/migration.sql` |
| Entry points that call the above | `src/app/api/cases/**`, `src/app/api/refunds/route.ts`, `src/app/cases/**`, `src/app/refunds/page.tsx` |

### Authorization

Every protected read and every mutation goes through `requirePermission(actor,
permission)` inside `src/modules/kyc/service.ts` and
`src/modules/refunds/service.ts`, where `actor` is produced by
`src/lib/session.ts` from the Better Auth session cookie. Pages, route handlers
and tests all call the same service functions, so hiding a button in the UI is
never the only check. The request body is parsed with a strict Zod schema that
only knows `decision` and `reason`; any `role`, `actorId`, `createdAt` or
similar fields in the body or headers are ignored. Better Auth's CSRF/origin
protection is left on, and `POST /api/cases/[id]/decision` additionally rejects
requests whose `Origin` host does not match the request host.

### Decision integrity

`decideCase` (in `src/modules/kyc/service.ts`):

1. requires `cases:decide` (reviewer only)
2. validates `{ decision: "approve" | "reject", reason }` server-side
3. returns `409 conflict` if the case is not `pending` (no reopening, no changing)
4. in one `prisma.$transaction`: `updateMany({ where: { id, status: "pending" } })`
   — if that touches 0 rows (a concurrent decision won), the transaction throws
   `409` and rolls back; otherwise it appends exactly one history row via
   `src/lib/history.ts`.

Actor and timestamps come from the session and the server clock. Each history
row snapshots the actor's id, email, name and role at decision time; the
history view renders only those snapshot columns, so later changes to the user
row (rename, role change) do not alter what past decisions show. The
`case_history` table has `BEFORE UPDATE` / `BEFORE DELETE` triggers that
`RAISE(ABORT)` (see the migration SQL), and no endpoint edits or deletes history.
This is **not** tamper-proof or compliance-grade: anyone with access to the
SQLite file can change or drop the triggers and rows.

### Shared vs module-specific code

- Shared, module-agnostic: `src/lib/` (db, auth, session, authz, error helpers)
  and `src/components/`. `history.ts` lives there but is coupled to the
  KycCase model — see the note under Architecture.
- KYC-specific: `src/modules/kyc/`, `src/app/cases/**`, `src/app/api/cases/**`,
  the `KycCase`/`CaseHistory` models and the seed data.
- Refunds-specific: `src/modules/refunds/`, `src/app/refunds/**`,
  `src/app/api/refunds/route.ts`, the `RefundRequest` model and its seed data.

The refunds module followed the layout the KYC module established
(`src/modules/<name>/` + `src/app/<name>/**` + `src/app/api/<name>/**`, one
Prisma model, one permission registered in `src/lib/authz.ts`) and reused the
session/authz helpers, the Prisma singleton, `AppHeader`, `DataTable` and
`StatusBadge` unchanged apart from adding a nav and one badge tone. It did not
need the history writer because it performs no writes; whether `history.ts`
generalises to a second table remains untested.

## Tests

`npm test` runs `prisma migrate reset --force` against `prisma/test.db`
(migrations + seed) and then exercises the route handlers directly with real
sessions obtained from Better Auth. Covered:

- unauthenticated requests get `401` on list, detail and decision; forged
  session cookie is rejected
- viewer can read; viewer's decision request is `403` and changes no data,
  including when it supplies `role`/`actorId` in the body or headers
- reviewer can approve/reject a pending case with a valid reason; history row
  has the correct actor, reason, previous and new status, server timestamp
- blank, whitespace, too-short, missing, non-string reasons and invalid /
  missing decisions are `400`; non-JSON body is `400`; unknown case is `404`
- client-supplied actor, role, timestamps and statuses are ignored
- repeated / stale decisions return `409`, do not overwrite, add no history row;
  seeded decided cases cannot be reopened; two concurrent decisions produce
  exactly one success and one history row
- cross-origin decision requests are `403`
- `UPDATE`/`DELETE` on `case_history` fail at the database level
- changing the reviewer's name/role after a decision does not change the
  actor shown in that case's history
- queue filters: one invalid `status`/`risk`/`q` value is ignored and reported
  without dropping the other, valid filters
- refunds: unauthenticated and forged-cookie requests get `401` with no data;
  viewer and reviewer both get all 10 seeded rows with every field; status
  filter works for each status, an invalid status is ignored and reported, an
  empty status is no filter; the route module exports `GET` only; reads change
  no rows; adding `refunds:read` left KYC permissions unchanged

Not covered by automated tests: an authenticated cross-origin request from a
real browser session (only the route-handler test with a foreign `Origin`
header covers this).

## Limitations / production gaps (factual)

- Local email/password demo accounts only; no SSO, MFA, provisioning, password
  reset, session management UI, or audit of logins.
- Roles are two hard-coded strings on the user row; no admin UI to manage them.
- SQLite single file; no backups, replication, or row-level encryption. The
  append-only trigger protects against application bugs, not against anyone
  with file access.
- No pagination (20 seeded rows), no sorting controls, no bulk actions, no
  assignment/ownership of cases, no SLA timers, no comments/attachments.
- No rate limiting, request logging, or monitoring beyond console output.
- History is scoped to KYC cases; a generic audit log for other modules is not
  built. The refunds view has no history because it has no actions.
- Refunds are read-only seeded rows: no approval, payment provider, money
  movement, detail page, pagination or search.
- No CI configuration is included in this repository.
