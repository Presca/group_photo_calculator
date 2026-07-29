import { buildCommandScript, buildOperationSteps } from "./commands";
import {
  buildRowAlignedZones,
  heightDescriptor,
  type RowStudentCapacity,
} from "./heightGroups";
import { planQueues } from "./queuePlanner";
import {
  calculateRows,
  maxPeoplePerRow,
  minimalRowsFor,
} from "./rowCalculator";
import { planStitch } from "./stitchPlanner";
import {
  assignTeachersFrontFirst,
  generateTeacherRoster,
  type TeacherAssignment,
} from "./teacherPlacement";
import type {
  RowLabel,
  RowOverrides,
  RowPlan,
  Seat,
  SeatRow,
  SeatSwap,
  SessionConfig,
  StageLayout,
  TeacherRowSummary,
} from "./types";

export const DEFAULT_CONFIG: SessionConfig = {
  schoolName: "",
  totalStudents: 300,
  totalTeachers: 25,
  vipTeachers: 5,
  stageWidthM: 18,
  shoulderWidthM: 0.45,
  firstRowParity: "odd",
  photoMode: "single",
  stitchRowsPerPhoto: 3,
  stitchOverlapRows: 1,
};

/**
 * Build the complete arrangement plan from a session configuration.
 * Pure function: same config in, same plan out — which is what keeps
 * live adjustments stable (small input changes produce small plan
 * changes rather than reshuffles).
 *
 * Set rules encoded here:
 * 1. Teachers always take the front row (VIPs centre-most, VIP 1 dead
 *    centre). Overflow spills to Row 2, Row 3, … spread evenly
 *    between students.
 * 2. Within every row the tallest stand in the middle, tapering to the
 *    shortest at the sides. Students file in from one queue, tallest
 *    first: fill left of centre outward, then right of centre outward
 *    — nobody is split off once queued.
 * 3. Rows strictly alternate odd/even counts, starting from the
 *    configurable front-row parity; rows fill to capacity front-first.
 *
 * `rowOverrides` are live on-the-day pins: when the operators squeeze
 * more or fewer people into a row than planned, that row is fixed at
 * its actual count and only the remaining rows rebalance — rows
 * already filled never move.
 */
export function generateLayout(
  config: SessionConfig,
  rowOverrides: RowOverrides = {},
): StageLayout {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const maxPerRow = maxPeoplePerRow(config.stageWidthM, config.shoulderWidthM);

  // Teachers occupy row seats too, so everyone counts towards capacity.
  // Rows are computed automatically: exactly as many as the group
  // needs at this stage width.
  const totalTeachers = config.totalTeachers + config.vipTeachers;
  const totalPeople = config.totalStudents + totalTeachers;
  // Exactly as many rows as the strict alternating pattern needs (the
  // one arithmetic remainder is allowed — they stand at the side).
  const rowCount = minimalRowsFor(totalPeople, maxPerRow, config.firstRowParity);
  const rowsResult = calculateRows({
    peopleCount: totalPeople,
    rowCount,
    maxPerRow,
    firstRowParity: config.firstRowParity,
    fixedSizes: rowOverrides,
  });
  warnings.push(...rowsResult.warnings);
  suggestions.push(...rowsResult.suggestions);

  const roster = generateTeacherRoster(
    config.vipTeachers,
    config.totalTeachers,
  );
  const assignment = assignTeachersFrontFirst(rowsResult.rows, roster);
  if (assignment.unplaced > 0) {
    warnings.push(
      `${assignment.unplaced} teacher${assignment.unplaced === 1 ? "" : "s"} could not be placed on the stage.`,
    );
  }

  const teacherRows: TeacherRowSummary[] = [...assignment.seatsByRow.entries()]
    .map(([rowNumber, seats]) => ({ rowNumber, count: seats.length }))
    .sort((a, b) => a.rowNumber - b.rowNumber);

  // Extras (the odd person out of the strict pattern) stand at the
  // sides of the 2nd-last row — 3rd-last if the 2nd-last is pinned.
  const rowNumbers = rowsResult.rows.map((r) => r.rowNumber);
  let extrasRow = 0;
  if (rowsResult.extras > 0 && rowNumbers.length > 0) {
    const back = rowNumbers[rowNumbers.length - 1];
    const candidates = [back - 1, back - 2, back].filter((r) =>
      rowNumbers.includes(r),
    );
    extrasRow =
      candidates.find((r) => rowOverrides[r] === undefined) ?? candidates[0];
    warnings.push(
      `${rowsResult.extras} extra ${rowsResult.extras === 1 ? "person stands" : "people stand"} at the side of Row ${extrasRow} — marked in amber.`,
    );
  }
  const extras =
    rowsResult.extras > 0 && extrasRow > 0
      ? { rowNumber: extrasRow, count: rowsResult.extras }
      : null;

  // Height zones cover students only; rows fully occupied by teachers
  // (usually the front row) are skipped automatically. Extras join
  // their row's cohort so queue counts stay exact.
  const capacities: RowStudentCapacity[] = rowsResult.rows.map((r) => ({
    rowNumber: r.rowNumber,
    studentCapacity:
      r.size -
      (assignment.seatsByRow.get(r.rowNumber)?.length ?? 0) +
      (extras && r.rowNumber === extras.rowNumber ? extras.count : 0),
  }));
  // One height zone (and therefore one queue) per student-holding row
  // — computed automatically, nothing to configure.
  const zoneAssignment = buildRowAlignedZones(capacities, capacities.length);
  const groups = zoneAssignment.groups;

  const seatRows = buildSeatRows(
    rowsResult.rows,
    assignment,
    zoneAssignment.slices,
    extras,
  );

  const queues = planQueues(groups, zoneAssignment.spans);

  const rowLabels: RowLabel[] = [...rowsResult.rows]
    .sort((a, b) => b.rowNumber - a.rowNumber)
    .map((row) => {
      const slices = zoneAssignment.slices.filter(
        (s) => s.rowNumber === row.rowNumber,
      );
      const dominant = slices.reduce(
        (best, s) => (s.count > (best?.count ?? 0) ? s : best),
        slices[0],
      );
      const dominantGroup = groups.find((g) => g.id === dominant?.groupId);
      return {
        rowNumber: row.rowNumber,
        descriptor: dominantGroup
          ? heightDescriptor(dominantGroup.indexFromTallest, groups.length)
          : "Teachers",
        groupIds: slices.map((s) => s.groupId),
        size: row.size,
      };
    });

  const stitch =
    config.photoMode === "stitch"
      ? planStitch(
          rowsResult.rows.length,
          config.stitchRowsPerPhoto,
          config.stitchOverlapRows,
        )
      : null;

  const commandCtx = {
    groups,
    spans: zoneAssignment.spans,
    teacherRows,
    totalTeachers,
    vipCount: config.vipTeachers,
  };

  return {
    config,
    maxPerRow,
    rowsResult,
    groups,
    groupSpans: zoneAssignment.spans,
    rowSlices: zoneAssignment.slices,
    teachers: assignment.plans,
    teacherRows,
    seatRows,
    queues,
    rowLabels,
    extras,
    stitch,
    steps: buildOperationSteps(commandCtx),
    commands: buildCommandScript(commandCtx),
    warnings,
    suggestions,
  };
}

