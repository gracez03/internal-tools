import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { can } from "@/lib/authz";
import * as refundsRoute from "@/app/api/refunds/route";
import { REFUND_STATUSES } from "@/modules/refunds/types";
import { SEED_REFUNDS } from "../prisma/seed-data";
import { REVIEWER, VIEWER, jsonRequest, signIn } from "./helpers";

const { GET: listRefunds } = refundsRoute;

let viewerCookie: string;
let reviewerCookie: string;

beforeAll(async () => {
  viewerCookie = await signIn(VIEWER);
  reviewerCookie = await signIn(REVIEWER);
});

type RefundBody = {
  refunds: {
    id: string;
    customerName: string;
    email: string;
    amountCents: number;
    currency: string;
    status: string;
    requestedAt: string;
    reason: string;
  }[];
  filters: { status?: string };
  invalidFilters: string[];
};

describe("refunds: unauthenticated access", () => {
  it("returns 401 and no refund data without a session", async () => {
    const res = await listRefunds(jsonRequest("/api/refunds"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.refunds).toBeUndefined();
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 401 for a forged session cookie", async () => {
    const res = await listRefunds(
      jsonRequest("/api/refunds", { cookie: "better-auth.session_token=forged.token" }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).refunds).toBeUndefined();
  });

  it("returns 401 even with a status filter", async () => {
    const res = await listRefunds(jsonRequest("/api/refunds?status=pending"));
    expect(res.status).toBe(401);
  });
});

describe("refunds: both authenticated roles may read", () => {
  it.each([
    ["viewer", () => viewerCookie],
    ["reviewer", () => reviewerCookie],
  ])("%s can list every seeded refund with all fields", async (_role, cookie) => {
    const res = await listRefunds(jsonRequest("/api/refunds", { cookie: cookie() }));
    expect(res.status).toBe(200);
    const body: RefundBody = await res.json();
    expect(body.refunds).toHaveLength(SEED_REFUNDS.length);
    expect(body.refunds.map((r) => r.id).sort()).toEqual(SEED_REFUNDS.map((r) => r.id).sort());
    for (const r of body.refunds) {
      expect(r).toMatchObject({
        id: expect.stringMatching(/^REF-\d+$/),
        customerName: expect.any(String),
        email: expect.stringMatching(/@example\.com$/),
        currency: expect.stringMatching(/^[A-Z]{3}$/),
        reason: expect.any(String),
      });
      expect(Number.isInteger(r.amountCents)).toBe(true);
      expect(REFUND_STATUSES).toContain(r.status);
      expect(Number.isNaN(Date.parse(r.requestedAt))).toBe(false);
    }
  });

  it("orders by requested date, newest first", async () => {
    const res = await listRefunds(jsonRequest("/api/refunds", { cookie: viewerCookie }));
    const body: RefundBody = await res.json();
    const times = body.refunds.map((r) => Date.parse(r.requestedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe("refunds: status filter", () => {
  it.each(REFUND_STATUSES)("filters to status=%s", async (status) => {
    const res = await listRefunds(jsonRequest(`/api/refunds?status=${status}`, { cookie: viewerCookie }));
    expect(res.status).toBe(200);
    const body: RefundBody = await res.json();
    const expected = await prisma.refundRequest.count({ where: { status } });
    expect(body.refunds).toHaveLength(expected);
    expect(body.refunds.every((r) => r.status === status)).toBe(true);
    expect(body.filters).toEqual({ status });
    expect(body.invalidFilters).toEqual([]);
  });

  it("ignores and reports an invalid status, returning the full list", async () => {
    const res = await listRefunds(jsonRequest("/api/refunds?status=bogus", { cookie: viewerCookie }));
    expect(res.status).toBe(200);
    const body: RefundBody = await res.json();
    expect(body.refunds).toHaveLength(SEED_REFUNDS.length);
    expect(body.filters).toEqual({});
    expect(body.invalidFilters).toEqual(["status"]);
  });

  it("treats an empty status as no filter", async () => {
    const res = await listRefunds(jsonRequest("/api/refunds?status=", { cookie: viewerCookie }));
    const body: RefundBody = await res.json();
    expect(body.refunds).toHaveLength(SEED_REFUNDS.length);
    expect(body.invalidFilters).toEqual([]);
  });
});

describe("refunds: read-only surface", () => {
  it("the refunds route exposes GET only", () => {
    expect(Object.keys(refundsRoute).sort()).toEqual(["GET"]);
  });

  it("reading refunds writes nothing", async () => {
    const before = await prisma.refundRequest.findMany({ orderBy: { id: "asc" } });
    await listRefunds(jsonRequest("/api/refunds", { cookie: reviewerCookie }));
    await listRefunds(jsonRequest("/api/refunds?status=pending", { cookie: viewerCookie }));
    const after = await prisma.refundRequest.findMany({ orderBy: { id: "asc" } });
    expect(after).toEqual(before);
  });

  it("adding refunds:read did not change KYC permissions", () => {
    const viewer = { id: VIEWER.id, email: VIEWER.email, name: VIEWER.name, role: VIEWER.role };
    const reviewer = { id: REVIEWER.id, email: REVIEWER.email, name: REVIEWER.name, role: REVIEWER.role };
    expect(can(viewer, "refunds:read")).toBe(true);
    expect(can(reviewer, "refunds:read")).toBe(true);
    expect(can(viewer, "cases:read")).toBe(true);
    expect(can(viewer, "cases:decide")).toBe(false);
    expect(can(reviewer, "cases:decide")).toBe(true);
    expect(can(null, "refunds:read")).toBe(false);
  });
});
