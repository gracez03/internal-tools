import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect("/cases");
  return (
    <>
      <AppHeader actor={null} />
      <main className="container">
        <div className="card login-wrap">
          <h2>Sign in</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Local demo accounts only. Public sign-up is disabled.
          </p>
          <LoginForm />
          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "16px 0" }} />
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Demo accounts (see README):
            <br />
            <code>viewer@example.com</code> / <code>viewer-demo-pass</code>
            <br />
            <code>reviewer@example.com</code> / <code>reviewer-demo-pass</code>
          </p>
        </div>
      </main>
    </>
  );
}