/**
 * Seat-filling order for students in a row: the queue arrives tallest
 * first and fills the left half from the centre outward, then the
 * right half from the centre outward. One line, one direction change,
 * and the row tapers tall-centre → short-edges on both sides.
 */
export function centreLeftThenRightOrder(
  availableSeats: number[],
  rowSize: number,
): number[] {
  const centre = Math.ceil(rowSize / 2);
  const left = availableSeats
    .filter((s) => s <= centre)
    .sort((a, b) => b - a);
  const right = availableSeats
    .filter((s) => s > centre)
    .sort((a, b) => a - b);
  return [...left, ...right];
}

function buildSeatRows(
  rows: RowPlan[],
  assignment: TeacherAssignment,
  slices: StageLayout["rowSlices"],
  extras: { rowNumber: number; count: number } | null,
): SeatRow[] {
  const teachersBySeat = new Map<string, (typeof assignment.plans)[number]>();
  for (const t of assignment.plans) {
    teachersBySeat.set(`${t.rowNumber}:${t.seatNumber}`, t);
  }

  return rows.map((row) => {
    const extraCount =
      extras && extras.rowNumber === row.rowNumber ? extras.count : 0;
    const totalSeats = row.size + extraCount;
    const seats: (Seat | null)[] = new Array(totalSeats).fill(null);

    for (let seatNumber = 1; seatNumber <= row.size; seatNumber++) {
      const teacher = teachersBySeat.get(`${row.rowNumber}:${seatNumber}`);
      if (teacher) {
        seats[seatNumber - 1] = {
          rowNumber: row.rowNumber,
          seatNumber,
          occupant: {
            kind: "teacher",
            label: teacher.label,
            teacherId: teacher.id,
            role: teacher.role,
          },
        };
      }
    }

    // Students fill the remaining seats in taper order: tallest of the
    // row's cohort nearest the centre, shortest at the edges. Extras
    // stand at the side, beyond the odd/even pattern.
    const available: number[] = [];
    for (let s = 1; s <= row.size; s++) {
      if (seats[s - 1] === null) available.push(s);
    }
    const fillOrder = centreLeftThenRightOrder(available, row.size);
    for (let e = 1; e <= extraCount; e++) fillOrder.push(row.size + e);

    const rowSlices = slices.filter((s) => s.rowNumber === row.rowNumber);
    const studentQueue: string[] = [];
    for (const slice of rowSlices) {
      for (let i = 0; i < slice.count; i++) studentQueue.push(slice.groupId);
    }

    fillOrder.forEach((seatNumber, i) => {
      const groupId = studentQueue[i];
      const isExtra = seatNumber > row.size;
      seats[seatNumber - 1] = {
        rowNumber: row.rowNumber,
        seatNumber,
        occupant: groupId
          ? { kind: "student", label: groupId, groupId, extra: isExtra || undefined }
          : { kind: "student", label: "—", extra: isExtra || undefined },
      };
    });

    return { rowNumber: row.rowNumber, seats: seats as Seat[] };
  });
}

/**
 * Apply manual swaps on top of a generated layout. Swaps referencing
 * seats that no longer exist are ignored. Kept as the extension point
 * for future AI-driven adjustments (e.g. face-visibility fixes).
 */
export function applySeatSwaps(
  seatRows: SeatRow[],
  swaps: SeatSwap[],
): SeatRow[] {
  if (swaps.length === 0) return seatRows;
  const copy: SeatRow[] = seatRows.map((r) => ({
    ...r,
    seats: r.seats.map((s) => ({ ...s, occupant: { ...s.occupant } })),
  }));
  const find = (rowNumber: number, seatNumber: number): Seat | undefined =>
    copy
      .find((r) => r.rowNumber === rowNumber)
      ?.seats.find((s) => s.seatNumber === seatNumber);

  for (const swap of swaps) {
    const a = find(swap.a.rowNumber, swap.a.seatNumber);
    const b = find(swap.b.rowNumber, swap.b.seatNumber);
    if (!a || !b) continue;
    const tmp = a.occupant;
    a.occupant = b.occupant;
    b.occupant = tmp;
  }
  return copy;
}
