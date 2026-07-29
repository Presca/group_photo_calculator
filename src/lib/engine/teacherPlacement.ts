import type { TeacherPlan, TeacherRole } from "./types";

export interface TeacherRosterEntry {
  id: string;
  label: string;
  role: TeacherRole;
}

/**
 * Generate a placeholder roster: VIP teachers first (they take
 * precedence in layout and sequence — VIP 1 gets the centre seat),
 * then regular teachers. A future attendance import can replace this
 * with real names without touching placement.
 */
export function generateTeacherRoster(
  vipCount: number,
  teacherCount: number,
): TeacherRosterEntry[] {
  const roster: TeacherRosterEntry[] = [];
  for (let i = 1; i <= vipCount; i++) {
    roster.push({ id: `V${i}`, label: `VIP ${i}`, role: "vip" });
  }
  for (let i = 1; i <= teacherCount; i++) {
    roster.push({ id: `T${i}`, label: `Teacher ${i}`, role: "teacher" });
  }
  return roster;
}

/**
 * Seat numbers of a row of `size`, ordered centre-out: centre seat
 * first, then alternating right/left. VIP 1 takes the first entry,
 * so precedence radiates from the centre.
 */
export function centreOutSeatOrder(size: number): number[] {
  const order: number[] = [];
  const centre = Math.ceil(size / 2);
  order.push(centre);
  for (let offset = 1; order.length < size; offset++) {
    if (centre + offset <= size) order.push(centre + offset);
    if (order.length < size && centre - offset >= 1) order.push(centre - offset);
  }
  return order;
}

/**
 * Evenly spaced seat numbers for interspersing k teachers among a row
 * of n seats, so overflow teachers stand *between* students rather
 * than clumping together.
 */
export function interspersedSeatOrder(n: number, k: number): number[] {
  if (k >= n) return Array.from({ length: n }, (_, i) => i + 1);
  const used = new Set<number>();
  const out: number[] = [];
  for (let j = 1; j <= k; j++) {
    let pos = Math.round((j * (n + 1)) / (k + 1));
    pos = Math.min(n, Math.max(1, pos));
    while (used.has(pos) && pos < n) pos++;
    while (used.has(pos) && pos > 1) pos--;
    used.add(pos);
    out.push(pos);
  }
  return out;
}

export interface TeacherAssignment {
  plans: TeacherPlan[];
  /** rowNumber → teacher seat numbers, ascending. */
  seatsByRow: Map<number, number[]>;
  /** Teachers that did not fit on the stage at all. */
  unplaced: number;
}

/**
 * Set rule: teachers always take the front row, as a centred block
 * with the VIPs mid-row (VIP 1 dead centre). Overflow spills to the
 * second row — spread evenly between students — then the third, and
 * so on.
 */
export function assignTeachersFrontFirst(
  rowSizes: { rowNumber: number; size: number }[],
  roster: TeacherRosterEntry[],
): TeacherAssignment {
  const frontFirst = [...rowSizes].sort((a, b) => a.rowNumber - b.rowNumber);
  const plans: TeacherPlan[] = [];
  const seatsByRow = new Map<number, number[]>();

  let placed = 0;
  for (let r = 0; r < frontFirst.length && placed < roster.length; r++) {
    const row = frontFirst[r];
    const k = Math.min(roster.length - placed, row.size);
    if (k <= 0) continue;

    let seats: number[];
    if (r === 0) {
      // Front row: centred block, centre-out so roster order (VIPs
      // first) radiates from the middle of the row.
      const blockStart = Math.floor((row.size - k) / 2);
      seats = centreOutSeatOrder(k).map((s) => s + blockStart);
    } else {
      seats = interspersedSeatOrder(row.size, k);
    }

    for (let i = 0; i < k; i++) {
      plans.push({
        ...roster[placed + i],
        rowNumber: row.rowNumber,
        seatNumber: seats[i],
      });
    }
    seatsByRow.set(
      row.rowNumber,
      [...seats].sort((a, b) => a - b),
    );
    placed += k;
  }

  return { plans, seatsByRow, unplaced: roster.length - placed };
}
