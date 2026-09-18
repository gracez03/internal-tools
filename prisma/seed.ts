import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { DEMO_ACCOUNTS, SEED_CASES } from "./seed-data";

// The seed is the single place PrismaClient is instantiated outside src/lib/db.ts:
// it runs as a standalone script, not inside the Next.js process.
const prisma = new PrismaClient();

async function seedAccounts() {
  for (const account of DEMO_ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    if (existing) {
      // Keep role in sync but never touch credentials of an existing account.
      if (existing.role !== account.role) {
        await prisma.user.update({ where: { id: existing.id }, data: { role: account.role } });
      }
      continue;
    }
    // Better Auth's own hashing (scrypt) so the credential provider can verify it.
    const password = await hashPassword(account.password);
    await prisma.user.create({
      data: {
        id: account.id,
        name: account.name,
        email: account.email,
        emailVerified: true,
        role: account.role,
        accounts: {
          create: {
            id: `acct_${account.id}`,
            accountId: account.id,
            providerId: "credential",
            password,
          },
        },
      },
    });
    console.log(`Created ${account.role} account ${account.email}`);
  }
}

async function seedCases() {
  const reviewer = DEMO_ACCOUNTS.find((a) => a.role === "reviewer");
  if (!reviewer) throw new Error("Seed data must include a reviewer account");
  let created = 0;
  for (const c of SEED_CASES) {
    const exists = await prisma.kycCase.findUnique({ where: { id: c.id } });
    if (exists) continue;
    const decided = c.status !== "pending";
    const submittedAt = new Date(c.submittedAt);
    const decidedAt = decided ? new Date(submittedAt.getTime() + 6 * 60 * 60 * 1000) : null;
    await prisma.$transaction(async (tx) => {
      await tx.kycCase.create({
        data: {
          id: c.id,
          applicantName: c.applicantName,
          email: c.email,
          submittedAt,
          riskLevel: c.riskLevel,
          status: c.status,
          summary: c.summary,
          decidedAt,
        },
      });
      if (decided && decidedAt) {
        await tx.caseHistory.create({
          data: {
            caseId: c.id,
            actorId: reviewer.id,
            actorEmail: reviewer.email,
            actorName: reviewer.name,
            actorRole: reviewer.role,
            action: c.status,
            previousStatus: "pending",
            newStatus: c.status,
            reason: c.decisionReason ?? "Seeded demo decision.",
            createdAt: decidedAt,
          },
        });
      }
    });
    created++;
  }
  console.log(`Seeded ${created} new KYC cases (${SEED_CASES.length} total defined)`);
}

async function main() {
  await seedAccounts();
  await seedCases();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
