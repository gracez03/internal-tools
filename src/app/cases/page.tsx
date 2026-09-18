import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";

export default async function CasesPlaceholder() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return (
    <>
      <AppHeader actor={actor} />
      <main className="container">
        <div className="card">Signed in as {actor.email} ({actor.role}). Queue coming next.</div>
      </main>
    </>
  );
}
