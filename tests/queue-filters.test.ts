import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET as listCases } from "@/app/api/cases/route";
import { VIEWER, jsonRequest, signIn } from "./helpers";

let viewerCookie: string;

beforeAll(async () => {
  viewerCookie = await signIn(VIEWER);
});

type ListBody = {
  cases: { id: string; status: string; riskLevel: string; applicantName: string; email: string }[];
  filters: { q?: string; status?: string; risk?: string };
  invalidFilters: string[];
};

const list = async (query: string): Promise<ListBody> => {
  const res = await listCases(jsonRequest(`/api/cases${query}`, { cookie: viewerCookie }));
  expect(res.status).toBe(200);
  return res.json();
};

describe("queue filters", () => {
  it("applies status and risk together", async () => {
    const body = await list("?status=pending&risk=high");
    const expected = await prisma.kycCase.count({ where: { status: "pending", riskLevel: "high" } });
    expect(body.cases.length).toBe(expected);
    expect(body.cases.every((c) => c.status === "pending" && c.riskLevel === "high")).toBe(true);
    expect(body.invalidFilters).toEqual([]);
  });

  it("keeps valid filters when another one is invalid", async () => {
    const body = await list("?status=pending&risk=invalid");
    const expected = await prisma.kycCase.count({ where: { status: "pending" } });
    expect(body.cases.length).toBe(expected);
    expect(body.cases.length).toBeLessThan(20);
    expect(body.cases.every((c) => c.status === "pending")).toBe(true);
    expect(body.filters).toEqual({ status: "pending" });
    expect(body.invalidFilters).toEqual(["risk"]);
  });

  it("keeps search text when status is invalid", async () => {
    const body = await list("?q=KYC-1001&status=bogus");
    expect(body.cases.map((c) => c.id)).toEqual(["KYC-1001"]);
    expect(body.filters).toEqual({ q: "KYC-1001" });
    expect(body.invalidFilters).toEqual(["status"]);
  });

  it("reports every invalid filter and returns the full queue when none are valid", async () => {
    const body = await list("?status=nope&risk=nah");
    expect(body.cases.length).toBe(20);
    expect(body.filters).toEqual({});
    expect(body.invalidFilters).toEqual(["status", "risk"]);
  });

  it("treats empty values as no filter", async () => {
    const body = await list("?q=&status=&risk=");
    expect(body.cases.length).toBe(20);
    expect(body.invalidFilters).toEqual([]);
  });
});
