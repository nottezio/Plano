/**
 * The printed denah, as data.
 *
 * `DenahView` used to say this, and it was right at the time:
 *
 *   "Rooms flow in a responsive grid rather than being positioned to match the
 *   physical building. Reproducing the real geometry would need a per-ward map
 *   that someone has to draw and maintain."
 *
 * The map now exists — it is the sheet on the wall of PJT Lantai 4, and it is
 * transcribed below. That changes the calculation: the cost was drawing it, and
 * the sheet is already drawn. What is left is keeping it in step with the ward,
 * which is a real cost but a small and visible one.
 *
 * It matters because the two orders are not the same. Numeric order puts 409
 * next to 410; the corridor puts 409 opposite 413, and 420 and 421 are at the
 * far end past the nurse station. A resident reading this while walking is
 * matching it against the wall, not against a sorted list.
 *
 * WHAT IS AND IS NOT REPRODUCED
 *
 * Three columns in the printed order, with the rooms stacked down each. Row
 * heights are NOT aligned across columns — 419 holds four beds and 402 holds
 * one, and forcing them onto shared rows would either stretch the small rooms
 * or clip the large ones. The sheet is read column by column, so the columns
 * are what is preserved.
 *
 * Bed counts are the numbered slots on the sheet, not a guess at the furniture.
 * An empty bed is drawn as empty: an omitted bed is indistinguishable from a
 * bed that does not exist, and on a floor plan that difference is the point.
 */

export interface DenahRoomSlot {
  /** Room number as the sheet writes it, and as `patient.room` should hold it. */
  room: string;
  /** `VIP`, `Pria-Kelas I` — printed under the number, not part of it. */
  subtitle?: string;
  /** Numbered slots on the sheet. */
  beds: number;
}

export interface DenahColumn {
  /**
   * Set for the nurse station, which is a landmark rather than a room.
   *
   * Kept in the layout because it is how the sheet is oriented: "opposite the
   * nurse station" is how the rooms either side are actually described.
   */
  landmark?: string;
  rooms?: DenahRoomSlot[];
}

export interface WardPlan {
  /** Matched against `patient.ward`, case- and spacing-insensitively. */
  ward: string;
  /** Full-width rooms across the top, before the three columns. */
  header: DenahRoomSlot[];
  /** Left, centre, right — in the order the sheet is read. */
  columns: [DenahColumn[], DenahColumn[], DenahColumn[]];
}

const PJT_LANTAI_4: WardPlan = {
  ward: 'PJT Lantai 4',
  header: [
    { room: '420', beds: 6 },
    { room: '421', beds: 6 },
  ],
  columns: [
    [
      {
        rooms: [
          { room: '410', subtitle: 'VIP', beds: 1 },
          { room: '409', beds: 1 },
          { room: '408', beds: 1 },
          { room: '407', beds: 1 },
          { room: '406', beds: 1 },
          { room: '405', beds: 1 },
          { room: '404', beds: 1 },
          { room: '403', beds: 1 },
          { room: '402', beds: 1 },
          { room: '401', beds: 1 },
        ],
      },
    ],
    [
      { landmark: 'NURSE STATION' },
      { rooms: [{ room: '411', subtitle: 'SUPER VIP', beds: 1 }] },
    ],
    [
      {
        rooms: [
          { room: '412', subtitle: 'Pria-Kelas I', beds: 1 },
          { room: '413', beds: 2 },
          { room: '414', beds: 2 },
          { room: '415', beds: 2 },
          { room: '416', beds: 2 },
          { room: '417', beds: 4 },
          { room: '418', beds: 4 },
          { room: '419', beds: 4 },
        ],
      },
    ],
  ],
};

const PLANS: readonly WardPlan[] = [PJT_LANTAI_4];

function normalise(ward: string): string {
  return ward.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The plan for a ward, or `null` when there is no transcribed sheet.
 *
 * Null is the ordinary case, not a failure: Lantai 5, CVCU and IGD have no
 * transcribed plan and fall back to the flowing grid. A ward is only laid out
 * against the wall when somebody has actually checked it against the wall.
 */
export function wardPlan(ward: string): WardPlan | null {
  const key = normalise(ward);
  return PLANS.find((plan) => normalise(plan.ward) === key) ?? null;
}

/** Every room the plan names, for placing patients and spotting strays. */
export function planRooms(plan: WardPlan): DenahRoomSlot[] {
  return [
    ...plan.header,
    ...plan.columns.flatMap((column) =>
      column.flatMap((block) => block.rooms ?? []),
    ),
  ];
}
