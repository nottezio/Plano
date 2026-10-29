import { useState } from 'react';

import { SignOutButton } from '@/components/auth/SignOutButton';
import { AppShell } from '@/components/common/AppShell';
import { PageBody, SectionLabel } from '@/components/common/PageFrame';
import { Button, Callout, Field, INPUT } from '@/components/common/ui';
import { UsernameTakenError, claimUsername } from '@/data/repositories/usernames.repo';
import { parseUsername } from '@/domain/username';
import { useSession } from '@/store/useSession';

/**
 * The account: who is signed in, the public username colleagues can send a
 * patient to (Kirim ke rekan), and signing out. Name and email come from
 * Google and are shown, not edited: the profile copies them on every sign-in.
 */
export default function AccountPage(): JSX.Element {
  const user = useSession((state) => state.user);
  const current = useSession((state) => state.profile?.username);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'accent'; text: string } | null>(null);

  const name = user?.displayName?.trim() || user?.email || 'Akun';
  const showForm = editing || !current;

  const save = (): void => {
    if (!user) return;
    const parsed = parseUsername(draft);
    if ('error' in parsed) {
      setMessage({ tone: 'danger', text: parsed.error });
      return;
    }
    if (parsed.handle === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setMessage(null);
    claimUsername(user.uid, parsed.handle, name, current)
      .then(() => {
        setEditing(false);
        setDraft('');
        setMessage({ tone: 'accent', text: `Username @${parsed.handle} tersimpan.` });
      })
      .catch((e: unknown) => {
        if (e instanceof UsernameTakenError) {
          setMessage({ tone: 'danger', text: `@${parsed.handle} sudah dipakai. Coba yang lain.` });
          return;
        }
        console.error('[account] username not saved', e);
        setMessage({ tone: 'danger', text: 'Gagal menyimpan. Perlu koneksi internet; coba lagi.' });
      })
      .finally(() => setSaving(false));
  };

  return (
    <AppShell title="Akun">
      <PageBody className="mx-auto max-w-xl space-y-8">
        <section>
          <SectionLabel title="Profil" />
          <p className="text-base font-semibold text-fg">{name}</p>
          <p className="truncate text-sm text-fg-muted">{user?.email ?? '—'}</p>
          <p className="mt-1 text-xs text-fg-faint">Nama dan email mengikuti akun Google Anda.</p>
        </section>

        <section className="space-y-3">
          <SectionLabel title="Username" />
          <p className="text-xs leading-relaxed text-fg-muted">
            Rekan bisa mengirim pasien ke Anda (Kirim ke rekan) dengan mengetik username ini,
            tanpa perlu tahu email Anda. Username tidak bisa dicari atau didaftar oleh pengguna
            lain; hanya yang mengetik persis yang menemukannya.
          </p>
          {current && !editing ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">@{current}</span>
              <Button
                size="sm"
                onClick={() => {
                  setDraft(current);
                  setEditing(true);
                  setMessage(null);
                }}
              >
                Ubah
              </Button>
            </div>
          ) : null}
          {showForm ? (
            <div className="space-y-2">
              <Field label={current ? 'Username baru' : 'Pilih username'} htmlFor="account-username">
                <input
                  id="account-username"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') save();
                  }}
                  placeholder="mis. dr.rina"
                  className={INPUT}
                />
              </Field>
              <p className="text-xs text-fg-faint">
                3–20 karakter: huruf kecil, angka, titik, garis bawah.
                {current ? ' Username lama dilepas dan bisa dipakai orang lain.' : ''}
              </p>
              <div className="flex gap-2">
                {current ? (
                  <Button onClick={() => setEditing(false)} disabled={saving}>
                    Batal
                  </Button>
                ) : null}
                <Button variant="primary" onClick={save} disabled={saving || !draft.trim()}>
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </Button>
              </div>
            </div>
          ) : null}
          {message ? (
            <Callout
              tone={message.tone}
              role={message.tone === 'danger' ? 'alert' : 'status'}
              title={message.text}
            />
          ) : null}
        </section>

        <section>
          <SectionLabel title="Keluar" />
          <SignOutButton className="min-h-tap w-full rounded-lg border border-border px-3 text-sm text-danger" />
          <p className="mt-2 text-xs text-fg-faint">
            Keluar menghapus seluruh data offline di perangkat ini dan memuat ulang aplikasi.
          </p>
        </section>
      </PageBody>
    </AppShell>
  );
}
