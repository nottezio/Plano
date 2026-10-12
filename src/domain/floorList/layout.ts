import type { DenahRoomSlot, WardPlan } from '@/domain/denahPlan';

/**
 * The denah as a grid of rows (12.11), shared by the screen and the Word
 * denah so the two are drawn the same way.
 *
 * Left room i and right room i share row i, so the two side columns line up
 * and the shorter side's last room stretches down to the bottom (Avi: "the
 * denah in-app is not symmetrical, see the left rooms"). The centre column
 * gives each of its rooms up to three rows at the bottom and the landmark
 * (nurse station) the rows above.
 */

export interface GridCell {
  /** 0-based first row and how many rows it spans. */
  row: number;
  span: number;
}

export interface RoomCell extends GridCell {
  slot: DenahRoomSlot;
}

export interface PlanLayout {
  rows: number;
  left: RoomCell[];
  right: RoomCell[];
  landmark: (GridCell & { label: string }) | null;
  centre: RoomCell[];
}

function side(slots: readonly DenahRoomSlot[], rows: number): RoomCell[] {
  return slots.map((slot, i) => ({ slot, row: i, span: i === slots.length - 1 ? rows - i : 1 }));
}

export function planLayout(plan: WardPlan): PlanLayout {
  const left = plan.columns[0].flatMap((block) => block.rooms ?? []);
  const right = plan.columns[2].flatMap((block) => block.rooms ?? []);
  const centreRooms = plan.columns[1].flatMap((block) => block.rooms ?? []);
  const label = plan.columns[1].find((block) => block.landmark)?.landmark ?? null;
  const rows = Math.max(left.length, right.length, 1);
  const perRoom = Math.max(1, Math.min(3, Math.floor((rows - 1) / Math.max(centreRooms.length, 1))));
  const landmarkRows = label ? Math.max(1, rows - perRoom * centreRooms.length) : 0;
  const centre = centreRooms.map((slot, k) => {
    const row = landmarkRows + k * perRoom;
    const last = k === centreRooms.length - 1;
    return { slot, row, span: last ? rows - row : perRoom };
  });
  return {
    rows,
    left: side(left, rows),
    right: side(right, rows),
    landmark: label ? { label, row: 0, span: landmarkRows } : null,
    centre,
  };
}
