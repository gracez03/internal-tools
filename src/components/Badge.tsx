type Tone =
  | "pending"
  | "approved"
  | "rejected"
  | "processed"
  | "low"
  | "medium"
  | "high"
  | "neutral";

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "pending" || status === "approved" || status === "rejected" || status === "processed"
      ? status
      : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export function RiskBadge({ risk }: { risk: string }) {
  const tone: Tone = risk === "low" || risk === "medium" || risk === "high" ? risk : "neutral";
  return <Badge tone={tone}>{risk}</Badge>;
}
