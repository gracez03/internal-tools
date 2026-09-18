"use client";

import { Alert } from "@/components/Alert";

export default function CasesError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="container">
      <div className="card">
        <Alert kind="error">Something went wrong loading this page: {error.message}</Alert>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={reset}>
            Try again
          </button>
          <a className="btn" href="/cases">
            Back to queue
          </a>
        </div>
      </div>
    </main>
  );
}
