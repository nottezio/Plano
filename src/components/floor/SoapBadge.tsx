import { formatDmy } from '@/domain/dateDmy';
import { markCss } from '@/domain/floorList/marks';
import { soapStamp, type FloorPatient } from '@/domain/floorList/report';

/**
 * Whether the SOAP shown is the newest (13.11, Avi: the list maker re-pastes
 * mid-day and needs to see which SOAPs were brought up to date): "SOAP baru"
 * — arrived after the last sent list; "SOAP dd/mm" — none yet on the list
 * date, the one shown is older.
 *
 * `compact` (the phone denah, 12 Nov 2026): dots only, the words for screen
 * readers and on hover.
 */
export function SoapBadge({ patient, compact = false }: { patient: FloorPatient; compact?: boolean }): JSX.Element | null {
  const fresh = patient.newBadge ? <NewDot label={patient.newBadge.label} color={markCss(patient.newBadge.color)} /> : null;
  const soap = soapBadge(patient, compact);
  return fresh || soap ? (
    <>
      {fresh}
      {soap}
    </>
  ) : null;
}

/**
 * Pasien baru (10 Nov 2026, its label and colour set per list in Setelan; screen only)
 * as a dot in that colour (12 Nov 2026): a pill on every row said nothing on a day when
 * every patient was new. The count with the label heads the List tab.
 */
export function NewDot({ label, color }: { label: string; color: string }): JSX.Element {
  return (
    <span title={`${label}: belum ada di list shift sebelumnya`} className="ml-1 inline-flex h-4 items-center align-middle">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function soapBadge(patient: FloorPatient, compact: boolean): JSX.Element | null {
  const at = soapStamp(patient);
  if (patient.soap === 'baru') {
    const title = `SOAP diperbarui ${at.slice(11, 16)}, setelah list terakhir dikirim`;
    if (compact) {
      return (
        <span title={title} className="ml-1 inline-flex h-4 items-center align-middle">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          <span className="sr-only">SOAP baru {at.slice(11, 16)}</span>
        </span>
      );
    }
    return (
      <span title={title} className="ml-1 inline-block rounded-full bg-accent px-1.5 align-middle text-[11px] font-semibold leading-4 text-on-accent">
        SOAP baru {at.slice(11, 16)}
      </span>
    );
  }
  if (patient.soap === 'lama') {
    const label = `SOAP ${formatDmy(at.slice(0, 10)).slice(0, 5)}`;
    if (compact) {
      return (
        <span title="Belum ada SOAP pada tanggal list ini" className="ml-1 inline-flex h-4 items-center align-middle">
          <span aria-hidden="true" className="h-2 w-2 rounded-full border border-fg-muted" />
          <span className="sr-only">{label}</span>
        </span>
      );
    }
    return (
      <span
        title="Belum ada SOAP pada tanggal list ini"
        className="ml-1 inline-block rounded-full border border-border px-1.5 align-middle text-[11px] font-semibold leading-4 text-fg-muted"
      >
        {label}
      </span>
    );
  }
  return null;
}
