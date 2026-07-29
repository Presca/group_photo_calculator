import type {
  GroupRowSpan,
  HeightGroup,
  HeightGroupCount,
  RowGroupSlice,
} from "./types";

/**
 * Human descriptor for a height group.
 * @param indexFromTallest 0 = tallest group.
 */
export function heightDescriptor(
  indexFromTallest: number,
  groupCount: number,
): string {
  if (groupCount <= 1) return "All heights";
  if (indexFromTallest === 0) return "Tallest";
  if (indexFromTallest === groupCount - 1) return "Shortest";
  const mid = (groupCount - 1) / 2;
  if (indexFromTallest === mid) return "Medium";
  return indexFromTallest < mid ? "Tall" : "Short";
}

/**
 * Split students into height zones. Zone S{n} is the tallest, S1 the
 * shortest. Extra students go to the tallest zones first because the
 * back rows (which the tallest zones fill) hold more people.
 */
export function calculateHeightGroups(
  totalStudents: number,
  groupCount: HeightGroupCount,
): HeightGroup[] {
  const students = Math.max(0, totalStudents);
  const base = Math.floor(students / groupCount);
  const remainder = students % groupCount;

  const groups: HeightGroup[] = [];
  for (let i = 0; i < groupCount; i++) {
    // i = 0 → tallest → highest id number.
    groups.push({
      id: `S${groupCount - i}`,
      indexFromTallest: i,
      descriptor: heightDescriptor(i, groupCount),
      count: base + (i < remainder ? 1 : 0),
    });
  }
  return groups;
}

export interface RowStudentCapacity {
  rowNumber: number;
  /** Seats in the row available for students (row size minus teachers). */
  studentCapacity: number;
}

export interface GroupAssignment {
  spans: GroupRowSpan[];
  slices: RowGroupSlice[];
  /** Students that did not fit in any row. */
  unplaced: number;
}

/**
 * Fill rows from the back with the tallest groups first.
 * Produces both per-group row ranges (for queue signs) and per-row
 * composition (for the visual layout and row labels).
 */
export function assignGroupsToRows(
  rowCapacities: RowStudentCapacity[],
  groups: HeightGroup[],
): GroupAssignment {
  const backFirst = [...rowCapacities].sort(
    (a, b) => b.rowNumber - a.rowNumber,
  );
  const slices: RowGroupSlice[] = [];
  const spans: GroupRowSpan[] = [];

  let rowIdx = 0;
  let roomInRow = backFirst.length > 0 ? backFirst[0].studentCapacity : 0;
  let unplaced = 0;

  for (const group of groups) {
    let remaining = group.count;
    let fromRow: number | null = null;
    let toRow: number | null = null;

    while (remaining > 0 && rowIdx < backFirst.length) {
      if (roomInRow <= 0) {
        rowIdx += 1;
        if (rowIdx >= backFirst.length) break;
        roomInRow = backFirst[rowIdx].studentCapacity;
        continue;
      }
      const row = backFirst[rowIdx];
      const take = Math.min(remaining, roomInRow);
      slices.push({ rowNumber: row.rowNumber, groupId: group.id, count: take });
      fromRow = fromRow ?? row.rowNumber;
      toRow = row.rowNumber;
      remaining -= take;
      roomInRow -= take;
    }

    unplaced += remaining;
    spans.push({
      groupId: group.id,
      fromRow: fromRow ?? 0,
      toRow: toRow ?? 0,
      placed: group.count - remaining,
    });
  }

  return { spans, slices, unplaced };
}
