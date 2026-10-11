import { useEffect, useMemo, useRef } from 'react';

import { splitCensusMessage } from '@/domain/census/compare';
import { PLACE_LABEL, type Place } from '@/domain/census/maker';

/**
 * The census message with a coloured band per place and a jump row
 * (2026-10-11, Avi: "auto scroll and coloured header like the SOAP"). The
 * text itself is unchanged: it is what gets copied.
 *
 * Colours are the SOAP section tints, so the page speaks one visual language.
 * `focus` scrolls the box to a place — Bandingkan sets it from the list being
 * read, so the two sides stay on the same building.
 */
const PLACE_TINT: Record<Place, string> = {
  RSWS: 'var(--sec-identitas)',
  RSUH: 'var(--sec-ts)',
  IGD: 'var(--sec-terapi)',
  CVCU: 'var(--sec-a)',
  LT4: 'var(--sec-s)',
  LT5: 'var(--sec-o)',
  LT6: 'var(--sec-identitas)',
  PJT: 'var(--sec-ts)',
};

export function CensusMessage({
  message,
  focus,
  className = '',
}: {
  message: string;
  focus?: Place | null | undefined;
  className?: string;
}): JSX.Element {
  const { intro, parts } = useMemo(() => splitCensusMessage(message, PLACE_LABEL), [message]);
  const box = useRef<HTMLDivElement>(null);
  const heads = useRef(new Map<Place, HTMLElement>());

  const jump = (place: Place): void => {
    const container = box.current;
    const head = heads.current.get(place);
    if (!container || !head) return;
    container.scrollTo({ top: head.offsetTop - container.offsetTop, behavior: 'smooth' });
  };
  useEffect(() => {
    // `jump` reads refs only, so it is not a dependency.
    if (focus) jump(focus);
  }, [focus, message]);

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {parts.length > 1 ? (
        <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
          {parts.map((part) => (
            <button
              key={part.place}
              type="button"
              onClick={() => jump(part.place)}
              style={{ backgroundColor: PLACE_TINT[part.place] }}
              className="min-h-tap rounded-full border border-border px-2 text-[11px] font-medium [@media(pointer:fine)]:min-h-7"
            >
              {PLACE_LABEL[part.place]} · {part.count}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={box} className="relative max-h-[70vh] overflow-auto">
        <pre className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-relaxed text-fg-muted">{intro}</pre>
        {parts.map((part) => (
          <section key={part.place} style={{ backgroundColor: PLACE_TINT[part.place] }}>
            <h4
              ref={(node) => {
                if (node) heads.current.set(part.place, node);
                else heads.current.delete(part.place);
              }}
              style={{ backgroundColor: PLACE_TINT[part.place] }}
              className="sticky top-0 z-[1] border-y border-border px-3 py-1 font-mono text-[11px] font-semibold"
            >
              {part.heading}
            </h4>
            <pre className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-relaxed">{part.body}</pre>
          </section>
        ))}
      </div>
    </div>
  );
}
