# Playbook: add a third module to the Fintech Ops Console

> **Status: derived, not validated.** This procedure is reconstructed from the
> two modules that exist (KYC review queue, PR #2; read-only refunds, PR #3) and
> the follow-up fixes (PR #4, PR #5). Nobody has yet built a third module by
> following it. Expect to amend it the first time it is used.

Procedure only. The stack, data, Prisma/SQLite, authorization and PR rules live
in the Knowledge notes ("Stack and scope constraints", "Prisma and SQLite
conventions", "Server-side authorization rules", "PR checklist") and are not
repeated here.

## 1. Read first

In this order, before writing anything:

1. `README.md` — "Shared vs module-specific code", "Where the security-relevant
   logic lives", "Capability status", "Limitations". This is the contract for
   what the foundation does and does not do.
2. The merged PRs, including their review threads: #2 (KYC, incl. the three
   Devin Review findings and the fixes), #3 (refunds — the smallest complete
   module and the template to copy), #4 (stale Prisma client fix).
3. Shared code you will call, not copy: `src/lib/authz.ts`, `src/lib/session.ts`,
   `src/lib/errors.ts`, `src/lib/db.ts`, and `src/lib/history.ts` only if the
   module writes decisions.
4. The refunds module end to end: `src/modules/refunds/{types,service}.ts`,
   `src/app/api/refunds/route.ts`, `src/app/refunds/*`, `tests/refunds-read.test.ts`.
5. If the module has a write/decision path: `src/modules/kyc/service.ts`
   (`decideCase`), `tests/decisions.test.ts`, `tests/authz.test.ts`.
6. `prisma/schema.prisma`, all three migrations (especially
   `20260918201300_history_actor_snapshot/migration.sql`), `prisma/seed.ts`,
   `prisma/seed-data.ts`.
7. `tests/helpers.ts`, `tests/global-setup.ts`, `vitest.config.ts`.

Then run the baseline on `main` and record the numbers before you change
anything: `npm ci && npm run setup:demo && npm run typecheck && npm test`
(47 tests at the time of writing). Note that `setup:demo` leaves a `.env` and
`prisma/dev.db` behind, and later `setup:demo` runs on your branch reuse them
(`migrate deploy` adds new migrations; the seed skips existing rows). `npm test`
is unaffected — it resets its own `prisma/test.db` — but before you smoke-test
`npm run dev` / `npm start` on the branch, or whenever you switch between
branches with different migrations, run `npm run reset:demo:destructive` so
the demo DB reflects the branch you are on.

## 2. Build order

This is the order we actually committed in. Each step is one commit; each
commit leaves `npm run typecheck` and `npm test` green.

**Read-only module (what PR #3 did):**

1. **Data:** Prisma model + `npx prisma migrate dev --name <module>` + ~10
   synthetic seed rows in `prisma/seed-data.ts`, seeded idempotently in
   `prisma/seed.ts` (check-then-create per row, like `seedRefunds`).
2. **Module + UI:** add the permission to `src/lib/authz.ts` (union + role sets);
   `src/modules/<module>/types.ts` (status list, Zod schema, per-field filter
   parser that returns `{ filters, invalid }` — copy `parseRefundListFilters`
   for a single filter, `parseCaseListFilters` in `src/modules/kyc/types.ts`
   for several, and bring its "keeps valid filters when another one is
   invalid" test with it); `src/modules/<module>/service.ts`
   whose every function starts with `requirePermission(actor, ...)`;
   `src/app/api/<module>/route.ts` exporting only the verbs the module needs;
   `src/app/<module>/{page,Filters,loading,error}.tsx`; nav item in
   `src/components/AppHeader.tsx`; reuse `DataTable`, `Badge`, `Alert`.
3. **Tests:** `tests/<module>-read.test.ts` (see §5).
4. **README:** what the module does, what it deliberately does not do, the new
   permission, and the updated test count.

**Module with a decision/write path (what PR #2 did, in five milestones):**

0. **Decide where its history goes before touching the schema.** The shared
   writer is not generic: `appendHistory` in `src/lib/history.ts` takes a
   `caseId` and always calls `tx.caseHistory.create`, and `case_history.caseId`
   is a foreign key to `kyc_case`. Passing a third module's entity id to it
   fails the foreign key (or, worse, points the row at an unrelated KYC case).
   Nothing has been built for this yet, so it is a scope decision for the
   reviewer, not something to pick silently. The two options are:
   - a module-specific history table (`<module>_history` with the same
     columns, its own append-only triggers in the migration SQL, and its own
     writer next to the service), or
   - generalising `case_history` / `appendHistory` to typed entities first, in
     its own PR, with the existing 47 tests still green.
   Either way the schema milestone below must include the history table and
   triggers, and the tests in §5 point at *that* table.
1. schema + migration (incl. the module's append-only trigger) + seed
2. auth working with both seeded accounts (already exists — skip unless the
   module needs a new role, which so far nothing has)
3. queue/list + detail, read-only
4. decide action: `requirePermission` → Zod parse → pending-only check →
   `$transaction` with conditional `updateMany` + the module's history writer
   (same shape as `appendHistory(tx, actor, …)`: transaction client only,
   actor snapshot from the session, `createdAt` from the DB default) → 409
   when `count !== 1`
5. tests

Open the PR after step 4/5 with the handoff, then run the browser test and fix
what it finds in separate commits.

## 3. Guardrails that had to be enforced by the reviewer

These are the corrections Grace actually made during the two builds and the
finalisation. A third module will hit the same ones.

- **Read before writing.** "Read the repo and both merged PRs before writing
  anything." Do step 1 fully; do not start from the prompt alone.
- **Scope is the prompt, nothing more.** No dashboards, charts, uploads,
  notifications, extra roles, generic module framework, plugin architecture,
  or "architectural abstractions". The refunds module was allowed a table, a
  status filter, a nav item and one GET route — and nothing else. When the
  work was declared finished: "Do not add functionality."
- **Do not broaden or weaken existing permissions.** Adding `refunds:read` had
  to leave `cases:read`/`cases:decide` untouched, and a test asserts it.
- **Milestone commits, one concern each, reported separately.** The decide
  endpoint landed inside the queue/detail commit in PR #2 and had to be
  disclosed as a miss. Review fixes were required to be one commit each.
- **Stop when told to stop.** "Don't proceed yet from here" and "Stop after
  this" mean exactly that. Before resuming after a review, list which
  acceptance criteria are still unverified and work only on those.
- **History must be fully immutable, including the actor's identity.**
  Snapshot `actorName`/`actorRole`, render only snapshot fields, and add a test
  proving a later role change does not alter what history shows (§4.3).
- **Report actual output, never a claim.** "Run it from a clean directory and
  report the actual commands and output." "DO NOT claim the clean-start check
  passed unless you actually ran it." Say which checks passed, failed and were
  not run — the browser cross-origin test in PR #2 was explicitly *not run* and
  recorded as a gap rather than glossed over.
- **Pin what you actually run on.** Node was pinned to 24 because that is what
  the build was verified on, not what the prompt originally said.
- **Describe it as what it is.** The refunds module is "a read-only module, not
  a refunds system"; history is "append-only", not "tamper-proof". No invented
  times, costs or security guarantees (a measured wall-clock time is fine when
  asked).
- **When the reviewer says a fix is missing, answer with file and line at the
  PR head** — Grace was looking at a stale diff for the actor-snapshot fix; the
  resolution was pointing at `src/lib/history.ts` and the migration, not
  re-arguing.

## 4. Things that actually went wrong — check these

### 4.1 Stale Prisma client on an existing checkout (PR #4)

After `git pull` brought in the `RefundRequest` model, `npm test` failed in
`prisma/seed.ts` with `Cannot read properties of undefined (reading
'findUnique')`: the generated client predated the new model, and the test
global-setup ran `prisma migrate reset --force --skip-generate`, so nothing
regenerated it. A fresh clone never saw this (`postinstall` runs
`prisma generate`).

Fixed by removing `--skip-generate` in `tests/global-setup.ts` and adding
`npx prisma generate` before `migrate deploy` in `scripts/setup-demo.ts`.

**Check when adding a model:** keep those two lines; after pulling a schema
change on an existing checkout run `npm ci` (or `npx prisma generate`) before
anything else; if a teammate reports that error, that is the cause.

### 4.2 The three Devin Review findings on the KYC PR (PR #2)

All three were real and all three patterns recur in any new module.

1. **Invalid filter clears valid filters** — one Zod object for all query
   params meant `?status=pending&risk=bogus` returned the whole queue. Fix:
   parse each param independently and return `{ filters, invalid }`; the API
   reports `invalidFilters`, the page names the ignored params.
   *Check:* your `types.ts` filter parser follows `parseRefundListFilters`,
   and `tests/queue-filters.test.ts` / `refunds-read.test.ts` have the
   "keeps valid filters when another is invalid" case.
2. **Reviewer history changes retroactively** — history rendered
   `h.actor.name` / `h.actor.role` through the relation, so renaming or
   downgrading a user rewrote how old decisions looked. Fix in §4.3.
   *Check:* if your module writes history, its writer snapshots
   `actorEmail`/`actorName`/`actorRole` the way `appendHistory` does, and
   nothing joins `user` for display.
3. **Failed sign-out redirects as success** — the client button ignored the
   result of `authClient.signOut()`. Fix: check `error`, catch transport
   failures, show an inline `Alert`, navigate only on success.
   *Check:* any client-side action button in the new module inspects the
   result before navigating.

### 4.3 The history actor-snapshot fix (`0ec1121`, migration `20260918201300_history_actor_snapshot`)

Adding `actorName`/`actorRole` as `NOT NULL` to `case_history` could not be
done in place on SQLite, so the migration rebuilds the table, backfills
existing rows from `user` via `LEFT JOIN`, and **recreates the append-only
triggers** — `DROP TABLE` silently removes them. `appendHistory` and the seed
write the full snapshot; the detail page renders only snapshot columns; the
response no longer contains an `actor` key.

**Check for any migration that touches `case_history`:** the triggers must be
present afterwards. `tests/decisions.test.ts` → "rejects UPDATE and DELETE on
case_history" and "history keeps the actor's name and role as they were at
decision time" are the regression guards; both must still pass.

### 4.4 Also seen

The Devin environment snapshot failed once because its maintenance step ran
`npm run setup:demo` against a `main` that predated the script. Not a repo
bug; a rebuild fixed it. If a Devin session starts with "environment build
incomplete", check that first.

## 5. Definition of done

Matches what the existing tests assert. Copy the structure; do not lower it.

**Every module (from `tests/refunds-read.test.ts`):**

- unauthenticated request → 401 and no module data: plain, forged session
  cookie, and with a filter present
- each role that is granted read can list every seeded row with all fields;
  money fields are integers; emails end in `example.com`
- ordering assertion matches the service's `orderBy`
- filter per allowed status returns only that status and echoes
  `filters` / `invalidFilters: []`
- invalid filter value is ignored and reported, full list returned
- empty filter value is treated as no filter
- the route module exports exactly the verbs intended (`["GET"]` for read-only)
- a read writes nothing (row snapshot before and after is deep-equal)
- adding the new permission did not change any existing role's permissions
  (`can()` assertions for every existing permission)

**Additionally, if the module has a decision path (from `tests/authz.test.ts`
and `tests/decisions.test.ts`):**

- unauthenticated cannot list, read, or decide; forged cookie rejected
- viewer can read; viewer decision → 403 and no data changes
- role/actor in body or headers cannot escalate
- reviewer request with a foreign `Origin` → 403
- validation table (blank / whitespace / too-short / missing / non-string
  reason; invalid / status-instead-of-decision / missing decision) → 400 and
  nothing changes; non-JSON body → 400; unknown id → 404
- approve and reject each record exactly one row in the module's history
  table with actor snapshot, reason, previous and new status
- renaming or downgrading the actor afterwards changes nothing in history or
  the API response
- client-supplied actor, role, timestamp are ignored
- repeated or stale submission → 409, no overwrite, no extra history row
- already-decided seeded row cannot be re-decided
- concurrent submissions → exactly one success and one history row
- `UPDATE` / `DELETE` on the module's history table are rejected by the
  database (the KYC assertion is in `tests/decisions.test.ts` → "rejects UPDATE
  and DELETE on case_history"; write the same test against the new table)

**Then, before the PR:**

- `npm run typecheck`, `npm test`, `npm run build` pass; `npm start` serves and
  the new routes answer as expected via curl (401 unauthenticated, 200 signed
  in)
- the clean-start sequence in README "Clean-start verification" was actually
  run from an empty directory on the PR head — or the PR says it was not
- PR body follows the "PR checklist" Knowledge note: reused vs edited vs new
  files, unspecified design decisions, anything skipped, the
  authorization / decision / history-write file map, exact check output, and
  which checks were not run
- README updated: module description, what it does not do, permission table,
  test count, security-logic map if any new file holds security logic
