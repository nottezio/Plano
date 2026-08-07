import { useEffect, useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import {
  composeCopy,
  resolveRange,
  type CopyDay,
} from '@/domain/format/composeCopy';
import { FORMAT_LABELS, findMarkdownLeaks } from '@/domain/format/formatters';
import {
  COPY_GROUPS,
  availableGroups,
  sectionsForGroups,
  type CopyGroupId,
} from '@/domain/format/copyGroups';
import { copyText } from '@/lib/clipboard';
import type {
  ClinicalDate,
  CopyPreset,
  CopyRange,
  OutputFormat,
  Patient,
  SectionAlias,
} from '@/domain/types';

const RANGE_LABELS: Record<CopyRange, string> = {
  today: 'Hari ini',
  specific: 'Tanggal ini',
  lastN: '3 hari terakhir',
  all: 'Semua hari',
};

/**
 * SPEC F6 — the copy sheet.
 *
 * Four independent axes: format, section subset, range, and whether to include
 * the identity line. They are independent because the real requests are
 * combinations — "terapi saja, plain, hari ini, tanpa nama" for SIMGOS;
 * "semua, WhatsApp, dengan identitas" for the chief.
 *
 * The output is composed on every change and shown as a preview, because a
 * resident pasting into a group chat cannot undo it.
 */
export function CopySheet({
  open,
  onOpenChange,
  patient,
  body,
  date,
  today,
  aliases,
  presets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  body: string;
  date: ClinicalDate;
  today: ClinicalDate;
  aliases: readonly SectionAlias[];
  presets: readonly CopyPreset[];
}): JSX.Element {
  const [format, setFormat] = useState<OutputFormat>('whatsapp');
  const [range, setRange] = useState<CopyRange>('specific');
  const [groups, setGroups] = useState<CopyGroupId[] | 'all'>('all');
  /**
   * Identity and date header are no longer options.
   *
   * Templates carry the greeting, ward, identity line and closing INSIDE the
   * note (see templates.ts), so prepending them again printed every header
   * twice. A toggle whose only two states are "correct" and "duplicated" is not
   * a choice, it is a trap — so it is gone rather than defaulted off.
   */
  const includeIdentity = false;
  const includeDateHeader = false;
  const [allDays, setAllDays] = useState<CopyDay[]>([]);
  const [copied, setCopied] = useState(false);

  const present = useMemo(() => availableGroups(body, aliases), [body, aliases]);

  /**
   * Whole note, or an explicit subset expanded from the chosen groups.
   *
   * "Semua" stays `'all'` rather than every group selected, because the whole
   * note is byte-faithful while a subset is recomposed — and the greeting,
   * identity and closing live outside the five groups entirely.
   */
  const selected = useMemo(
    () => (groups === 'all' ? ('all' as const) : sectionsForGroups(body, aliases, groups)),
    [groups, body, aliases],
  );

  // Loaded once per opening: ranges beyond the current day need other bodies.
  useEffect(() => {
    if (!open) return;
    setCopied(false);
    let cancelled = false;
    void fetchEntryBodies(patient.id)
      .then((days) => {
        if (!cancelled) setAllDays(days);
      })
      .catch((error: unknown) => console.error('[copy] could not read entries', error));
    return () => {
      cancelled = true;
    };
  }, [open, patient.id]);

  const days = useMemo(() => {
    const pool = allDays.length > 0 ? allDays : [{ date, body }];
    return resolveRange({ range, lastN: 3 }, pool, today, date);
  }, [allDays, range, today, date, body]);

  const output = useMemo(
    () =>
      composeCopy(days, {
        format,
        sections: selected,
        includeIdentity,
        includeDateHeader,
        aliases,
        patient,
      }),
    [days, format, selected, includeIdentity, includeDateHeader, aliases, patient],
  );

  const leaks = findMarkdownLeaks(format === 'whatsapp' ? output : '');

  const applyPreset = (preset: CopyPreset): void => {
    setFormat(preset.format);
    setRange(preset.range);
  };

  const toggleGroup = (id: CopyGroupId): void => {
    const current = groups === 'all' ? COPY_GROUPS.map((group) => group.id) : groups;
    const next = current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current, id];
    setGroups(next.length === COPY_GROUPS.length ? 'all' : next);
  };

  const onCopy = (): void => {
    void copyText(output).then((ok) => setCopied(ok));
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Salin catatan"
      description="Pilih format, bagian, dan rentang tanggal."
      footer={
        <button
          type="button"
          onClick={onCopy}
          disabled={!output.trim()}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {copied ? 'Tersalin ✓' : 'Salin'}
        </button>
      }
    >
      {presets.length > 0 ? (
        <Group label="Preset">
          {presets.map((preset) => (
            <Chip key={preset.id} active={false} onClick={() => applyPreset(preset)}>
              {preset.name}
            </Chip>
          ))}
        </Group>
      ) : null}

      <Group label="Format">
        {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map((value) => (
          <Chip key={value} active={format === value} onClick={() => setFormat(value)}>
            {FORMAT_LABELS[value]}
          </Chip>
        ))}
      </Group>

      <Group label="Rentang">
        {(Object.keys(RANGE_LABELS) as CopyRange[]).map((value) => (
          <Chip key={value} active={range === value} onClick={() => setRange(value)}>
            {RANGE_LABELS[value]}
          </Chip>
        ))}
      </Group>

      <Group label="Bagian">
        <Chip active={groups === 'all'} onClick={() => setGroups('all')}>
          Seluruh catatan
        </Chip>
        {COPY_GROUPS.map((group) => (
          <Chip
            key={group.id}
            active={groups !== 'all' && groups.includes(group.id)}
            disabled={!present.has(group.id)}
            onClick={() => toggleGroup(group.id)}
          >
            {group.label}
          </Chip>
        ))}
      </Group>

      <p className="mb-1 mt-4 text-xs font-medium text-fg-muted">Pratinjau</p>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
        {output || '(kosong)'}
      </pre>

      {leaks.length > 0 ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          Peringatan: sisa penanda markdown ({leaks.join(' ')}) terdeteksi.
        </p>
      ) : null}
    </Sheet>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-medium text-fg-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        'min-h-tap rounded-full border px-3 text-xs disabled:opacity-30',
        active ? 'border-accent bg-bg-subtle font-medium text-accent' : 'border-border text-fg-muted',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
