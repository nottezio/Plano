import { useState } from 'react';
import { Footer } from '@/components/common/Footer';
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
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Plano</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Catatan visite pasien. Masuk sekali, lalu bisa dipakai offline.
          </p>

          <button
            type="button"
            onClick={() => void onGoogle()}
            disabled={busy}
            className="mt-6 min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Membuka Google…' : 'Masuk dengan Google'}
          </button>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <p className="mt-8 rounded-lg border border-border bg-bg-subtle p-3 text-[11px] leading-relaxed text-fg-muted">
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
