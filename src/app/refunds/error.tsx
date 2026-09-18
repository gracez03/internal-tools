"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Alert } from "@/components/Alert";

export default function RefundsError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
  return (
    <main className="container">
      <div className="card">
        <Alert kind="error">Something went wrong loading this page: {error.message}</Alert>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={retry}>
            Try again
          </button>
          <a className="btn" href="/refunds">
            Back to refunds
          </a>
        </div>
      </div>
    </main>
  );
}
