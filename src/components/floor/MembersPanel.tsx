import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { IconChevronRight } from '@/components/common/Icons';
import { TwoTapButton } from '@/components/common/TwoTapButton';
import { Button, Callout, Section } from '@/components/common/ui';
import {
  cancelInvite,
  deleteFloor,
  writeJuniors,
  inviteMember,
  removeMember,
  transferOwnership,
  setMemberRole,
  writeNickname,
} from '@/data/repositories/floors.repo';
import { canEdit, chiefsOf, isOwner, type FloorDoc, type FloorRole } from '@/domain/floorList/floor';
import { collapseNicknames, confirmQuestion, memberRole, saveErrorMessage, transferQuestion } from '@/domain/floorList/membersView';
import { ChiefsField } from './ChiefsField';
import { MarksField } from './MarksField';
import type { FloorPatient } from '@/domain/floorList/report';

const ROLE_LABEL: Record<FloorRole, string> = { edit: 'Lihat dan edit', view: 'Lihat saja' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A titled card: the group a block belongs to, so the tab reads as four things, not five. */
function Group({ title, tone = 'normal', children }: { title: string; tone?: 'normal' | 'danger'; children: ReactNode }): JSX.Element {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className={`px-1 text-sm font-semibold ${tone === 'danger' ? 'text-danger' : ''}`}>
        {title}
      </h2>
      <div className={`space-y-4 rounded-xl border bg-surface p-3 ${tone === 'danger' ? 'border-danger' : 'border-border'}`}>{children}</div>
    </section>
  );
}

/**
 * Setelan (12.8, tidied 26 Oct 2026): who sees this floor's list and SOAPs, who
 * may change it, and the list's own roster, colours and nicknames.
 *
 * Members are added by the EMAIL of their Plano (Google) account; they see the
 * invite on their List Maker page and accept it. Only the owner invites,
 * changes roles and removes. Everyone can leave.
 *
 * Grouped by what it is for — Tim, Nama dan residen, Tampilan list, Zona
 * berbahaya — and every write that can be refused says so (`problem`), instead
 * of failing quietly. Removing a person, or leaving, takes a second tap.
 */
