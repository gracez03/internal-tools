import Link from "next/link";

export default function CaseNotFound() {
  return (
    <main className="container">
      <div className="card empty">
        <p>That case does not exist.</p>
        <Link className="btn" href="/cases">
          Back to queue
        </Link>
      </div>
    </main>
  );
}
