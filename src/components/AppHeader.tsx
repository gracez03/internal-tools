import Link from "next/link";
import type { Actor } from "@/lib/session";
import { Badge } from "@/components/Badge";
import { SignOutButton } from "@/components/SignOutButton";

export function AppHeader({ actor }: { actor: Actor | null }) {
  return (
    <header className="header">
      <h1>
        <Link href="/cases" style={{ color: "inherit", textDecoration: "none" }}>
          Fintech Ops Console
        </Link>{" "}
        <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>
          / KYC Review
        </span>
      </h1>
      {actor ? (
        <div className="who">
          <span>
            {actor.email} <Badge tone="neutral">{actor.role}</Badge>
          </span>
          <SignOutButton />
        </div>
      ) : null}
    </header>
  );
}
