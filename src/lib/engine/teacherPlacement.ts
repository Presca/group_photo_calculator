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

/** Most teacher clusters per row when interspersing overflow. */
const MAX_TEACHER_CLUSTERS = 5;

/**
 * Seat numbers for interspersing k overflow teachers among a row of n
 * seats, so teachers stand *between* students. Teachers are grouped
 * into at most MAX_TEACHER_CLUSTERS evenly spaced clusters — with a
 * dense overflow, single-seat interleaving would produce an unreadable
 * teacher/student zebra on stage and on the layout bands.
 */
export function interspersedSeatOrder(n: number, k: number): number[] {
  if (k >= n) return Array.from({ length: n }, (_, i) => i + 1);
  if (k <= 0) return [];
  const students = n - k;
  const clusters = Math.min(MAX_TEACHER_CLUSTERS, k, students + 1);

  // Cluster sizes: extras go to the middle clusters.
  const blockSizes: number[] = new Array(clusters).fill(
    Math.floor(k / clusters),
  );
  const midOut = middleOutOrder(clusters);
  for (let i = 0; i < k % clusters; i++) blockSizes[midOut[i]] += 1;

  // Student gaps (clusters + 1, including both ends): extras go to the
  // outermost gaps so the row always starts and ends with students.
  const gapCount = clusters + 1;
  const gaps: number[] = new Array(gapCount).fill(
    Math.floor(students / gapCount),
  );
  const endsFirst = endsFirstOrder(gapCount);
  for (let i = 0; i < students % gapCount; i++) gaps[endsFirst[i]] += 1;

  const seats: number[] = [];
  let position = 1;
  for (let b = 0; b < clusters; b++) {
    position += gaps[b];
    for (let s = 0; s < blockSizes[b]; s++) seats.push(position++);
  }
  return seats;
}

/** Index order [middle, middle+1, middle−1, …] for length g. */
function middleOutOrder(g: number): number[] {
  const centre = Math.floor((g - 1) / 2);
  const order = [centre];
  for (let off = 1; order.length < g; off++) {
    if (centre + off < g) order.push(centre + off);
    if (order.length < g && centre - off >= 0) order.push(centre - off);
  }
  return order;
}

/** Index order [0, m−1, 1, m−2, …] for length m. */
function endsFirstOrder(m: number): number[] {
  const order: number[] = [];
  let a = 0;
  let b = m - 1;
  while (a <= b) {
    order.push(a);
    if (b !== a) order.push(b);
    a += 1;
    b -= 1;
  }
  return order;
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
