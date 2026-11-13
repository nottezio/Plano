import { useEffect, useMemo, useState } from 'react';

import { DateField } from '@/components/common/DateField';
import { NoticeCard } from '@/components/common/NoticeBanner';
import { clearNotice, sendNotice, subscribeAccessConfig } from '@/data/repositories/access.repo';
import type { AccessConfig, AccessRecord } from '@/domain/access';
import {
  EXPIRY_PRESETS,
  NOTICE_MAX,
  expiryFromPreset,
  formatDmyTime,
  fromLocal,
  isExpired,
  toLocalIso,
  type AccessNotice,
  type ExpiryPreset,
  type NoticeTone,
} from '@/domain/notice';
import { ArmedButton, DAY_MS } from './adminUi';

type Target = 'all' | string;
type ExpiryChoice = ExpiryPreset | 'custom';

const PILL = 'min-h-tap rounded-full border px-3 text-xs font-medium [@media(pointer:fine)]:min-h-8';
const pill = (on: boolean): string =>
  [PILL, on ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted'].join(' ');

const stamp = formatDmyTime;

/**
 * Pesan: send a message to every account or to one, with an expiry.
 *
 * Nothing here reads more than the access records the page already holds and
 * the one `config/access` document. A message is a field on a document every
 * app is already listening to, so residents pay no extra read to receive it
 * beyond the one change notification.
 */
export function MessagesTab({
  records,
  adminUid,
  onError,
}: {
  records: AccessRecord[] | null;
  adminUid: string;
  onError: (message: string) => void;
}): JSX.Element {
  const [config, setConfig] = useState<AccessConfig | null>(null);
  const [target, setTarget] = useState<Target>('all');
  const [text, setText] = useState('');
  const [tone, setTone] = useState<NoticeTone>('info');
  const [choice, setChoice] = useState<ExpiryChoice>('24h');
  const [date, setDate] = useState(() => toLocalIso(new Date(Date.now() + DAY_MS)));
  const [time, setTime] = useState('09:00');
  const [formError, setFormError] = useState<string | null>(null);
  const now = Date.now();

  useEffect(
    () =>
      subscribeAccessConfig(setConfig, (cause: unknown) => {
        console.error('[admin] notice config', cause);
        onError('Tidak dapat membaca pesan. Aturan Firestore baru mungkin belum ter-deploy.');
      }),
    [onError],
  );

  const accounts = useMemo(
    () =>
      [...(records ?? [])].sort((a, b) =>
        (a.displayName || a.email).localeCompare(b.displayName || b.email, 'id'),
      ),
    [records],
  );
  const nameOf = (uid: string): string => {
    const record = accounts.find((entry) => entry.uid === uid);
    return record ? record.displayName || record.email || uid : uid;
  };

  const entries = useMemo(() => {
    const at = Date.now();
    const list: { target: Target; notice: AccessNotice }[] = [];
    if (config?.notice) list.push({ target: 'all', notice: config.notice });
    for (const record of records ?? []) {
      if (record.notice) list.push({ target: record.uid, notice: record.notice });
    }
    return list.sort(
      (a, b) =>
        Number(isExpired(a.notice, at)) - Number(isExpired(b.notice, at)) ||
        (b.notice.createdAt?.getTime() ?? Infinity) - (a.notice.createdAt?.getTime() ?? Infinity),
    );
  }, [config, records]);

  const send = (): void => {
    const expiresAt = choice === 'custom' ? fromLocal(date, time) : expiryFromPreset(choice, Date.now());
    if (choice === 'custom' && (!expiresAt || expiresAt.getTime() <= Date.now())) {
      setFormError('Waktu berakhir harus di masa depan.');
      return;
    }
    setFormError(null);
    void sendNotice(target, { text, tone, expiresAt }, adminUid)
      .then(() => setText(''))
      .catch((cause: unknown) => {
        console.error('[admin] send notice', cause);
        onError('Pesan ditolak server. Coba lagi, atau periksa aturan Firestore.');
      });
  };

  const remove = (entryTarget: Target): void => {
    void clearNotice(entryTarget, adminUid).catch((cause: unknown) => {
      console.error('[admin] clear notice', cause);
      onError('Penghapusan ditolak server. Coba lagi.');
    });
  };

  const fieldLabel = 'text-xs text-fg-muted';
  const fieldBox =
    'min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm [@media(pointer:fine)]:min-h-8';

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Kirim pesan</h2>

        <label className="block space-y-1">
          <span className={fieldLabel}>Kepada</span>
          <select value={target} onChange={(event) => setTarget(event.target.value)} className={fieldBox}>
            <option value="all">Semua akun</option>
            {accounts.map((record) => (
              <option key={record.uid} value={record.uid}>
                {record.displayName || record.email || record.uid}
                {record.displayName && record.email ? ` (${record.email})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={fieldLabel}>Pesan</span>
            <span className="text-xs tabular-nums text-fg-faint">
              {text.length}/{NOTICE_MAX}
            </span>
          </span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={NOTICE_MAX}
            rows={3}
            placeholder="Mis. Plano pindah ke tabulaplano.web.app mulai besok."
            className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>

        <div role="radiogroup" aria-label="Jenis pesan" className="flex flex-wrap items-center gap-2">
          <span className={fieldLabel}>Jenis</span>
          {(['info', 'penting'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={tone === value}
              onClick={() => setTone(value)}
              className={pill(tone === value)}
            >
              {value === 'info' ? 'Biasa' : 'Penting'}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div role="radiogroup" aria-label="Berakhir" className="flex flex-wrap items-center gap-2">
            <span className={fieldLabel}>Berakhir</span>
            {EXPIRY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={choice === preset.id}
                onClick={() => setChoice(preset.id)}
                className={pill(choice === preset.id)}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={choice === 'custom'}
              onClick={() => setChoice('custom')}
              className={pill(choice === 'custom')}
            >
              Atur sendiri
            </button>
          </div>
          {choice === 'custom' ? (
            <div className="flex flex-wrap items-center gap-2">
              <DateField
                value={date}
                onChange={setDate}
                ariaLabel="Tanggal berakhir"
                min={toLocalIso(new Date())}
                className="w-40"
                inputClassName="min-h-tap [@media(pointer:fine)]:min-h-8"
              />
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                aria-label="Jam berakhir"
                className="min-h-tap rounded-lg border border-border bg-surface px-3 text-sm [@media(pointer:fine)]:min-h-8"
              />
            </div>
          ) : null}
        </div>

        {text.trim() ? (
          <div className="space-y-1">
            <p className={fieldLabel}>Tampilan di aplikasi</p>
            <div className="max-w-sm">
              <NoticeCard notice={{ text: text.trim(), tone }} />
            </div>
          </div>
        ) : null}

        {formError ? (
          <p role="alert" className="text-xs text-danger">
            {formError}
          </p>
        ) : null}

        {text.trim() ? (
          <ArmedButton
            label="Kirim"
            armedLabel={
              target === 'all' ? 'Ketuk lagi: kirim ke semua akun' : `Ketuk lagi: kirim ke ${nameOf(target)}`
            }
            onConfirm={send}
          />
        ) : (
          <p className="text-xs text-fg-muted">
            Tulis pesan dulu. Mengirim lagi ke tujuan yang sama menggantikan pesan sebelumnya.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Pesan terkirim</h2>
        {config === null || records === null ? <p className="text-xs text-fg-muted">Memuat…</p> : null}
        {config !== null && records !== null && entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-fg-muted">
            Belum ada pesan.
          </p>
        ) : null}
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {entries.map(({ target: entryTarget, notice }) => {
            const expired = isExpired(notice, now);
            return (
              <li key={entryTarget} className="space-y-1 p-3 text-xs">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entryTarget === 'all' ? 'Semua akun' : nameOf(entryTarget)}</span>
                  {notice.tone === 'penting' ? (
                    <span className="rounded-full border border-[var(--warn-strong)] px-2 py-0.5 text-[11px] font-semibold">
                      Penting
                    </span>
                  ) : null}
                  <span className={expired ? 'text-fg-faint' : 'text-fg-muted'}>
                    {notice.expiresAt
                      ? `${expired ? 'Sudah berakhir' : 'Berakhir'} ${stamp(notice.expiresAt)}`
                      : 'Tanpa batas'}
                  </span>
                  {notice.createdAt ? (
                    <span className="text-fg-faint">· dikirim {stamp(notice.createdAt)}</span>
                  ) : null}
                </p>
                <p className={['whitespace-pre-wrap break-words text-sm', expired ? 'text-fg-faint' : ''].join(' ')}>
                  {notice.text}
                </p>
                <div className="flex justify-end">
                  <ArmedButton
                    label="Hapus"
                    armedLabel="Ketuk lagi: hapus pesan"
                    danger
                    onConfirm={() => remove(entryTarget)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
