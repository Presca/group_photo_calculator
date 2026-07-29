import type { GroupRowSpan, HeightGroup, RowGroupSlice } from "./types";

/**
 * Human descriptor for a height zone.
 * @param indexFromTallest 0 = tallest zone.
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

export interface RowStudentCapacity {
  rowNumber: number;
  /** Seats in the row available for students (row size minus teachers). */
  studentCapacity: number;
}

export interface ZoneAssignment {
  groups: HeightGroup[];
  spans: GroupRowSpan[];
  slices: RowGroupSlice[];
}

/**
 * Build height zones aligned to row boundaries.
 *
 * Every zone covers one or more whole rows, and its student count is
 * exactly the summed student capacity of those rows. Queueing then
 * becomes exact: a queue empties into its row(s) and the row comes out
 * full — no splitting a queue mid-flow with verbal instructions, and
 * a miscount is caught the moment a queue and its row don't match.
 *
 * The requested zone count (5/7/9) is a maximum: with 8 rows and 9
 * requested zones you get 8 zones (one queue per row). With fewer
 * zones than rows, adjacent rows merge into one zone, extra rows going
 * to the back zones (they are called first).
 *
 * Set rule — front-to-back the height groups run 2, 1, 3, 4, 5 …:
 * the second-shortest group takes the front row (typically seated) and
 * the shortest group stands behind them in row 2, so nobody is hidden.
 * From row 3 back it ascends normally to the tallest.
 */
export function buildRowAlignedZones(
  rowCapacities: RowStudentCapacity[],
  requestedZones: number,
): ZoneAssignment {
  const backFirst = rowCapacities
    .filter((r) => r.studentCapacity > 0)
    .sort((a, b) => b.rowNumber - a.rowNumber);
  if (backFirst.length === 0) return { groups: [], spans: [], slices: [] };

  // Swap the two front-most rows so the shortest group lands in row 2
  // and the second-shortest in the front row (…3, 2, 1 becomes …3, 1, 2
  // reading back-to-front, i.e. 2, 1, 3, 4, 5 from the front).
  if (backFirst.length >= 2) {
    const last = backFirst.length - 1;
    [backFirst[last - 1], backFirst[last]] = [
      backFirst[last],
      backFirst[last - 1],
    ];
  }

  const zoneCount = Math.max(1, Math.min(requestedZones, backFirst.length));
  const baseRows = Math.floor(backFirst.length / zoneCount);
  const extraRows = backFirst.length % zoneCount;

  const groups: HeightGroup[] = [];
  const spans: GroupRowSpan[] = [];
  const slices: RowGroupSlice[] = [];

  let rowIdx = 0;
  for (let z = 0; z < zoneCount; z++) {
    const take = baseRows + (z < extraRows ? 1 : 0);
    const zoneRows = backFirst.slice(rowIdx, rowIdx + take);
    rowIdx += take;

    const id = `S${zoneCount - z}`;
    const count = zoneRows.reduce((sum, r) => sum + r.studentCapacity, 0);
    groups.push({
      id,
      rank: zoneCount - z,
      indexFromTallest: z,
      descriptor: heightDescriptor(z, zoneCount),
      count,
    });
    spans.push({
      groupId: id,
      fromRow: zoneRows[0].rowNumber,
      toRow: zoneRows[zoneRows.length - 1].rowNumber,
      placed: count,
    });
    for (const row of zoneRows) {
      slices.push({
        rowNumber: row.rowNumber,
        groupId: id,
        count: row.studentCapacity,
      });
    }
  }

  return { groups, spans, slices };
}
