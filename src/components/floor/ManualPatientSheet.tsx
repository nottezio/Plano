import { useEffect, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { Button, Callout, Field, INPUT } from '@/components/common/ui';
import { addRosterPatient, writeRosterReport } from '@/data/repositories/floors.repo';
import { newRosterPatient } from '@/domain/floorList/floor';
import { DPJPS } from '@/domain/dpjp';
import { planRooms, wardPlan } from '@/domain/denahPlan';
import { manualPatient, type FloorPatient } from '@/domain/floorList/report';

const TEXTAREA = 'w-full rounded-lg border border-border bg-surface p-2 text-sm';

/**
 * Tambah / Ubah pasien manual (12.10). For patients with no SOAP in the floor
 * group — pediatri, but any patient (12.12, Avi: "it doesn't have to be a
 * pediatric patient"): every DPJP, none preselected. The user fills only the
 * diagnosis, therapy and plan (plus who and where), and the patient is then on
 * the denah and the list like any other, until marked Pulang/Pindah.
 */
export function ManualPatientSheet({
  open,
  onOpenChange,
  floorId,
  ward,
  date,
  myName,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floorId: string;
  ward: string;
  date: string;
  myName: string;
  /** A hand-entered patient to edit; null to add one. */
  editing: FloorPatient | null;
}): JSX.Element {
  const plan = wardPlan(ward);
  const rooms = plan ? planRooms(plan).map((slot) => slot.room).sort() : [];
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [dpjpId, setDpjpId] = useState('');
  const [identity, setIdentity] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [terapi, setTerapi] = useState('');
  const [planText, setPlanText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setRoom(editing?.room ?? '');
    setBed(editing?.bed ?? '');
    setDpjpId(editing?.dpjpId ?? '');
    setIdentity(editing?.identity ?? '');
    setDiagnosis(editing?.manualFields?.diagnosis ?? '');
    setTerapi(editing?.manualFields?.terapi ?? '');
    setPlanText(editing?.manualFields?.plan ?? '');
  }, [open, editing]);

  const save = async (): Promise<void> => {
    if (!identity.trim()) {
      setError('Isi identitas pasien (nama / tanggal lahir / umur / RM).');
      return;
    }
    if (!dpjpId) {
      setError('Pilih DPJP.');
      return;
    }
    if (!diagnosis.trim()) {
      setError('Isi diagnosis.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const patient = manualPatient({
        room: room.trim(),
        bed: bed.trim(),
        dpjpId: dpjpId || null,
        identity,
        fields: { diagnosis, terapi, plan: planText },
        // Filed on the list date being edited, so it appears on that list.
        sentAt: `${date}T${time}`,
        sender: myName,
        key: editing?.key,
      });
      // A new hand-entered patient joins the roster; an edit replaces only its SOAP.
      if (editing) await writeRosterReport(floorId, editing.key, patient);
      else await addRosterPatient(floorId, newRosterPatient(patient, now.toISOString(), myName));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };


  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Ubah pasien manual' : 'Tambah pasien manual'}
      description="Untuk pasien tanpa SOAP di grup (mis. pediatri). Tetap di list sampai ditandai Pulang/Pindah."
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Batal</Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Kamar" htmlFor="manual-room">
            {rooms.length > 0 ? (
              <select id="manual-room" value={room} onChange={(e) => setRoom(e.target.value)} className={INPUT}>
                <option value="">—</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <input id="manual-room" value={room} onChange={(e) => setRoom(e.target.value)} className={INPUT} />
            )}
          </Field>
          <Field label="Bed" htmlFor="manual-bed">
            <input id="manual-bed" value={bed} onChange={(e) => setBed(e.target.value)} inputMode="numeric" className={INPUT} />
          </Field>
          <Field label="DPJP" htmlFor="manual-dpjp">
            <select id="manual-dpjp" value={dpjpId} onChange={(e) => setDpjpId(e.target.value)} className={INPUT}>
              <option value="">—</option>
              {DPJPS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.initials}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Identitas" htmlFor="manual-identity">
          <input
            id="manual-identity"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder="An. Nama / 01-01-2020 / 6 tahun / RM 1234567"
            className={INPUT}
          />
        </Field>
        <Field label="Diagnosis" htmlFor="manual-dx">
          <textarea id="manual-dx" rows={4} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="- …" className={TEXTAREA} />
        </Field>
        <Field label="Terapi" htmlFor="manual-terapi">
          <textarea id="manual-terapi" rows={4} value={terapi} onChange={(e) => setTerapi(e.target.value)} placeholder="- …" className={TEXTAREA} />
        </Field>
        <Field label="Plan" htmlFor="manual-plan">
          <textarea id="manual-plan" rows={3} value={planText} onChange={(e) => setPlanText(e.target.value)} placeholder="- …" className={TEXTAREA} />
        </Field>
        <p className="text-xs text-fg-faint">
          Warna merah (H-1) / hijau (pulang hari ini) diatur di tab List, bukan dari isi Plan.
        </p>
        {error ? <Callout tone="warn">{error}</Callout> : null}
      </div>
    </Sheet>
  );
}
