/**
 * Placeholder for routes whose feature phase has not shipped yet.
 * Explicitly labelled so a stub is never mistaken for a bug.
 */
export function PhaseStub({
  phase,
  title,
  children,
}: {
  phase: string;
  title: string;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <section className="px-4 py-8">
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-border-strong bg-bg-subtle px-5 py-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">{phase}</p>
        <h2 className="mt-1 text-base font-semibold">{title}</h2>
        {children ? <div className="mt-2 text-sm text-fg-muted">{children}</div> : null}
      </div>
    </section>
  );
}
