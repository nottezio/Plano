import { useState } from 'react';

import {
  clearSessionLog,
  describeLastSignOut,
  readSessionLog,
  type SessionEvent,
} from '@/lib/sessionLog';

const LABELS: Record<SessionEvent['kind'], string> = {
  boot: 'Aplikasi dibuka',
  'signed-in': 'Masuk',
  'signed-out': 'Keluar',
  'profile-error': 'Gagal memuat pengaturan',
  'redirect-error': 'Gagal menyelesaikan login',
};

/**
 * The session log, read-only.
 *
 * It leads with the ONE reading that changes what to do next: whether the last
 * unexpected sign-out happened while the browser was online. Offline is a
 * dropped token refresh on ward wifi and a reload fixes it; online is the case
 * worth reporting. Everything under that line is the raw record, for when the
 * summary is not enough.
 *
 * No uid, no email, no token — see `sessionLog.ts`. This is meant to be
 * screenshot-able without thinking about it.
 */
export function SessionLogPanel(): JSX.Element {
  const [log, setLog] = useState(() => readSessionLog());
  const headline = describeLastSignOut(log);

  if (log.length === 0) {
    return <p className="text-xs text-fg-muted">Belum ada catatan sesi.</p>;
  }

  return (
    <div className="space-y-2 text-xs">
      {headline ? <p className="font-medium">{headline}</p> : null}

      <ul className="space-y-1">
        {[...log].reverse().map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="flex flex-wrap gap-x-2 text-fg-muted">
            <span className="font-mono text-[11px]">
              {new Date(entry.at).toLocaleString('id-ID')}
            </span>
            <span>{LABELS[entry.kind] ?? entry.kind}</span>
            {entry.online ? null : <span className="text-danger">offline</span>}
            {entry.detail ? <span className="font-mono text-[11px]">{entry.detail}</span> : null}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => {
          clearSessionLog();
          setLog([]);
        }}
        className="min-h-tap rounded-lg border border-border px-3 font-medium text-fg-muted"
      >
        Hapus catatan
      </button>
    </div>
  );
}
