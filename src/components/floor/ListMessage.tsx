import { useMemo, useRef, useState } from 'react';

import { splitFloorList } from '@/domain/floorList/build';

/**
 * The list message, plain or coloured per DPJP (12.12, Avi: "a checkbox to
 * colour the list by section (DPJP), like the sensus result"). Same tints and
 * jump row as the census message. Display only — Salin copies the plain text.
 * The choice is remembered on this device.
 */
const TINTS = ['var(--sec-s)', 'var(--sec-o)', 'var(--sec-a)', 'var(--sec-terapi)', 'var(--sec-ts)', 'var(--sec-identitas)'];
const KEY = 'plano.listmaker.tinted';

function readTinted(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function ListMessage({ text }: { text: string }): JSX.Element {
  const [tinted, setTinted] = useState(readTinted);
  const { intro, parts } = useMemo(() => splitFloorList(text), [text]);
  const box = useRef<HTMLDivElement>(null);
  const heads = useRef(new Map<number, HTMLElement>());

  const jump = (index: number): void => {
    const container = box.current;
    const section = heads.current.get(index);
    if (!container || !section) return;
    const top = container.scrollTop + section.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({ top, behavior: 'smooth' });
  };
  const toggle = (next: boolean): void => {
    setTinted(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // A private window: the choice just is not remembered.
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-subtle">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <label className="mr-1 inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-xs">
          <input type="checkbox" checked={tinted} onChange={(e) => toggle(e.target.checked)} />
          Warnai per DPJP
        </label>
        {tinted
          ? parts.map((part, index) =>
              part.count > 0 ? (
                <button
                  key={part.heading}
                  type="button"
                  onClick={() => jump(index)}
                  style={{ backgroundColor: TINTS[index % TINTS.length] }}
                  className="min-h-tap rounded-full border border-border px-2 text-xs font-medium [@media(pointer:fine)]:min-h-7"
                >
                  {part.heading.replace(/^\S+\s/, '').replace(/ : .*$/, '')} · {part.count}
                </button>
              ) : null,
            )
          : null}
      </div>
      <div ref={box} className="relative max-h-[70dvh] overflow-y-auto">
        {tinted ? (
          <>
            <pre className="whitespace-pre-wrap break-words px-3 py-2 font-sans text-xs leading-relaxed">{intro}</pre>
            {parts.map((part, index) => (
              <section
                key={part.heading}
                ref={(node) => {
                  if (node) heads.current.set(index, node);
                  else heads.current.delete(index);
                }}
                style={{ backgroundColor: TINTS[index % TINTS.length] }}
              >
                <h4
                  style={{ backgroundColor: TINTS[index % TINTS.length] }}
                  className="sticky top-0 z-[1] border-y border-border px-3 py-1 text-xs font-semibold"
                >
                  {part.heading}
                </h4>
                {part.body ? (
                  <pre className="whitespace-pre-wrap break-words px-3 py-2 font-sans text-xs leading-relaxed">{part.body}</pre>
                ) : null}
              </section>
            ))}
          </>
        ) : (
          <pre className="whitespace-pre-wrap break-words p-3 font-sans text-xs leading-relaxed">{text}</pre>
        )}
      </div>
    </div>
  );
}
