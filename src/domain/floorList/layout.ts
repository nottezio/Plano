import { planAnnex, type DenahRoomSlot, type WardPlan } from '@/domain/denahPlan';

/**
 * The denah as a grid of rows (12.11), shared by the screen and the Word
 * denah so the two are drawn the same way.
 *
 * Left room i and right room i share row i, so the two side columns line up
 * and the shorter side's last room stretches down to the bottom (Avi: "the
 * denah in-app is not symmetrical, see the left rooms"). A room marked
 * `beside` joins the room before it in the same row (508 A and B). The centre
 * column gives each of its rooms up to three rows at the bottom and the
 * landmark (nurse station) the rows above. With an annex box (Lantai 6) the
 * landmark and the rooms take one row each and the annex fills the rest.
 */

export interface GridCell {
  /** 0-based first row and how many rows it spans. */
  row: number;
  span: number;
}

/** One or two rooms (side by side) in a row. */
export interface RoomCell extends GridCell {
  slots: DenahRoomSlot[];
}

export interface PlanLayout {
  rows: number;
  left: RoomCell[];
  right: RoomCell[];
  landmark: (GridCell & { label: string }) | null;
  annex: (GridCell & { label: string; roomPrefix: string }) | null;
  centre: RoomCell[];
}

function groupRows(slots: readonly DenahRoomSlot[]): DenahRoomSlot[][] {
  const groups: DenahRoomSlot[][] = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (slot.beside && last) last.push(slot);
    else groups.push([slot]);
  }
  return groups;
}

function side(groups: readonly DenahRoomSlot[][], rows: number): RoomCell[] {
  return groups.map((slots, i) => ({ slots, row: i, span: i === groups.length - 1 ? rows - i : 1 }));
}

export function planLayout(plan: WardPlan): PlanLayout {
  const left = groupRows(plan.columns[0].flatMap((block) => block.rooms ?? []));
  const right = groupRows(plan.columns[2].flatMap((block) => block.rooms ?? []));
  const centreRooms = plan.columns[1].flatMap((block) => block.rooms ?? []);
  const label = plan.columns[1].find((block) => block.landmark)?.landmark ?? null;
  const annex = planAnnex(plan);
  const rows = Math.max(left.length, right.length, 1);
  const perRoom = annex ? 1 : Math.max(1, Math.min(3, Math.floor((rows - 1) / Math.max(centreRooms.length, 1))));
  const landmarkRows = label ? (annex ? 1 : Math.max(1, rows - perRoom * centreRooms.length)) : 0;
  const annexRows = annex ? Math.max(1, rows - landmarkRows - perRoom * centreRooms.length) : 0;
  const centre = centreRooms.map((slot, k) => {
    const row = landmarkRows + annexRows + k * perRoom;
    const last = k === centreRooms.length - 1;
    return { slots: [slot], row, span: last ? rows - row : perRoom };
  });
  return {
    rows,
    left: side(left, rows),
    right: side(right, rows),
    landmark: label ? { label, row: 0, span: landmarkRows } : null,
    annex: annex ? { ...annex, row: landmarkRows, span: annexRows } : null,
    centre,
  };
}
