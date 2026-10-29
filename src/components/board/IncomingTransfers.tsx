import { useEffect, useState } from 'react';

import { Button, Callout } from '@/components/common/ui';
import {
  acceptTransfer,
  clearTransfer,
  subscribeIncomingTransfers,
} from '@/data/repositories/patients.repo';
import { formatLocation } from '@/domain/identity';
import type { Patient } from '@/domain/types';
import { useSession } from '@/store/useSession';

/**
 * Patients a colleague sent to this account (see `domain/transfer`), above
 * the board until accepted or declined. Accepting moves the patient here with
 * all its notes; declining leaves it with the sender.
 *
 * Needs a connection: a request is only visible once the sender's write has
 * reached the server. Errors are shown, never swallowed, because a silent
 * failure here would look like nobody sent anything.
 */
export function IncomingTransfers(): JSX.Element | null {
  const uid = useSession((state) => state.user?.uid ?? null);
  const email = useSession((state) => state.user?.email ?? null);
  const [incoming, setIncoming] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return undefined;
    return subscribeIncomingTransfers(email, setIncoming, (e) => {
      console.error('[transfer] incoming query failed', e);
      setError('Kiriman pasien tidak bisa dimuat.');
    });
  }, [email]);

  if (!uid || (incoming.length === 0 && !error)) return null;

  const act = (patientId: string, action: () => Promise<void>): void => {
    setBusy(patientId);
    setError(null);
    action()
      .catch((e: unknown) => {
        console.error('[transfer] action failed', e);
        setError('Gagal. Periksa koneksi lalu coba lagi.');
      })
      .finally(() => setBusy(null));
  };

  return (
    <div className="space-y-2 px-4 pt-3">
      {error ? <Callout tone="danger" role="alert" title={error} /> : null}
      {incoming.map((patient) => {
        const detail = [formatLocation(patient) || null, patient.diagnoses?.[0] ?? null]
          .filter(Boolean)
          .join(' · ');
        return (
          <Callout
            key={patient.id}
            role="status"
            title={`${patient.transferFrom?.name || 'Rekan'} mengirim pasien: ${patient.name?.trim() || 'Tanpa nama'}`}
            action={
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === patient.id}
                  onClick={() => act(patient.id, () => clearTransfer(patient.id))}
                >
                  Tolak
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy === patient.id}
                  onClick={() => act(patient.id, () => acceptTransfer(patient.id, uid))}
                >
                  Terima
                </Button>
              </div>
            }
          >
            {detail || null}
          </Callout>
        );
      })}
    </div>
  );
}
