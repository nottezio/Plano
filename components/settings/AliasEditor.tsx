import { useMemo, useState } from 'react';

import { validateAliases } from '@/domain/sections/aliases';
import { parseSections } from '@/domain/sections/parseSections';
import type { SectionAlias } from '@/domain/types';

const SAMPLE = [
  'S: sesak berkurang',
  'TTV: TD 130/80',
  'Penunjang: Hb 10.2',
  'A: pneumonia',
  'Th/ Ceftriaxone 2x1',
].join('\n');

/**
 * SPEC 12.1 — the alias table is configuration, and editing it re-parses every
 * body on the fly.
 *
 * The live preview exists because that is a genuinely surprising property: the
 * user is editing something that changes how *existing* notes are read, without
 * any note being rewritten. Showing the parse result against a sample makes the
 * cause and effect visible instead of asking them to trust it.
 */
export function AliasEditor({
  aliases,
  onChange,
}: {
  aliases: readonly SectionAlias[];
  onChange: (next: SectionAlias[]) => void;
}): JSX.Element {
  const [sample, setSample] = useState(SAMPLE);

  const validation = useMemo(() => validateAliases(aliases), [aliases]);
  const parsed = useMemo(() => parseSections(sample, aliases), [sample, aliases]);

  const setKeywords = (sectionId: string, raw: string): void => {
    onChange(
      aliases.map((alias) =>
        alias.sectionId === sectionId
          ? {
              ...alias,
              aliases: raw
                .split(',')
                .map((token) => token.trim())
                .filter(Boolean),
            }
          : alias,
      ),
    );
  };

  const setLabel = (sectionId: string, label: string): void => {
    onChange(
      aliases.map((alias) => (alias.sectionId === sectionId ? { ...alias, label } : alias)),
    );
  };

  return (
    <div>
      <ul className="space-y-3">
        {[...aliases]
          .sort((a, b) => a.order - b.order)
          .map((alias) => (
            <li key={alias.sectionId} className="rounded-lg border border-border p-2">
              <input
                type="text"
                value={alias.label}
                onChange={(event) => setLabel(alias.sectionId, event.target.value)}
                className="min-h-tap w-full rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium outline-none focus:border-border"
              />
              <input
                type="text"
                value={alias.aliases.join(', ')}
                onChange={(event) => setKeywords(alias.sectionId, event.target.value)}
                className="mt-1 min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-xs outline-none"
              />
              <p className="mt-1 px-2 text-[11px] text-fg-faint">
                Kata kunci dipisah koma. Baris dianggap header bila diawali salah satu kata
                kunci diikuti “:”, “.” atau “)”.
              </p>
            </li>
          ))}
      </ul>

      {!validation.ok ? (
        <ul role="alert" className="mt-2 space-y-1 text-xs text-danger">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <p className="mb-1 mt-4 text-xs font-medium text-fg-muted">Uji coba</p>
      <textarea
        value={sample}
        onChange={(event) => setSample(event.target.value)}
        rows={5}
        className="w-full rounded-lg border border-border bg-surface p-2 text-xs outline-none"
      />
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {parsed.map((section, index) => (
          <li
            key={`${section.sectionId}-${index}`}
            className={[
              'rounded-full border px-2 py-1 text-[11px]',
              section.sectionId === '_intro'
                ? 'border-border text-fg-faint'
                : 'border-accent text-accent',
            ].join(' ')}
          >
            {section.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
