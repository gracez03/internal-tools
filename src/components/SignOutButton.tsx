"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert } from "@/components/Alert";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const { error: signOutError } = await authClient.signOut();
      if (signOutError) {
        setError(`Sign-out failed: ${signOutError.message ?? "unexpected response"}. Try again.`);
        return;
      }
    } catch {
      setError("Sign-out failed: could not reach the server. Check your connection and try again.");
      return;
    } finally {
      setBusy(false);
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button className="btn" disabled={busy} onClick={onClick}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error ? <Alert kind="error">{error}</Alert> : null}
    </>
  );
}
