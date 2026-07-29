import { buildCommandScript, buildOperationSteps } from "./commands";
import {
  assignGroupsToRows,
  calculateHeightGroups,
  heightDescriptor,
  type RowStudentCapacity,
} from "./heightGroups";
import { planQueues } from "./queuePlanner";
import { calculateRows, maxPeoplePerRow } from "./rowCalculator";
import { planStitch } from "./stitchPlanner";
import {
  centreOutSeatOrder,
  generateTeacherRoster,
  placeTeachers,
  splitTeachers,
} from "./teacherPlacement";
import type {
  RowLabel,
  Seat,
  SeatRow,
  SeatSwap,
  SessionConfig,
  StageLayout,
  TeacherPlan,
} from "./types";

export const DEFAULT_CONFIG: SessionConfig = {
  schoolName: "",
  totalStudents: 300,
  totalTeachers: 30,
  stageWidthM: 18,
  shoulderWidthM: 0.45,
  standingRows: 8,
  teacherLayout: "front-seated",
  photoMode: "single",
  heightGroupCount: 9,
  stitchRowsPerPhoto: 3,
  stitchOverlapRows: 1,
};

/**
 * Build the complete arrangement plan from a session configuration.
 * Pure function: same config in, same plan out — which is what keeps
 * live adjustments stable (small input changes produce small plan
 * changes rather than reshuffles).
 */
