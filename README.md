# internal-tools — Fintech Ops Console (KYC review queue)

A prototype internal tool built to evaluate whether engineers can build and own
tools like this in-house. The first (and only) module is a **KYC review queue**:
reviewers approve or reject pending cases with a required reason, and every
decision is recorded in an append-only history.

> **Demo — synthetic data only.** Every case, name and email in this repo is
> fictional. There are no real identity documents or personal data.

## Prerequisites

- Node.js >= 24 (see `.nvmrc`; run `nvm use` to select it). Developed and
  verified on Node 24.19.0 / npm 11.
- npm (ships with Node). No Docker, cloud accounts, or API keys are needed.

## Quick start

```bash
npm ci
npm run setup:demo   # creates .env if missing, applies migrations, seeds demo data
npm run dev          # http://localhost:3000
```

`setup:demo` is repeatable and non-destructive: it only creates rows that do not
already exist, so decisions you have made in the demo are kept.

### Demo accounts

| Role     | Email                  | Password             | Can do                                   |
| -------- | ---------------------- | -------------------- | ---------------------------------------- |
| viewer   | `viewer@example.com`   | `viewer-demo-pass`   | Read cases and history                   |
| reviewer | `reviewer@example.com` | `reviewer-demo-pass` | Read, and approve/reject pending cases   |

Roles are attached to the account in the database and read from the server-side
session. There is no role switcher; sign out and sign in as the other account.

These are **local demo accounts only**. They are not enterprise SSO, MFA,
employee provisioning/deprovisioning, or production identity management. Public
sign-up is disabled; accounts are created only by the seed script.

## Commands

| Command                            | What it does                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run setup:demo`               | Create `.env` (if missing) with a random `BETTER_AUTH_SECRET`, `prisma migrate deploy`, seed accounts + cases   |
| `npm run reset:demo:destructive`   | **Destructive.** Drops `prisma/dev.db`, re-applies all migrations and re-seeds. All demo decisions are lost.     |
| `npm run dev`                      | Start the Next.js dev server                                                                                   |
| `npm run build` / `npm start`      | Production build / serve                                                                                       |
| `npm run typecheck`                | `tsc --noEmit` (strict)                                                                                        |
| `npm test`                         | Vitest suite against the real route handlers on an isolated `prisma/test.db`                                    |
| `npm run db:migrate`               | `prisma migrate dev` (development schema changes)                                                              |

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
- A persistent **"Demo — synthetic data only"** banner is shown on every page.

## Architecture

```
prisma/
  schema.prisma            Better Auth tables + KycCase + CaseHistory
  migrations/*/migration.sql  includes the append-only triggers on case_history
  seed.ts, seed-data.ts    demo accounts (Better Auth password hashing) + 20 cases
scripts/
  setup-demo.ts            non-destructive setup;  reset-demo.ts  destructive reset
src/lib/                   SHARED foundation (no KYC knowledge)
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
src/app/
  login/                   login page + client form
  cases/                   queue (server component) + filters, loading, error
  cases/[id]/              detail page, DecisionForm (client), not-found
  api/auth/[...all]        Better Auth handler
  api/cases, api/cases/[id], api/cases/[id]/decision   JSON endpoints
src/components/            AppHeader, DemoBanner, Badge, DataTable, Alert, SignOutButton
tests/                     Vitest: authz.test.ts, decisions.test.ts, global-setup.ts
```

### Authorization

Every protected read and every mutation goes through `requirePermission(actor,
permission)` inside `src/modules/kyc/service.ts`, where `actor` is produced by
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

### Shared vs KYC-specific code, and where a second tool would go

- Shared, module-agnostic: everything in `src/lib/` (db, auth, session, authz,
  history writer, error helpers) and `src/components/`.
- KYC-specific: `src/modules/kyc/`, `src/app/cases/**`, `src/app/api/cases/**`,
  the `KycCase`/`CaseHistory` models and the seed data.

A second module (e.g. a chargeback or refund queue) would slot in as
`src/modules/<name>/` + `src/app/<name>/**` + `src/app/api/<name>/**`, add its
own Prisma models, register its permissions in `src/lib/authz.ts`, and reuse
the session/authz helpers, the history writer pattern, and the layout/table/
badge/form components. This reuse is a design intent, **not yet proven** — only
one module exists. Note that `history.ts` currently writes to `case_history`
with a `caseId`; a second module would either generalise that table or add its
own history table using the same writer pattern and trigger.

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
  built.
- No CI configuration is included in this repository.
- Only one module exists; the "shared foundation" has not been exercised by a
  second tool.
