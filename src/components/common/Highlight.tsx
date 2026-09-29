/**
 * The words searched for, marked where they occur.
 *
 * `--warn-soft` as an arbitrary value, not `bg-[var(--accent-soft)]`: an opacity
 * modifier on a CSS-variable colour emits no CSS in this Tailwind version.
 */
export function Highlight({ text, tokens }: { text: string; tokens: readonly string[] }): JSX.Element {
  if (tokens.length === 0) return <>{text}</>;
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="rounded-sm bg-[var(--warn-soft)] px-0.5 text-fg">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
