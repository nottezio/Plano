import { useState } from 'react';

import { composeSection } from '@/domain/format/composeCopy';
import { copyableSections } from '@/domain/sections/parseSections';
import { copyText } from '@/lib/clipboard';
import type { OutputFormat, SectionAlias } from '@/domain/types';

/**
 * SPEC F6 — per-section copy.
 *
 * The most common real request during rounds is not "copy the note", it is
 * "paste today's Terapi into SIMGOS". One tap, no sheet, no choices.
 *
 * The row only shows sections the parser actually found in THIS note, so it is
 * empty for an unstructured note rather than offering buttons that would copy
 * nothing.
 */
export function SectionCopyBar({
  body,
  aliases,
  format,
}: {
  body: string;
  aliases: readonly SectionAlias[];
  format: OutputFormat;
}): JSX.Element | null {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const sections = copyableSections(body, aliases);

  if (sections.length === 0) return null;

  const onCopy = (sectionId: string): void => {
    const text = composeSection(body, sectionId as never, format, aliases);
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopiedId(sectionId);
      window.setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <div
      aria-label="Salin per bagian"
      className="flex gap-2 overflow-x-auto border-t border-border px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <span className="shrink-0 self-center text-[11px] text-fg-faint">Salin:</span>
      {sections.map((section) => (
        <button
          key={section.sectionId}
          type="button"
          onClick={() => onCopy(section.sectionId)}
          className="min-h-tap shrink-0 rounded-full border border-border px-3 text-xs text-fg-muted"
        >
          {copiedId === section.sectionId ? `${section.label} ✓` : section.label}
        </button>
      ))}
    </div>
  );
}
