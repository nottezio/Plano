import { useEffect, useState, type ReactNode } from 'react';
import { cleanReload } from '@/lib/cleanReload';
import { useSession } from '@/store/useSession';
import { Footer } from '@/components/common/Footer';
import { LockScreen } from '@/components/privacy/LockScreen';
import { useLock } from '@/store/useLock';
import { AccessGate } from './AccessGate';
import { SignInPage } from './SignInPage';

/**
 * Renders nothing clinical until the session is known. The four states are
 * distinct on purpose: a misconfigured build must not look like a sign-out,
 * and a slow boot must not look like a crash.
 */
export function AuthGate({ children }: { children: ReactNode }): JSX.Element {
  const status = useSession((state) => state.status);
  const missingConfig = useSession((state) => state.missingConfig);
  const locked = useLock((state) => state.locked);

  if (status === 'loading') return <Booting />;

  if (status === 'unconfigured') {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <h1 className="text-lg font-semibold">Konfigurasi Firebase belum lengkap</h1>
            <p className="mt-2 text-sm text-fg-muted">
              Build ini tidak memiliki variabel berikut:
            </p>
            <ul className="mt-2 space-y-1 font-mono text-xs text-danger">
              {missingConfig.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-fg-muted">
              Isi <code>.env.local</code> (lihat <code>.env.example</code>) atau set
              repository variables untuk deploy GitHub Pages.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (status === 'signed-out') return <SignInPage />;

  // The lock sits above the app rather than replacing it, so unlocking returns
  // the user to exactly the note they were on — including unsaved draft text,
  // which lives in the draft store and was flushed on backgrounding.
  if (locked) return <LockScreen />;

  // Signed in is not the same as allowed: see AccessGate.
  return <AccessGate>{children}</AccessGate>;
}

/**
 * The boot screen. After a while it says why it may be slow and offers the
 * phone's Ctrl+Shift+R, so a stuck start is never a dead end.
 */
function Booting(): JSX.Element {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-fg-muted">
      <p>Memuat…</p>
      {slow ? (
        <>
          <p className="max-w-xs text-xs">
            Masih menunggu koneksi. Catatan Anda aman di perangkat ini. Kalau tidak berubah, coba
            muat ulang bersih (kode aplikasi diunduh ulang; catatan tidak dihapus).
          </p>
          <button
            type="button"
            onClick={() => void cleanReload()}
            className="min-h-tap rounded-lg border border-border px-4 text-sm text-fg"
          >
            Muat ulang bersih
          </button>
        </>
      ) : null}
    </div>
  );
}
