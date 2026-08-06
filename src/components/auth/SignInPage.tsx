import { useState, type FormEvent } from 'react';
import { Footer } from '@/components/common/Footer';
import {
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
  useSession,
} from '@/store/useSession';

type Mode = 'signin' | 'register';

export function SignInPage(): JSX.Element {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const error = useSession((state) => state.error);
  const setError = useSession((state) => state.setError);

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') await signInWithEmail(email, password);
      else await registerWithEmail(email, password, displayName);
    } catch {
      // Message already set on the store by the session layer.
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      // Same.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Visite</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Catatan visite pasien. Masuk sekali, lalu bisa dipakai offline.
          </p>

          <button
            type="button"
            onClick={() => void onGoogle()}
            disabled={busy}
            className="mt-6 min-h-tap w-full rounded-lg border border-border bg-surface px-4 text-sm font-medium disabled:opacity-50"
          >
            Masuk dengan Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] text-fg-faint">
            <span className="h-px flex-1 bg-border" />
            atau
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
            {mode === 'register' ? (
              <Field
                label="Nama"
                type="text"
                value={displayName}
                autoComplete="name"
                onChange={setDisplayName}
              />
            ) : null}
            <Field
              label="Email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={setEmail}
            />
            <Field
              label="Kata sandi"
              type="password"
              value={password}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              onChange={setPassword}
            />

            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {mode === 'signin' ? 'Masuk' : 'Daftar'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode(mode === 'signin' ? 'register' : 'signin');
            }}
            className="mt-4 w-full text-center text-xs text-accent underline"
          >
            {mode === 'signin' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </button>

          <p className="mt-8 rounded-lg border border-border bg-bg-subtle p-3 text-[11px] leading-relaxed text-fg-muted">
            Aplikasi ini menyimpan data pasien. Anda bertanggung jawab atas kepatuhan
            terhadap kebijakan rumah sakit dan UU PDP No. 27/2022. Kunci PIN aktif secara
            bawaan dan papan hanya menampilkan inisial.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Field({
  label,
  type,
  value,
  autoComplete,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
      />
    </label>
  );
}
