"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/Alert";
import { REASON_MIN, type Decision } from "@/modules/kyc/types";

type ApiError = { error: { code: string; message: string; details: unknown } };

export function DecisionForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(decision: Decision, e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (reason.trim().length < REASON_MIN) {
      setError(`A decision reason of at least ${REASON_MIN} characters is required.`);
      return;
    }
    setBusy(decision);
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the decision and reason are sent. Actor and time are derived server-side.
        body: JSON.stringify({ decision, reason }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        const msg = data?.error?.message ?? `Request failed (${res.status})`;
        setError(res.status === 409 ? `${msg} Refresh to see the current state.` : msg);
        return;
      }
      setSuccess(`Case ${decision === "approve" ? "approved" : "rejected"}.`);
      router.refresh();
    } catch {
      setError("Network error — the decision may not have been saved. Refresh and check history.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {success ? <Alert kind="success">{success}</Alert> : null}
      <label>
        Decision reason (required)
        <textarea
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={disabled}
          placeholder="Why are you approving or rejecting this case?"
          required
        />
      </label>
      <div className="btn-row">
        <button
          type="submit"
          className="btn btn-success"
          disabled={disabled}
          onClick={(e) => submit("approve", e)}
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="submit"
          className="btn btn-danger"
          disabled={disabled}
          onClick={(e) => submit("reject", e)}
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </form>
  );
}
