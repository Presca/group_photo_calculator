import type { TeacherLayout, TeacherPlan, TeacherRole } from "./types";

export interface TeacherRosterEntry {
  id: string;
  label: string;
  role: TeacherRole;
}

/** How many of the first teachers are treated as senior staff. */
const SENIOR_COUNT = 4;

/**
 * Generate a placeholder roster: T1 is the Principal, the next few are
 * senior teachers, the rest are regular teachers. A future attendance
 * import can replace this with real names without touching placement.
 */
export function generateTeacherRoster(count: number): TeacherRosterEntry[] {
  const roster: TeacherRosterEntry[] = [];
  for (let i = 1; i <= count; i++) {
    const role: TeacherRole =
      i === 1 ? "principal" : i <= 1 + SENIOR_COUNT ? "senior" : "teacher";
    roster.push({
      id: `T${i}`,
      label:
        role === "principal"
          ? "Principal"
          : role === "senior"
            ? `Senior ${i - 1}`
            : `Teacher ${i}`,
      role,
    });
  }
  return roster;
}

export interface TeacherSplit {
  seatedCount: number;
  standingCount: number;
  /** Standing row the standing teachers join (0 when none). */
  standingRowNumber: number;
}

/**
 * Decide how many teachers sit in the front seated row versus stand
 * within the student rows, based on the chosen layout.
 */
export function splitTeachers(
  layout: TeacherLayout,
  teacherCount: number,
  standingRowCount: number,
): TeacherSplit {
  if (teacherCount <= 0) {
    return { seatedCount: 0, standingCount: 0, standingRowNumber: 0 };
  }
  switch (layout) {
    case "front-seated":
      return { seatedCount: teacherCount, standingCount: 0, standingRowNumber: 0 };
    case "front-standing":
      return {
        seatedCount: 0,
        standingCount: teacherCount,
        standingRowNumber: 1,
      };
    case "mixed": {
      const seatedCount = Math.ceil(teacherCount / 2);
      return {
        seatedCount,
        standingCount: teacherCount - seatedCount,
        // Middle of the standing rows.
        standingRowNumber: Math.max(1, Math.ceil(standingRowCount / 2)),
      };
    }
  }
}

/**
 * Seat numbers of a row of `size`, ordered centre-out: centre seat
 * first, then alternating right/left. The principal takes the first
 * entry, seniors the next ones, so seniority radiates from the centre.
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
 * Place teachers into their rows. Seated teachers occupy row 0 (a
 * seated row in front of row 1); standing teachers take the centre
 * seats of their standing row.
 */
export function placeTeachers(
  roster: TeacherRosterEntry[],
  split: TeacherSplit,
  standingRowSize: number,
): TeacherPlan[] {
  const plans: TeacherPlan[] = [];

  const seated = roster.slice(0, split.seatedCount);
  const seatedOrder = centreOutSeatOrder(split.seatedCount);
  seated.forEach((t, i) => {
    plans.push({
      ...t,
      placement: "seated",
      rowNumber: 0,
      seatNumber: seatedOrder[i],
    });
  });

  const standing = roster.slice(split.seatedCount);
  const standingOrder = centreOutSeatOrder(standingRowSize);
  standing.forEach((t, i) => {
    plans.push({
      ...t,
      placement: "standing",
      rowNumber: split.standingRowNumber,
      seatNumber: standingOrder[i] ?? i + 1,
    });
  });

  return plans;
}