export function generateLayout(config: SessionConfig): StageLayout {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const maxPerRow = maxPeoplePerRow(config.stageWidthM, config.shoulderWidthM);
  const split = splitTeachers(
    config.teacherLayout,
    config.totalTeachers,
    config.standingRows,
  );

  // Standing teachers occupy standing-row seats, so they count towards
  // stage capacity; seated teachers get their own row of chairs in front.
  const standingPeople = config.totalStudents + split.standingCount;
  const rowsResult = calculateRows({
    peopleCount: standingPeople,
    rowCount: config.standingRows,
    maxPerRow,
  });
  warnings.push(...rowsResult.warnings);
  suggestions.push(...rowsResult.suggestions);

  const rowByNumber = new Map(rowsResult.rows.map((r) => [r.rowNumber, r]));

  // Teachers standing in a row take its centre seats.
  const teachersPerRow = new Map<number, number>();
  let standingRowNumber = split.standingRowNumber;
  let standingCount = split.standingCount;
  if (standingCount > 0) {
    if (!rowByNumber.has(standingRowNumber)) {
      standingRowNumber = Math.max(
        1,
        Math.min(standingRowNumber, rowsResult.rows.length),
      );
    }
    const row = rowByNumber.get(standingRowNumber);
    if (row) {
      const inRow = Math.min(standingCount, row.size);
      teachersPerRow.set(standingRowNumber, inRow);
      if (inRow < standingCount) {
        warnings.push(
          `Row ${standingRowNumber} cannot hold all standing teachers; ${standingCount - inRow} moved to the row behind.`,
        );
        const behind = rowByNumber.get(standingRowNumber + 1);
        if (behind) {
          teachersPerRow.set(
            standingRowNumber + 1,
            Math.min(standingCount - inRow, behind.size),
          );
        }
      }
    }
  }

  // Height groups cover students only.
  const groups = calculateHeightGroups(
    config.totalStudents,
    config.heightGroupCount,
  );
  const capacities: RowStudentCapacity[] = rowsResult.rows.map((r) => ({
    rowNumber: r.rowNumber,
    studentCapacity: r.size - (teachersPerRow.get(r.rowNumber) ?? 0),
  }));
  const assignment = assignGroupsToRows(capacities, groups);
  if (assignment.unplaced > 0 && rowsResult.ok) {
    warnings.push(`${assignment.unplaced} students could not be assigned to a row.`);
  }

  const roster = generateTeacherRoster(config.totalTeachers);
  const standingRowSize = rowByNumber.get(standingRowNumber)?.size ?? 0;
  const teachers = placeTeachers(roster, split, standingRowSize);

  const seatRows = buildSeatRows(rowsResult.rows, teachers, assignment.slices);

  const queues = planQueues(groups, assignment.spans);

  const rowLabels: RowLabel[] = [...rowsResult.rows]
    .sort((a, b) => b.rowNumber - a.rowNumber)
    .map((row) => {
      const slices = assignment.slices.filter(
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
          ? heightDescriptor(
              dominantGroup.indexFromTallest,
              config.heightGroupCount,
            )
          : "—",
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
    spans: assignment.spans,
    teacherLayout: config.teacherLayout,
    teacherCount: config.totalTeachers,
    standingRowNumber,
  };

  return {
    config,
    maxPerRow,
    rowsResult,
    groups,
    groupSpans: assignment.spans,
    rowSlices: assignment.slices,
    teachers,
    seatedTeacherCount: split.seatedCount,
    standingTeacherCount: split.standingCount,
    seatRows,
    queues,
    rowLabels,
    stitch,
    steps: buildOperationSteps(commandCtx),
    commands: buildCommandScript(commandCtx),
    warnings,
    suggestions,
  };
}

function buildSeatRows(
  rows: StageLayout["rowsResult"]["rows"],
  teachers: TeacherPlan[],
  slices: StageLayout["rowSlices"],
): SeatRow[] {
  const seatRows: SeatRow[] = [];

  const seatedTeachers = teachers.filter((t) => t.placement === "seated");
  if (seatedTeachers.length > 0) {
    const seats: Seat[] = [...seatedTeachers]
      .sort((a, b) => a.seatNumber - b.seatNumber)
      .map((t) => ({
        rowNumber: 0,
        seatNumber: t.seatNumber,
        occupant: {
          kind: "teacher" as const,
          label: t.label,
          teacherId: t.id,
          role: t.role,
        },
      }));
    seatRows.push({ rowNumber: 0, kind: "seated", seats });
  }

  const standingTeachersByRow = new Map<number, TeacherPlan[]>();
  for (const t of teachers) {
    if (t.placement !== "standing") continue;
    const list = standingTeachersByRow.get(t.rowNumber) ?? [];
    list.push(t);
    standingTeachersByRow.set(t.rowNumber, list);
  }

  for (const row of rows) {
    const seats: (Seat | null)[] = new Array(row.size).fill(null);

    // Standing teachers take centre seats first.
    const rowTeachers = standingTeachersByRow.get(row.rowNumber) ?? [];
    const centreOrder = centreOutSeatOrder(row.size);
    rowTeachers.forEach((t, i) => {
      const seatNumber = centreOrder[i];
      if (seatNumber === undefined) return;
      seats[seatNumber - 1] = {
        rowNumber: row.rowNumber,
        seatNumber,
        occupant: {
          kind: "teacher",
          label: t.label,
          teacherId: t.id,
          role: t.role,
        },
      };
    });

    // Students fill the remaining seats left-to-right, taller groups
    // already ordered first within the row.
    const rowSlices = slices.filter((s) => s.rowNumber === row.rowNumber);
    const studentQueue: string[] = [];
    for (const slice of rowSlices) {
      for (let i = 0; i < slice.count; i++) studentQueue.push(slice.groupId);
    }
    let q = 0;
    for (let seatIdx = 0; seatIdx < row.size; seatIdx++) {
      if (seats[seatIdx] !== null) continue;
      const groupId = studentQueue[q++];
      seats[seatIdx] = {
        rowNumber: row.rowNumber,
        seatNumber: seatIdx + 1,
        occupant: groupId
          ? { kind: "student", label: groupId, groupId }
          : { kind: "student", label: "—" },
      };
    }

    seatRows.push({
      rowNumber: row.rowNumber,
      kind: "standing",
      seats: seats as Seat[],
    });
  }

  return seatRows;
}

/**
 * Apply manual drag-and-drop swaps on top of a generated layout.
 * Swaps referencing seats that no longer exist are ignored, which is
 * what keeps manual edits stable across live adjustments.
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
