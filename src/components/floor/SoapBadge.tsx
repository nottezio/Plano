import { formatDmy } from '@/domain/dateDmy';
import type { FloorPatient } from '@/domain/floorList/report';

/**
 * Whether the SOAP shown is the newest (13.11, Avi: the list maker re-pastes
 * mid-day and needs to see which SOAPs were brought up to date): "SOAP baru"
 * — arrived after the last sent list; "SOAP dd/mm" — none yet on the list
 * date, the one shown is older.
 */
export function SoapBadge({ patient }: { patient: FloorPatient }): JSX.Element | null {
  if (patient.soap === 'baru') {
    return (
      <span
        title={`SOAP diperbarui ${patient.sentAt.slice(11, 16)}, setelah list terakhir dikirim`}
        className="ml-1 inline-block rounded-full bg-accent px-1.5 align-middle text-[10px] font-semibold leading-4 text-on-accent"
      >
        SOAP baru {patient.sentAt.slice(11, 16)}
      </span>
    );
  }
  if (patient.soap === 'lama') {
    return (
      <span
        title="Belum ada SOAP pada tanggal list ini"
        className="ml-1 inline-block rounded-full border border-border px-1.5 align-middle text-[10px] font-semibold leading-4 text-fg-muted"
      >
        SOAP {formatDmy(patient.sentAt.slice(0, 10)).slice(0, 5)}
      </span>
    );
  }
  return null;
}
