import { useMemo, useState } from 'react';

import { DateField } from '@/components/common/DateField';
import { IconCheck, IconCopy } from '@/components/common/Icons';
import { Button, ChoiceChip, Field, Section } from '@/components/common/ui';
import { formatDmy } from '@/domain/dateDmy';
import { snapFromEntry, type CensusSnapshot } from '@/domain/census/evolution';
import { chatSource, type ChatDigest } from '@/domain/census/groupChat';
import { buildCensus, dpjpFullName, type CensusAddress, type IdentityStyle } from '@/domain/census/maker';
import type { ClinicalDate } from '@/domain/types';
import { copyText } from '@/lib/clipboard';
import { CensusMessage } from './CensusMessage';
import { GroupChatImport } from './GroupChatImport';
import { SaveResultButton } from './SaveResult';

/**
 * Buat Sensus → Grup WhatsApp (2026-11-14, Avi): the census read from a
 * DPJP's group export, kept apart from the pasted-list census so an import
 * can never change or replace it. Its own DPJP, its own message, its own
 * Salin. Each tanggal sensus keeps its import; the earlier ones are the
 * memory (the chips, and the patients they carry into the next import).
 */
export function GroupChatCensus({
  today,
  censusDate,
  onDate,
  digest,
  previous,
  importDays,
  address,
  style,
  onChange,
  onRemove,
  onRecord,
}: {
  today: ClinicalDate;
  censusDate: ClinicalDate;
  onDate: (date: ClinicalDate) => void;
  digest: ChatDigest | null;
  previous: ChatDigest | null;
  /** Other dates that hold an import, newest first, with their patient count. */
  importDays: ReadonlyArray<{ date: ClinicalDate; patients: number }>;
  address: CensusAddress;
  style: IdentityStyle;
  onChange: (next: ChatDigest) => void;
  onRemove: () => void;
  onRecord: (snapshot: CensusSnapshot) => void;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const code = digest?.code ?? '';

  const census = useMemo(() => {
    if (!digest || !code) return null;
    return buildCensus({ sources: [chatSource(digest).source], code, date: censusDate, address, style });
  }, [digest, code, censusDate, address, style]);

  const record = (): void => {
    if (!census || !code) return;
    onRecord({
      code: code.toUpperCase(),
      date: censusDate,
      patients: census.entries.map((entry) => snapFromEntry(entry, code)),
      covers: [],
      savedAt: Date.now(),
      source: 'grup-wa',
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
      <Section
        title="Impor chat grup DPJP"
        hint="Untuk DPJP yang sensusnya dikirim sebelum list ruangan datang. Ekspor chat grup DPJP dari WhatsApp (tanpa media), lalu impor .zip-nya. Laporan kemarin dan hari ini dibaca. Pasien dari impor sebelumnya yang tidak dilaporkan lagi tetap dibawa dan ditandai. Sensus di sini terpisah dari sensus list ruangan."
      >
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Tanggal sensus">
            <DateField value={censusDate} onChange={onDate} className="w-40" />
          </Field>
          {censusDate !== today ? (
            <Button size="sm" variant="ghost" onClick={() => onDate(today)}>
              Hari ini
            </Button>
          ) : null}
          {importDays.map((day) => (
            <ChoiceChip key={day.date} active={false} onClick={() => onDate(day.date)}>
              {formatDmy(day.date)} · {day.patients} pasien
            </ChoiceChip>
          ))}
        </div>
        <div className="mt-3">
          <GroupChatImport digest={digest} previous={previous} censusDate={censusDate} onChange={onChange} onRemove={onRemove} />
        </div>
      </Section>

      <aside className="min-w-0 lg:sticky lg:top-4">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">Sensus {code ? dpjpFullName(code) : ''}</span>
              <span className="block truncate text-[11px] text-fg-faint">
                {census ? `${census.entries.length} pasien · dari grup WhatsApp` : 'Belum ada impor untuk tanggal ini'}
              </span>
            </span>
            <SaveResultButton
              kind="sensus"
              forDate={censusDate}
              subject={`${code} grup`}
              title={`Sensus ${code ? dpjpFullName(code) : ''} (grup WhatsApp)`.trim()}
              text={census?.text ?? ''}
              disabled={!census}
              onSaved={record}
            />
            <Button
              size="sm"
              variant={copied ? 'secondary' : 'primary'}
              disabled={!census}
              icon={copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
              onClick={() =>
                census &&
                void copyText(census.text).then((ok) => {
                  if (ok) record();
                  setCopied(ok);
                  if (ok) window.setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
          </div>
          {census ? (
            <CensusMessage message={census.text} />
          ) : (
            <p className="px-3 py-2 text-xs leading-relaxed text-fg-muted">
              {digest ? 'Pilih DPJP grup ini di kartu impor.' : 'Impor .zip chat grup; sensusnya muncul di sini.'}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
