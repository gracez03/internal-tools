import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { POST as decide } from "@/app/api/cases/[id]/decision/route";
import { GET as getCase } from "@/app/api/cases/[id]/route";
import { REVIEWER, VIEWER, jsonRequest, params, signIn } from "./helpers";

let reviewerCookie: string;

beforeAll(async () => {
  reviewerCookie = await signIn(REVIEWER);
});

const post = (id: string, body: unknown, cookie = reviewerCookie) =>
  decide(
    jsonRequest(`/api/cases/${id}/decision`, {
      method: "POST",
      cookie,
      headers: { origin: "http://localhost:3000" },
      body,
    }),
    params(id),
  );

describe("validation", () => {
  const CASE = "KYC-1003";

  it.each([
    ["blank reason", { decision: "approve", reason: "" }],
    ["whitespace reason", { decision: "approve", reason: "   \n\t " }],
    ["too-short reason", { decision: "reject", reason: "no" }],
    ["missing reason", { decision: "approve" }],
    ["non-string reason", { decision: "approve", reason: 42 }],
    ["invalid decision", { decision: "maybe", reason: "a valid reason" }],
    ["status instead of decision", { decision: "approved", reason: "a valid reason" }],
    ["missing decision", { reason: "a valid reason" }],
  ])("rejects %s with 400 and changes nothing", async (_label, body) => {
    const res = await post(CASE, body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation");
    const c = await prisma.kycCase.findUniqueOrThrow({ where: { id: CASE } });
    expect(c.status).toBe("pending");
    expect(await prisma.caseHistory.count({ where: { caseId: CASE } })).toBe(0);
  });

  it("rejects a non-JSON body", async () => {
    const res = await decide(
      jsonRequest(`/api/cases/${CASE}/decision`, {
        method: "POST",
        cookie: reviewerCookie,
        body: "decision=approve&reason=hello",
      }),
      params(CASE),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown case", async () => {
    const res = await post("KYC-9999", { decision: "approve", reason: "does not exist" });
    expect(res.status).toBe(404);
  });
});

describe("reviewer decisions", () => {
  it("approves a pending case and records actor, reason, statuses in one history row", async () => {
    const CASE = "KYC-1005";
    const before = Date.now();
    const res = await post(CASE, {
      decision: "approve",
      reason: "  Address change verified against utility bill.  ",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.case.status).toBe("approved");

    const c = await prisma.kycCase.findUniqueOrThrow({
      where: { id: CASE },
      include: { history: true },
    });
    expect(c.status).toBe("approved");
    expect(c.decidedAt).not.toBeNull();
    expect(c.decidedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(c.history).toHaveLength(1);
    const h = c.history[0]!;
    expect(h.actorId).toBe(REVIEWER.id);
    expect(h.actorEmail).toBe(REVIEWER.email);
    expect(h.actorName).toBe(REVIEWER.name);
    expect(h.actorRole).toBe(REVIEWER.role);
    expect(h.action).toBe("approved");
    expect(h.previousStatus).toBe("pending");
    expect(h.newStatus).toBe("approved");
    expect(h.reason).toBe("Address change verified against utility bill.");
    expect(h.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("rejects a pending case", async () => {
    const CASE = "KYC-1008";
    const res = await post(CASE, { decision: "reject", reason: "Phone country mismatch unresolved." });
    expect(res.status).toBe(200);
    const c = await prisma.kycCase.findUniqueOrThrow({ where: { id: CASE }, include: { history: true } });
    expect(c.status).toBe("rejected");
    expect(c.history).toHaveLength(1);
    expect(c.history[0]!.newStatus).toBe("rejected");
  });

  it("history keeps the actor's name and role as they were at decision time", async () => {
    const CASE = "KYC-1009";
    const res = await post(CASE, { decision: "approve", reason: "Documents consistent." });
    expect(res.status).toBe(200);

    const readHistory = async () => {
      const r = await getCase(jsonRequest(`/api/cases/${CASE}`, { cookie: reviewerCookie }), params(CASE));
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body.case.history).toHaveLength(1);
      return body.case.history[0] as Record<string, unknown>;
    };

    const before = await readHistory();
    expect(before).toMatchObject({ actorName: REVIEWER.name, actorRole: REVIEWER.role });
    expect(before).not.toHaveProperty("actor");

    try {
      await prisma.user.update({
        where: { id: REVIEWER.id },
        data: { name: "Renamed Person", role: "viewer" },
      });
      const after = await readHistory();
      expect(after).toMatchObject({
        actorName: REVIEWER.name,
        actorRole: REVIEWER.role,
        actorEmail: REVIEWER.email,
      });
      const row = await prisma.caseHistory.findFirstOrThrow({ where: { caseId: CASE } });
      expect(row.actorName).toBe(REVIEWER.name);
      expect(row.actorRole).toBe(REVIEWER.role);
    } finally {
      await prisma.user.update({
        where: { id: REVIEWER.id },
        data: { name: REVIEWER.name, role: REVIEWER.role },
      });
    }
  });

  it("ignores client-supplied actor, role and timestamp", async () => {
    const CASE = "KYC-1007";
    const res = await post(CASE, {
      decision: "approve",
      reason: "Returning applicant in good standing.",
      actorId: VIEWER.id,
      actorEmail: VIEWER.email,
      role: "admin",
      createdAt: "1999-01-01T00:00:00.000Z",
      decidedAt: "1999-01-01T00:00:00.000Z",
      previousStatus: "rejected",
      newStatus: "pending",
    });
    expect(res.status).toBe(200);
    const h = await prisma.caseHistory.findFirstOrThrow({ where: { caseId: CASE } });
    expect(h.actorId).toBe(REVIEWER.id);
    expect(h.actorEmail).toBe(REVIEWER.email);
    expect(h.previousStatus).toBe("pending");
    expect(h.newStatus).toBe("approved");
    expect(h.createdAt.getFullYear()).toBeGreaterThanOrEqual(2026);
    const c = await prisma.kycCase.findUniqueOrThrow({ where: { id: CASE } });
    expect(c.decidedAt!.getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it("a repeated or stale submission returns 409 and neither overwrites nor adds history", async () => {
    const CASE = "KYC-1011";
    const first = await post(CASE, { decision: "approve", reason: "Device fingerprint explained." });
    expect(first.status).toBe(200);
    const firstHistory = await prisma.caseHistory.findMany({ where: { caseId: CASE } });
    expect(firstHistory).toHaveLength(1);

    // Same decision again (double click / retry)
    const repeat = await post(CASE, { decision: "approve", reason: "Device fingerprint explained." });
    expect(repeat.status).toBe(409);
    expect((await repeat.json()).error.code).toBe("conflict");

    // Stale tab trying the opposite decision
    const stale = await post(CASE, { decision: "reject", reason: "Changed my mind later." });
    expect(stale.status).toBe(409);

    const c = await prisma.kycCase.findUniqueOrThrow({ where: { id: CASE }, include: { history: true } });
    expect(c.status).toBe("approved");
    expect(c.history).toHaveLength(1);
    expect(c.history[0]!.id).toBe(firstHistory[0]!.id);
    expect(c.history[0]!.reason).toBe("Device fingerprint explained.");
  });

  it("cannot reopen or re-decide an already-decided seeded case", async () => {
    for (const [id, status] of [
      ["KYC-1004", "approved"],
      ["KYC-1006", "rejected"],
    ] as const) {
      const res = await post(id, { decision: "reject", reason: "Trying to flip a final decision." });
      expect(res.status).toBe(409);
      const c = await prisma.kycCase.findUniqueOrThrow({ where: { id }, include: { history: true } });
      expect(c.status).toBe(status);
      expect(c.history).toHaveLength(1);
    }
  });

  it("concurrent decisions on one case yield exactly one success and one history row", async () => {
    const CASE = "KYC-1012";
    const [a, b] = await Promise.all([
      post(CASE, { decision: "approve", reason: "Concurrent approve." }),
      post(CASE, { decision: "reject", reason: "Concurrent reject." }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const c = await prisma.kycCase.findUniqueOrThrow({ where: { id: CASE }, include: { history: true } });
    expect(c.history).toHaveLength(1);
    expect(c.history[0]!.newStatus).toBe(c.status);
  });
});

describe("history is append-only at the database level", () => {
  it("rejects UPDATE and DELETE on case_history", async () => {
    const row = await prisma.caseHistory.findFirstOrThrow();
    // Prisma surfaces SQLITE_CONSTRAINT_TRIGGER as a generic constraint error;
    // the raw query exposes the trigger's message.
    await expect(
      prisma.caseHistory.update({ where: { id: row.id }, data: { reason: "tampered" } }),
    ).rejects.toThrow(/constraint/i);
    await expect(prisma.caseHistory.delete({ where: { id: row.id } })).rejects.toThrow(/constraint/i);
    await expect(
      prisma.$executeRawUnsafe(`UPDATE case_history SET reason = 'tampered' WHERE id = '${row.id}'`),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM case_history`)).rejects.toThrow(/append-only/);
    const still = await prisma.caseHistory.findUniqueOrThrow({ where: { id: row.id } });
    expect(still.reason).toBe(row.reason);
    expect(await prisma.caseHistory.count()).toBeGreaterThan(0);
  });
});
