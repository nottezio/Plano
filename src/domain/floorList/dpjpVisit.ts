import { formatDmy } from '@/domain/dateDmy';
import { aliasesOrDefault } from '@/domain/sections/aliases';
import { visiteSummary } from '@/domain/visite';
import { byRoute, dpjpOrder, dpjpTitle, patientLine } from './build';
import type { FloorPatient } from './report';

/**
 * Ringkasan visite DPJP (11 Nov 2026, Avi): when a DPJP comes round, their
 * patients in visit-route order, each with Diagnosis, Terapi and Plan.
 *
 * The lines are picked by Visite mode's reader (`visiteSummary`), so they are
 * slices of the SOAP, never rewritten; a TS block's own A/P is left out.
 * KJS patients (filed under another DPJP) come along in route order, marked.
 */
export interface VisitRow {
  patient: FloorPatient;
  /** Seen as KJS, filed under another DPJP. */
  kjs: boolean;
  dx: string[];
  tx: string[];
  plan: string[];
}

const seenBy = (id: string) => (p: FloorPatient): boolean => p.dpjpId === id || p.kjsDpjpIds.includes(id);

/** The DPJPs with a patient on the list, in the list message's DPJP order, with their count (own + KJS). */
export function visitDpjps(patients: readonly FloorPatient[]): Array<{ id: string; count: number }> {
  return dpjpOrder(patients)
    .map((id) => ({ id, count: patients.filter(seenBy(id)).length }))
    .filter((d) => d.count > 0);
}

const linesOf = (text: string): string[] => text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());

function summaryOf(patient: FloorPatient): Pick<VisitRow, 'dx' | 'tx' | 'plan'> {
  // A hand-entered patient has the three fields as typed.
  const m = patient.manualFields;
  if (m) return { dx: linesOf(m.diagnosis), tx: linesOf(m.terapi), plan: linesOf(m.plan) };
  const { sections } = visiteSummary(patient.full, aliasesOrDefault(undefined));
  const of = (id: string): string[] => sections.find((s) => s.id === id)?.lines ?? [];
  return { dx: of('diagnosis'), tx: of('terapi'), plan: of('plan') };
}

export function dpjpVisit(patients: readonly FloorPatient[], dpjpId: string, ward: string): VisitRow[] {
  return patients
    .filter(seenBy(dpjpId))
    .sort(byRoute(ward))
    .map((patient) => ({ patient, kjs: patient.dpjpId !== dpjpId, ...summaryOf(patient) }));
}

const FLAG = { tomorrow: ' (H-1)', today: ' (Pulang hari ini)' } as const;

/** The summary as WhatsApp text: one numbered block per patient. */
export function dpjpVisitText(dpjpId: string, date: string, rows: readonly VisitRow[]): string {
  const block = (title: string, lines: string[]): string[] => (lines.length > 0 ? [`${title}:`, ...lines] : []);
  const out = [`*Ringkasan visite ${dpjpTitle(dpjpId)} — ${formatDmy(date)}*`];
  rows.forEach((row, k) => {
    const flag = row.patient.discharge ? FLAG[row.patient.discharge] : '';
    out.push('', `*${k + 1}. ${patientLine(row.patient)}${flag}${row.kjs ? ' · KJS' : ''}*`);
    out.push(...block('Dx', row.dx), ...block('Tx', row.tx), ...block('Plan', row.plan));
  });
  return out.join('\n');
}