export function MembersPanel({
  floor,
  uid,
  patients,
}: {
  floor: FloorDoc;
  uid: string;
  patients: readonly FloorPatient[];
}): JSX.Element {
  const owner = isOwner(floor, uid);
  const editor = canEdit(floor, uid);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FloorRole>('view');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  /** A write the server refused, in words; stays until dismissed or the next write works. */
  const [problem, setProblem] = useState('');
  /** A short "saved" for changes that apply at once, so the tap is not left unanswered. */
  const [saved, setSaved] = useState('');
  const savedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  /** Run a write; confirm it, or say why it was refused. */
  const run = (write: () => Promise<unknown>, done = 'Tersimpan ✓'): void => {
    void write()
      .then(() => {
        setProblem('');
        setSaved(done);
        window.clearTimeout(savedTimer.current);
        savedTimer.current = window.setTimeout(() => setSaved(''), 2500);
      })
      .catch((e: unknown) => setProblem(saveErrorMessage(e)));
  };

  const remove = async (): Promise<void> => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteFloor(floor.id);
    } catch (e) {
      setDeleteError(
        e instanceof Error && /offline|unavailable/i.test(e.message)
          ? 'Butuh koneksi internet untuk menghapus list.'
          : e instanceof Error
            ? e.message
            : 'Gagal menghapus.',
      );
      setDeleting(false);
    }
  };
  const senders = [...new Set(patients.map((p) => p.sender).filter(Boolean))].sort();

  const invite = async (): Promise<void> => {
    const key = email.trim().toLowerCase();
    if (!EMAIL.test(key)) {
      setError('Tulis email akun Google yang dipakai untuk masuk Plano.');
      return;
    }
    setError('');
    try {
      await inviteMember(floor.id, key, role);
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengundang.');
    }
  };

  const nicknameRows = (
    <ul className="space-y-1.5">
      {senders.map((sender) => {
        const derived = patients.find((p) => p.sender === sender)?.senderNick ?? '';
        return (
          <li key={sender} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate">{sender}</span>
            <input
              key={floor.nicknames[sender] ?? ''}
              aria-label={`Panggilan ${sender}`}
              defaultValue={floor.nicknames[sender] ?? ''}
              placeholder={derived || 'Panggilan'}
              disabled={!editor}
              onBlur={(event) => {
                const next = event.target.value.trim();
                if (next !== (floor.nicknames[sender] ?? '')) run(() => writeNickname(floor.id, sender, next));
              }}
              className="min-h-tap w-36 rounded-lg border border-border bg-surface px-2"
            />
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-5">
      {problem ? (
        <Callout
          tone="warn"
          role="alert"
          title="Perubahan belum tersimpan"
          action={
            <Button size="sm" variant="ghost" onClick={() => setProblem('')}>
              Tutup
            </Button>
          }
        >
          {problem}
        </Callout>
      ) : null}
      <p role="status" aria-live="polite" className="h-4 px-1 text-xs text-fg-muted">
        {saved}
      </p>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Group title="Tim">
          <Section title={`Anggota (${floor.memberIds.length})`}>
            <ul className="space-y-1.5">
              {floor.memberIds.map((member) => {
                const name = floor.names[member] || 'Anggota';
                const current = memberRole(floor, member);
                return (
                  <li key={member} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {name}
                      {member === uid ? ' (saya)' : ''}
                      {floor.ownerUid === member ? <span className="ml-1 text-xs text-fg-muted">· pemilik</span> : null}
                    </span>
                    {owner && member !== floor.ownerUid ? (
                      <>
                        <select
                          aria-label={`Peran ${name}`}
                          value={current}
                          onChange={(event) => run(() => setMemberRole(floor.id, member, event.target.value as FloorRole), 'Peran diubah ✓')}
                          className="min-h-tap rounded-lg border border-border bg-surface px-2 text-xs"
                        >
                          <option value="edit">{ROLE_LABEL.edit}</option>
                          <option value="view">{ROLE_LABEL.view}</option>
                        </select>
                        <TwoTapButton
                          label="Jadikan pemilik"
                          ariaLabel={`Jadikan ${name} pemilik list`}
                          question={transferQuestion(name)}
                          confirmLabel="Ya, pindahkan"
                          busyLabel="Memindahkan…"
                          onConfirm={() => transferOwnership(floor.id, member)}
                          onError={(e) => setProblem(saveErrorMessage(e))}
                        />
                        <TwoTapButton
                          label="Keluarkan"
                          ariaLabel={`Keluarkan ${name}`}
                          question={confirmQuestion('remove', name)}
                          confirmLabel="Ya, keluarkan"
                          busyLabel="Mengeluarkan…"
                          onConfirm={() => removeMember(floor.id, member)}
                          onError={(e) => setProblem(saveErrorMessage(e))}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-fg-muted">{ROLE_LABEL[current]}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>

          {owner ? (
            <Section title="Undang anggota" hint="Anggota menerima undangan di List Maker miliknya dan bisa melihat SOAP lengkap pasien lantai ini.">
              <div className="flex flex-wrap gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@gmail.com"
                  aria-label="Email anggota"
                  className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
                />
                <select
                  aria-label="Peran anggota baru"
                  value={role}
                  onChange={(event) => setRole(event.target.value as FloorRole)}
                  className="min-h-tap rounded-lg border border-border bg-surface px-2 text-sm"
                >
                  <option value="view">{ROLE_LABEL.view}</option>
                  <option value="edit">{ROLE_LABEL.edit}</option>
                </select>
                <Button variant="primary" onClick={() => void invite()}>
                  Undang
                </Button>
              </div>
              {error ? <Callout tone="warn">{error}</Callout> : null}
              {floor.inviteEmails.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {floor.inviteEmails.map((invited) => (
                    <li key={invited} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {invited} · {ROLE_LABEL[floor.invites[invited] ?? 'view']} · menunggu
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => run(() => cancelInvite(floor.id, invited), 'Undangan dibatalkan ✓')}>
                        Batalkan
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>
          ) : null}
        </Group>

        <div className="space-y-5">
          <Group title="Nama dan residen">
            <Section
              title="Roster junior lantai"
              hint="Nama dari SOAP atau list yang ditulis sedikit berbeda ditampilkan sesuai ejaan di sini. Chief diisi di header."
            >
              {editor ? (
                <ChiefsField
                  label="Junior"
                  id="floor-junior-input"
                  noun="junior"
                  chiefs={chiefsOf(floor.juniors)}
                  onChange={(next) => run(() => writeJuniors(floor.id, next.join(', ')))}
                />
              ) : (
                <p className="text-xs">{chiefsOf(floor.juniors).join(', ') || '—'}</p>
              )}
            </Section>

            <Section title="Nama panggilan pengirim" hint="Dipakai sebagai junior bila pesan tidak menulis “Junior :”. Ubah bila panggilannya lain.">
              {senders.length === 0 ? <p className="text-xs text-fg-faint">Belum ada pengirim.</p> : null}
              {collapseNicknames(senders.length) ? (
                <details className="group rounded-xl border border-border px-3 py-1">
                  <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 py-2 text-sm font-medium">
                    <span className="flex-1">{senders.length} pengirim</span>
                    <IconChevronRight aria-hidden="true" width={16} height={16} className="shrink-0 text-fg-muted transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="pb-2">{nicknameRows}</div>
                </details>
              ) : (
                nicknameRows
              )}
            </Section>
          </Group>

          <Group title="Tampilan list">
            <Section
              title="Warna list"
              hint="Merah dan hijau tetap. Tambah warna lain yang dipakai lantai ini (mis. pre-op, tunggu ICU), lalu pilih di tab List. Ikut tampil di denah dan Word."
            >
              <MarksField floorId={floor.id} marks={floor.marks} editable={editor} />
            </Section>
          </Group>
        </div>
      </div>

      <Group title="Zona berbahaya" tone="danger">
        {owner ? (
          <Section
            title="Hapus list"
            hint="Menghapus list ini untuk semua anggota: daftar pasien, SOAP, dan riwayat edisi. Tidak bisa dibatalkan."
          >
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold">Hapus &quot;{floor.name}&quot;?</span>
                <Button variant="danger" size="sm" onClick={() => void remove()} disabled={deleting}>
                  {deleting ? 'Menghapus…' : 'Ya, hapus'}
                </Button>
                <Button size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Batal
                </Button>
              </div>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Hapus list…
              </Button>
            )}
            {deleteError ? <Callout tone="warn">{deleteError}</Callout> : null}
          </Section>
        ) : (
          <Section title="Keluar dari list" hint="Anda tidak lagi melihat list ini sampai pemilik mengundang Anda lagi.">
            <TwoTapButton
              label="Keluar dari list ini"
              question={confirmQuestion('leave')}
              confirmLabel="Ya, keluar"
              busyLabel="Keluar…"
              onConfirm={() => removeMember(floor.id, uid)}
              onError={(e) => setProblem(saveErrorMessage(e))}
            />
          </Section>
        )}
      </Group>
    </div>
  );
}
