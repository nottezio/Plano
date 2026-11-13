import { useEffect, useState } from 'react';

import { pickNotice, type AccessNotice } from '@/domain/notice';
import { IconBell, IconClose } from './Icons';

const CLOSED_KEY = 'plano.noticeClosed';
const KEEP_CLOSED = 20;
// setTimeout overflows past ~24.8 days; a longer wait re-checks and waits again.
const MAX_TIMER_MS = 2_000_000_000;

function readClosed(uid: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`${CLOSED_KEY}.${uid}`) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeClosed(uid: string, ids: string[]): void {
  try {
    localStorage.setItem(`${CLOSED_KEY}.${uid}`, JSON.stringify(ids.slice(-KEEP_CLOSED)));
  } catch {
    // No storage: the message simply shows again on the next visit. Harmless.
  }
}

/**
 * The admin's message: personal first, then the one for everyone.
 *
 * Closing is remembered on this device only (no write). It disappears by
 * itself when it expires, without a reload. Mounted at the top of the screen
 * so it never competes with the update banners at the bottom.
 */
export function NoticeBanner({
  uid,
  own,
  everyone,
}: {
  uid: string;
  own: AccessNotice | null;
  everyone: AccessNotice | null;
}): JSX.Element | null {
  const [closed, setClosed] = useState(() => readClosed(uid));
  const [, wake] = useState(0);

  const notice = pickNotice([own, everyone], closed, Date.now());
  const expiresAt = notice?.expiresAt?.getTime() ?? null;

  useEffect(() => {
    if (expiresAt === null) return undefined;
    const left = expiresAt - Date.now();
    if (left <= 0) return undefined;
    const timer = window.setTimeout(() => wake((count) => count + 1), Math.min(left, MAX_TIMER_MS));
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  if (!notice) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+8px)] z-[60] sm:left-auto sm:right-4 sm:w-96">
      <NoticeCard
        notice={notice}
        onClose={() => {
          const next = [...closed, notice.id];
          setClosed(next);
          writeClosed(uid, next);
        }}
      />
    </div>
  );
}

/** The card itself, also used for the admin's preview. */
export function NoticeCard({
  notice,
  onClose,
}: {
  notice: Pick<AccessNotice, 'text' | 'tone'>;
  onClose?: () => void;
}): JSX.Element {
  const important = notice.tone === 'penting';
  return (
    <div
      role={important ? 'alert' : 'status'}
      className={[
        'pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface-raised py-3 pl-4 pr-1 shadow-pop',
        important ? 'border-[var(--warn-strong)]' : 'border-border',
      ].join(' ')}
    >
      <IconBell className={['mt-0.5 shrink-0', important ? 'text-[var(--warn-strong)]' : 'text-accent'].join(' ')} />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-sm">{notice.text}</p>
        <p className="mt-1 text-xs text-fg-muted">Pesan dari admin</p>
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pesan"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted"
        >
          <IconClose />
        </button>
      ) : null}
    </div>
  );
}
