import { useState } from 'react';

import { sendFeedback } from '@/data/repositories/feedback.repo';
import { MAX_FEEDBACK_CHARS, type FeedbackKind } from '@/domain/feedback';
import { useSession } from '@/store/useSession';

const KINDS: { id: FeedbackKind; label: string }[] = [
  { id: 'bug', label: 'Laporkan masalah' },
  { id: 'fitur', label: 'Saran fitur' },
];

/**
 * Send a bug report or a suggestion to the admin page.
 *
 * Not awaited: the write lands in the offline cache at once and is delivered
 * when online, like every other save, so the form clears straight away.
 */
export function FeedbackForm(): JSX.Element {
  const user = useSession((state) => state.user);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const send = (): void => {
    if (!user || !text.trim()) return;
    setError(false);
    void sendFeedback({ uid: user.uid, email: user.email ?? '' }, kind, text.trim()).catch(
      (cause: unknown) => {
        console.error('[feedback] send rejected', cause);
        setError(true);
      },
    );
    setText('');
    setSent(true);
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-1">
        {KINDS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={kind === option.id}
            onClick={() => setKind(option.id)}
            className={[
              'min-h-tap rounded-full border px-3 font-medium [@media(pointer:fine)]:min-h-8',
              kind === option.id ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label htmlFor="feedback-text" className="block text-fg-muted">
        {kind === 'bug'
          ? 'Apa yang terjadi, di layar mana, dan apa yang Anda harapkan?'
          : 'Fitur apa yang Anda butuhkan, dan untuk apa?'}
      </label>
      <textarea
        id="feedback-text"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setSent(false);
        }}
        rows={5}
        maxLength={MAX_FEEDBACK_CHARS}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      />
      <p className="text-fg-muted">
        Jangan tulis nama pasien atau No. RM.
        {kind === 'bug'
          ? ' Ikut terkirim: versi aplikasi, jenis perangkat, dan Riwayat sesi (termasuk kesalahan yang tercatat), tanpa isi catatan.'
          : ''}
      </p>
      <button
        type="button"
        onClick={send}
        disabled={!user || !text.trim()}
        className="min-h-tap rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
      >
        Kirim
      </button>
      {sent && !error ? (
        <p role="status" className="text-fg-muted">
          Terkirim. Terima kasih! Bila sedang offline, laporan dikirim saat tersambung.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger">
          Laporan ditolak server. Coba lagi nanti.
        </p>
      ) : null}
    </div>
  );
}
