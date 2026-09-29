import { useState } from 'react';

import { signOutAndClear } from '@/store/useSession';

/**
 * Keluar, with the one question that matters asked first.
 *
 * When changes have not reached the server, signing out deletes them (the
 * device is the only copy). The button then says so and offers to wait or
 * to sign out anyway, instead of doing it silently.
 */
export function SignOutButton({
  className,
  children = 'Keluar',
}: {
  className: string;
  children?: React.ReactNode;
}): JSX.Element {
  const [state, setState] = useState<'idle' | 'checking' | 'unsynced'>('idle');

  const run = async (force: boolean): Promise<void> => {
    setState('checking');
    const result = await signOutAndClear({ force });
    if (result === 'unsynced') setState('unsynced');
  };

  return (
    <>
      <button
        type="button"
        disabled={state === 'checking'}
        onClick={() => void run(false)}
        className={className}
      >
        {state === 'checking' ? 'Menyimpan & memeriksa…' : children}
      </button>
      {state === 'unsynced' ? (
        <div role="alert" className="mt-2 rounded-lg border border-danger p-3 text-left text-xs text-fg">
          <p>
            Ada perubahan yang <strong>belum terkirim ke server</strong> (sinyal?). Keluar sekarang
            akan <strong>menghapusnya</strong> dari perangkat ini.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setState('idle')}
              className="min-h-tap flex-1 rounded-lg border border-border px-2 text-xs"
            >
              Tunggu sinyal
            </button>
            <button
              type="button"
              onClick={() => void run(true)}
              className="min-h-tap flex-1 rounded-lg border border-danger px-2 text-xs text-danger"
            >
              Keluar tetap
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
