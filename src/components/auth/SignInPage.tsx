import { useState } from 'react';
import { Footer } from '@/components/common/Footer';
import { Button } from '@/components/common/ui';
import { signInWithGoogle, useSession } from '@/store/useSession';

/**
 * Google only.
 *
 * The email/password form stayed on this page after the provider was
 * switched off in Firebase: new password sign-ins were refused by Firebase
 * (`auth/operation-not-allowed`), but the form invited them, and sessions
 * made with a password BEFORE the switch kept working, because disabling a
 * provider does not sign anyone out. Those are now closed at the server
 * (`firestore.rules`, `signedInWithGoogle`) and in the app (`AccessGate`).
 */
export function SignInPage(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const error = useSession((state) => state.error);
  const setError = useSession((state) => state.setError);

  const onGoogle = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      // Message already set on the store by the session layer.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[var(--app-h,100dvh)] flex-col bg-bg">
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-pop sm:p-8">
          <img
            src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-2xl shadow-card ring-1 ring-border"
          />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Plano</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
            Catatan visite pasien. Masuk sekali, lalu bisa dipakai offline.
          </p>

          <Button variant="primary" full className="mt-6" onClick={() => void onGoogle()} disabled={busy}>
            {busy ? 'Membuka Google…' : 'Masuk dengan Google'}
          </Button>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-fg-muted">
            Aplikasi ini menyimpan data pasien. Anda bertanggung jawab atas kepatuhan
            terhadap kebijakan rumah sakit dan UU PDP No. 27/2022. Kunci PIN dan tampilan
            inisial di papan diatur di Pengaturan → Privasi.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
