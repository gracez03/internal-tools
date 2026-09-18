import Link from "next/link";
import type { Actor } from "@/lib/session";
import { Badge } from "@/components/Badge";
import { SignOutButton } from "@/components/SignOutButton";

export type Section = "cases" | "refunds";

const NAV: { section: Section; href: string; label: string }[] = [
  { section: "cases", href: "/cases", label: "KYC review" },
  { section: "refunds", href: "/refunds", label: "Refunds" },
];

export function AppHeader({ actor, section }: { actor: Actor | null; section?: Section }) {
  return (
    <header className="header">
      <div className="brand">
        <h1>
          <Link href="/cases" style={{ color: "inherit", textDecoration: "none" }}>
            Fintech Ops Console
          </Link>
        </h1>
        {actor ? (
          <nav aria-label="Modules">
            {NAV.map((item) => (
              <Link
                key={item.section}
                href={item.href}
                aria-current={item.section === section ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
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
