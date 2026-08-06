import type { ReactNode } from 'react';
import { useSession } from '@/store/useSession';
import { Footer } from '@/components/common/Footer';
import { LockScreen } from '@/components/privacy/LockScreen';
import { useLock } from '@/store/useLock';
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

  if (status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-sm text-fg-muted">
        Memuat…
      </div>
    );
  }

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

  return <>{children}</>;
}
