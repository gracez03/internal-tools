// Clearly fictional KYC cases. All names are invented; all emails use example.com.
export type RiskLevel = "low" | "medium" | "high";
export type CaseStatus = "pending" | "approved" | "rejected";

export type SeedCase = {
  id: string;
  applicantName: string;
  email: string;
  submittedAt: string; // ISO date
  riskLevel: RiskLevel;
  status: CaseStatus;
  summary: string;
  // Only for pre-decided cases: the seed reviewer's reason.
  decisionReason?: string;
};

export const DEMO_ACCOUNTS = [
  {
    id: "user_viewer_demo",
    name: "Vera Viewer",
    email: "viewer@example.com",
    password: "viewer-demo-pass",
    role: "viewer" as const,
  },
  {
    id: "user_reviewer_demo",
    name: "Rey Reviewer",
    email: "reviewer@example.com",
    password: "reviewer-demo-pass",
    role: "reviewer" as const,
  },
];

export const SEED_CASES: SeedCase[] = [
  { id: "KYC-1001", applicantName: "Avery Quill", email: "avery.quill@example.com", submittedAt: "2026-09-01T09:12:00Z", riskLevel: "low", status: "pending", summary: "Synthetic: address and ID fields consistent; low-value personal account." },
  { id: "KYC-1002", applicantName: "Blake Marrow", email: "blake.marrow@example.com", submittedAt: "2026-09-01T14:40:00Z", riskLevel: "medium", status: "pending", summary: "Synthetic: name spelling differs between two submitted fields." },
  { id: "KYC-1003", applicantName: "Casey Fennel", email: "casey.fennel@example.com", submittedAt: "2026-09-02T08:05:00Z", riskLevel: "high", status: "pending", summary: "Synthetic: declared occupation flagged by internal risk rules." },
  { id: "KYC-1004", applicantName: "Dakota Ling", email: "dakota.ling@example.com", submittedAt: "2026-09-02T16:22:00Z", riskLevel: "low", status: "approved", summary: "Synthetic: straightforward profile, all automated checks passed.", decisionReason: "Seeded demo decision: automated checks passed, no discrepancies." },
  { id: "KYC-1005", applicantName: "Emerson Vale", email: "emerson.vale@example.com", submittedAt: "2026-09-03T10:30:00Z", riskLevel: "medium", status: "pending", summary: "Synthetic: recent address change within 30 days of application." },
  { id: "KYC-1006", applicantName: "Finley Oakes", email: "finley.oakes@example.com", submittedAt: "2026-09-03T11:15:00Z", riskLevel: "high", status: "rejected", summary: "Synthetic: submitted document failed automated integrity check.", decisionReason: "Seeded demo decision: document integrity check failed twice." },
  { id: "KYC-1007", applicantName: "Greer Tamsin", email: "greer.tamsin@example.com", submittedAt: "2026-09-04T09:00:00Z", riskLevel: "low", status: "pending", summary: "Synthetic: returning applicant, prior account closed in good standing." },
  { id: "KYC-1008", applicantName: "Harper Nix", email: "harper.nix@example.com", submittedAt: "2026-09-04T13:45:00Z", riskLevel: "medium", status: "pending", summary: "Synthetic: phone country code does not match declared residence." },
  { id: "KYC-1009", applicantName: "Indigo Rusk", email: "indigo.rusk@example.com", submittedAt: "2026-09-05T08:50:00Z", riskLevel: "high", status: "pending", summary: "Synthetic: declared source of funds is unusually large for profile." },
  { id: "KYC-1010", applicantName: "Jules Hartwell", email: "jules.hartwell@example.com", submittedAt: "2026-09-05T15:10:00Z", riskLevel: "low", status: "approved", summary: "Synthetic: employer verification matched automatically.", decisionReason: "Seeded demo decision: employer verification matched." },
  { id: "KYC-1011", applicantName: "Kai Brambleton", email: "kai.brambleton@example.com", submittedAt: "2026-09-06T09:35:00Z", riskLevel: "medium", status: "pending", summary: "Synthetic: two applications from the same device fingerprint." },
  { id: "KYC-1012", applicantName: "Lennox Pryor", email: "lennox.pryor@example.com", submittedAt: "2026-09-06T12:00:00Z", riskLevel: "low", status: "pending", summary: "Synthetic: all fields validated; awaiting manual sign-off." },
  { id: "KYC-1013", applicantName: "Marlowe Quest", email: "marlowe.quest@example.com", submittedAt: "2026-09-07T10:20:00Z", riskLevel: "high", status: "pending", summary: "Synthetic: applicant appears on internal synthetic watchlist fixture." },
  { id: "KYC-1014", applicantName: "Noor Castellan", email: "noor.castellan@example.com", submittedAt: "2026-09-07T17:05:00Z", riskLevel: "medium", status: "rejected", summary: "Synthetic: could not verify declared date of birth.", decisionReason: "Seeded demo decision: date of birth could not be verified." },
  { id: "KYC-1015", applicantName: "Oakley Sennet", email: "oakley.sennet@example.com", submittedAt: "2026-09-08T08:15:00Z", riskLevel: "low", status: "pending", summary: "Synthetic: small business owner, documents complete." },
  { id: "KYC-1016", applicantName: "Peyton Drake", email: "peyton.drake@example.com", submittedAt: "2026-09-08T14:55:00Z", riskLevel: "medium", status: "pending", summary: "Synthetic: address verification returned partial match." },
  { id: "KYC-1017", applicantName: "Quinn Ashby", email: "quinn.ashby@example.com", submittedAt: "2026-09-09T09:40:00Z", riskLevel: "high", status: "pending", summary: "Synthetic: politically exposed person flag from fixture data." },
  { id: "KYC-1018", applicantName: "Reese Wilder", email: "reese.wilder@example.com", submittedAt: "2026-09-09T16:30:00Z", riskLevel: "low", status: "pending", summary: "Synthetic: student account, low expected volume." },
  { id: "KYC-1019", applicantName: "Sasha Moreno", email: "sasha.moreno@example.com", submittedAt: "2026-09-10T11:25:00Z", riskLevel: "medium", status: "pending", summary: "Synthetic: mismatch between declared and detected IP geolocation." },
  { id: "KYC-1020", applicantName: "Tatum Greyling", email: "tatum.greyling@example.com", submittedAt: "2026-09-10T18:10:00Z", riskLevel: "high", status: "pending", summary: "Synthetic: multiple failed identity verification attempts." },
];
