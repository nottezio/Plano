import { useMemo, useRef } from 'react';

import { soapParts } from '@/domain/floorList/soapParts';
import { TINT_VAR } from '@/domain/sections/sectionTint';

/**
 * The full SOAP in the floating box, with a jump row and a tinted, sticky
 * heading per part (12.12) — the same reading aid as the census message. The
 * text is the stored SOAP, unchanged; Salin still copies it as is.
 */
export function SoapParts({ text }: { text: string }): JSX.Element {
  const parts = useMemo(() => soapParts(text), [text]);
  const box = useRef<HTMLDivElement>(null);
  const heads = useRef(new Map<number, HTMLElement>());
  const jump = (index: number): void => {
    const container = box.current;
    const section = heads.current.get(index);
    if (!container || !section) return;
    const top = container.scrollTop + section.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({ top, behavior: 'smooth' });
  };
  const tint = (index: number): string | undefined => {
    const value = parts[index]?.tint;
    return value ? TINT_VAR[value] : undefined;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {parts.length > 1 ? (
        <div className="flex flex-wrap gap-1 border-b border-border px-3 py-1.5">
          {parts.map((part, index) =>
            part.label ? (
              <button
                key={index}
                type="button"
                onClick={() => jump(index)}
                style={{ backgroundColor: tint(index) }}
                className="min-h-tap rounded-full border border-border px-2 text-[11px] font-medium [@media(pointer:fine)]:min-h-7"
              >
                {part.label}
              </button>
            ) : null,
          )}
        </div>
      ) : null}
      <div ref={box} className="relative min-h-0 flex-1 overflow-y-auto">
        {parts.map((part, index) => (
          <section
            key={index}
            ref={(node) => {
              if (node) heads.current.set(index, node);
              else heads.current.delete(index);
            }}
            style={{ backgroundColor: tint(index) }}
          >
            {part.label ? (
              <h4
                style={{ backgroundColor: tint(index) }}
                className="sticky top-0 z-[1] border-y border-border px-4 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted"
              >
                {part.label}
              </h4>
            ) : null}
            <pre className="whitespace-pre-wrap break-words px-4 py-2 font-sans text-[13px] leading-relaxed">{part.text.replace(/^\n+|\n+$/g, '')}</pre>
          </section>
        ))}
      </div>
    </div>
  );
}
