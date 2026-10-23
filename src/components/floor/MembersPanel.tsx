import { useState } from 'react';

import { Button, Callout } from '@/components/common/ui';
import {
  cancelInvite,
  deleteFloor,
  writeJuniors,
  inviteMember,
  removeMember,
  setMemberRole,
  writeNickname,
} from '@/data/repositories/floors.repo';
import { canEdit, chiefsOf, isOwner, type FloorDoc, type FloorRole } from '@/domain/floorList/floor';
import { ChiefsField } from './ChiefsField';
import { MarksField } from './MarksField';
import type { FloorPatient } from '@/domain/floorList/report';

const ROLE_LABEL: Record<FloorRole, string> = { edit: 'Lihat dan edit', view: 'Lihat saja' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Anggota (12.8): who sees this floor's list and SOAPs, and who may change it.
 *
 * Members are added by the EMAIL of their Plano (Google) account; they see the
 * invite on their List Maker page and accept it. Only the owner invites,
 * changes roles and removes. Everyone can leave.
 *
 * Also the nicknames: how each WhatsApp sender is written in the list.
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
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FloorRole>('view');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Anggota ({floor.memberIds.length})</h3>
        <ul className="space-y-1.5">
          {floor.memberIds.map((member) => {
            const name = floor.names[member] || 'Anggota';
            const memberRole = floor.ownerUid === member ? 'edit' : (floor.roles[member] ?? 'view');
            return (
              <li key={member} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {name}
                  {member === uid ? ' (saya)' : ''}
                  {floor.ownerUid === member ? <span className="ml-1 text-xs text-fg-muted">· pemilik</span> : null}
                </span>
                {owner && member !== floor.ownerUid ? (
                  <>
                    <select
                      aria-label={`Peran ${name}`}
                      value={memberRole}
                      onChange={(event) => void setMemberRole(floor.id, member, event.target.value as FloorRole)}
                      className="min-h-tap rounded-lg border border-border bg-surface px-2 text-xs"
                    >
                      <option value="edit">{ROLE_LABEL.edit}</option>
                      <option value="view">{ROLE_LABEL.view}</option>
                    </select>
                    <Button size="sm" variant="danger" onClick={() => void removeMember(floor.id, member)}>
                      Keluarkan
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-fg-muted">{ROLE_LABEL[memberRole]}</span>
                )}
              </li>
            );
          })}
        </ul>

        {owner ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-xs font-semibold">Undang anggota</p>
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
            <p className="text-xs text-fg-faint">
              Anggota menerima undangan di halaman List Maker miliknya. Semua anggota bisa melihat SOAP lengkap pasien
              lantai ini.
            </p>
            {error ? <Callout tone="warn">{error}</Callout> : null}
            {floor.inviteEmails.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {floor.inviteEmails.map((invited) => (
                  <li key={invited} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {invited} · {ROLE_LABEL[floor.invites[invited] ?? 'view']} · menunggu
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => void cancelInvite(floor.id, invited)}>
                      Batalkan
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <Button variant="danger" onClick={() => void removeMember(floor.id, uid)}>
            Keluar dari list ini
          </Button>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Roster junior lantai</h3>
        <p className="text-xs text-fg-muted">
          Nama junior yang bertugas di lantai ini. Nama dari SOAP atau list yang ditulis sedikit berbeda (berspasi, huruf
          kecil, salah satu huruf) ditampilkan sesuai ejaan di sini. Chief diisi di atas, di kolom Chief.
        </p>
        {canEdit(floor, uid) ? (
          <ChiefsField
            label="Junior"
            id="floor-junior-input"
            noun="junior"
            chiefs={chiefsOf(floor.juniors)}
            onChange={(next) => void writeJuniors(floor.id, next.join(', '))}
          />
        ) : (
          <p className="text-xs">{chiefsOf(floor.juniors).join(', ') || '—'}</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Warna list</h3>
        <p className="text-xs text-fg-muted">
          Merah dan hijau tetap. Tambahkan warna lain yang dipakai lantai ini (mis. pre-op, tunggu ICU), lalu pilih di tab
          List pada kolom warna pasien. Ikut tampil di denah dan Word.
        </p>
        <MarksField floorId={floor.id} marks={floor.marks} editable={canEdit(floor, uid)} />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Nama panggilan pengirim</h3>
        <p className="text-xs text-fg-muted">
          Nama pengirim WhatsApp dipakai sebagai junior bila pesan tidak menulis &quot;Junior :&quot;. Ubah di sini bila
          panggilannya lain.
        </p>
        {senders.length === 0 ? <p className="text-xs text-fg-faint">Belum ada pengirim.</p> : null}
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
                  disabled={!canEdit(floor, uid)}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next !== (floor.nicknames[sender] ?? '')) void writeNickname(floor.id, sender, next);
                  }}
                  className="min-h-tap w-36 rounded-lg border border-border bg-surface px-2"
                />
              </li>
            );
          })}
        </ul>
      </section>
      {owner ? (
        <section className="space-y-2 rounded-xl border border-danger p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-danger">Hapus list</h3>
          <p className="text-xs text-fg-muted">
            Menghapus list ini untuk semua anggota: daftar pasien, SOAP, dan riwayat edisi. Tidak bisa dibatalkan.
          </p>
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
        </section>
      ) : null}
    </div>
  );
}
