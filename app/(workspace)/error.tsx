"use client";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card" role="alert" style={{ maxWidth: 560 }}>
    <h1>We couldn&apos;t load this workspace</h1>
    <p className="muted">The meeting database didn&apos;t respond. Nothing is shown rather than stale or sample data.</p>
    {error.digest && <p className="muted">Reference: {error.digest}</p>}
    <button className="button primary" onClick={reset}>Try again</button>
  </section>;
}
