import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET as listCases } from "@/app/api/cases/route";
import { GET as getCase } from "@/app/api/cases/[id]/route";
import { POST as decide } from "@/app/api/cases/[id]/decision/route";
import { REVIEWER, VIEWER, jsonRequest, params, signIn } from "./helpers";

let viewerCookie: string;
let reviewerCookie: string;

beforeAll(async () => {
  viewerCookie = await signIn(VIEWER);
  reviewerCookie = await signIn(REVIEWER);
});

describe("unauthenticated access", () => {
  it("cannot list cases", async () => {
    const res = await listCases(jsonRequest("/api/cases"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.cases).toBeUndefined();
    expect(body.error.code).toBe("unauthorized");
  });

  it("cannot read a case or its history", async () => {
    const res = await getCase(jsonRequest("/api/cases/KYC-1004"), params("KYC-1004"));
    expect(res.status).toBe(401);
    expect((await res.json()).case).toBeUndefined();
  });

  it("cannot decide a case", async () => {
    const before = await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1001" } });
    const res = await decide(
      jsonRequest("/api/cases/KYC-1001/decision", {
        method: "POST",
        body: { decision: "approve", reason: "anonymous approval attempt" },
      }),
      params("KYC-1001"),
    );
    expect(res.status).toBe(401);
    const after = await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1001" } });
    expect(after.status).toBe(before.status);
    expect(await prisma.caseHistory.count({ where: { caseId: "KYC-1001" } })).toBe(0);
  });

  it("rejects a forged session cookie", async () => {
    const res = await listCases(
      jsonRequest("/api/cases", { cookie: "better-auth.session_token=forged.token" }),
    );
    expect(res.status).toBe(401);
  });
});

describe("viewer role", () => {
  it("can list and read cases with history", async () => {
    const list = await listCases(jsonRequest("/api/cases", { cookie: viewerCookie }));
    expect(list.status).toBe(200);
    expect((await list.json()).cases.length).toBe(20);

    const one = await getCase(
      jsonRequest("/api/cases/KYC-1004", { cookie: viewerCookie }),
      params("KYC-1004"),
    );
    expect(one.status).toBe(200);
    const body = await one.json();
    expect(body.case.status).toBe("approved");
    expect(body.case.history).toHaveLength(1);
    expect(body.case.history[0].actorEmail).toBe(REVIEWER.email);
  });

  it("is forbidden from deciding and changes no data", async () => {
    const res = await decide(
      jsonRequest("/api/cases/KYC-1001/decision", {
        method: "POST",
        cookie: viewerCookie,
        body: { decision: "approve", reason: "viewer trying to approve" },
      }),
      params("KYC-1001"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
    const c = await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1001" } });
    expect(c.status).toBe("pending");
    expect(c.decidedAt).toBeNull();
    expect(await prisma.caseHistory.count({ where: { caseId: "KYC-1001" } })).toBe(0);
  });

  it("cannot escalate by supplying a role or actor in the body", async () => {
    const res = await decide(
      jsonRequest("/api/cases/KYC-1001/decision", {
        method: "POST",
        cookie: viewerCookie,
        body: {
          decision: "approve",
          reason: "escalation attempt",
          role: "reviewer",
          actorId: REVIEWER.id,
          actorEmail: REVIEWER.email,
          user: { role: "reviewer" },
        },
      }),
      params("KYC-1001"),
    );
    expect(res.status).toBe(403);
    const c = await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1001" } });
    expect(c.status).toBe("pending");
    expect(await prisma.caseHistory.count({ where: { caseId: "KYC-1001" } })).toBe(0);
  });

  it("cannot escalate via headers either", async () => {
    const res = await decide(
      jsonRequest("/api/cases/KYC-1001/decision", {
        method: "POST",
        cookie: viewerCookie,
        headers: { "x-user-role": "reviewer", "x-user-id": REVIEWER.id },
        body: { decision: "approve", reason: "header escalation attempt" },
      }),
      params("KYC-1001"),
    );
    expect(res.status).toBe(403);
  });
});

describe("cross-origin protection on the decision endpoint", () => {
  it("rejects a reviewer request from a foreign origin", async () => {
    const res = await decide(
      jsonRequest("/api/cases/KYC-1001/decision", {
        method: "POST",
        cookie: reviewerCookie,
        headers: { origin: "http://evil.example" },
        body: { decision: "approve", reason: "cross-site request" },
      }),
      params("KYC-1001"),
    );
    expect(res.status).toBe(403);
    const c = await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1001" } });
    expect(c.status).toBe("pending");
  });
});
