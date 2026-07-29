import type { Parity, RowCalculationResult, RowPlan } from "./types";

/** Maximum people that physically fit in one row on the stage. */
export function maxPeoplePerRow(
  stageWidthM: number,
  shoulderWidthM: number,
): number {
  if (stageWidthM <= 0 || shoulderWidthM <= 0) return 0;
  return Math.floor(stageWidthM / shoulderWidthM);
}

export function parityOf(n: number): Parity {
  return Math.abs(n) % 2 === 1 ? "odd" : "even";
}

/**
 * Row 1 (front) must be odd, then rows alternate odd/even/odd/even
 * going towards the back.
 */
export function targetParityForRow(rowNumber: number): Parity {
  return rowNumber % 2 === 1 ? "odd" : "even";
}

export interface CalculateRowsInput {
  peopleCount: number;
  rowCount: number;
  maxPerRow: number;
}

/**
 * Distribute people across rows.
 *
 * The sizes are constructed directly with the correct parity: every
 * odd-target row is seeded with 1 person, and the remaining people are
 * dealt out in pairs (pairs never change a row's parity), remainder
 * pairs going to the back rows so the back is fullest. When the total
 * makes the full odd/even pattern arithmetically impossible, exactly
 * one person is absorbed by the back row and that row is flagged as
 * relaxed.
 *
 * Because the construction is a closed formula rather than an
 * iterative shuffle, changing the head-count by 1 or 2 only nudges one
 * or two rows — which is what keeps live adjustments stable on the day.
 *
 * Guarantees (verified by unit tests):
 * - Every placed person is in exactly one row.
 * - No row exceeds `maxPerRow`; no used row is empty.
 * - Row sizes are balanced with the back rows fullest.
 * - All rows match their target parity except at most one relaxed row,
 *   unless the stage is at/over physical capacity (then physical
 *   limits win and relaxations are warned about).
 */
export function calculateRows({
  peopleCount,
  rowCount,
  maxPerRow,
}: CalculateRowsInput): RowCalculationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (peopleCount <= 0 || rowCount <= 0 || maxPerRow <= 0) {
    return {
      ok: false,
      rows: [],
      maxPerRow: Math.max(0, maxPerRow),
      capacity: Math.max(0, rowCount * maxPerRow),
      placed: 0,
      overflow: Math.max(0, peopleCount),
      warnings:
        peopleCount > 0
          ? ["Stage cannot hold anyone with the current measurements."]
          : [],
      suggestions:
        peopleCount > 0
          ? ["Check stage width, shoulder width and row count."]
          : [],
    };
  }

  const capacity = rowCount * maxPerRow;
  let ok = true;
  let placed = peopleCount;

  if (peopleCount > capacity) {
    ok = false;
    placed = capacity;
    const overflow = peopleCount - capacity;
    warnings.push(
      `Stage capacity is ${capacity} people (${rowCount} rows × ${maxPerRow}). ` +
        `${overflow} ${overflow === 1 ? "person does" : "people do"} not fit.`,
    );
    const rowsNeeded = Math.ceil(peopleCount / maxPerRow);
    suggestions.push(
      `Add ${rowsNeeded - rowCount} more row${rowsNeeded - rowCount === 1 ? "" : "s"} (needs ${rowsNeeded} total).`,
    );
    suggestions.push("Or switch to multi-shot stitching.");
  }

  const rowsUsed = Math.min(rowCount, placed);
  if (rowsUsed < rowCount) {
    warnings.push(
      `Only ${rowsUsed} of ${rowCount} rows are needed for this group size.`,
    );
  }

  // Seed odd-target rows with 1, then deal the rest out in pairs.
  const oddRowCount = Math.ceil(rowsUsed / 2);
  const pool = placed - oddRowCount; // rowsUsed <= placed, so pool >= 0
  const pairs = Math.floor(pool / 2);
  const leftover = pool % 2;

  const basePairs = Math.floor(pairs / rowsUsed);
  const extraPairs = pairs % rowsUsed;
  const sizes: number[] = new Array(rowsUsed);
  for (let i = 0; i < rowsUsed; i++) {
    const seed = targetParityForRow(i + 1) === "odd" ? 1 : 0;
    // Remainder pairs go to the back rows.
    const extra = i >= rowsUsed - extraPairs ? 1 : 0;
    sizes[i] = 2 * (basePairs + extra) + seed;
  }
  // When the total's parity cannot match the pattern, the back row
  // absorbs the odd person out.
  sizes[rowsUsed - 1] += leftover;

  // Enforce the per-row maximum. Moves of 2 preserve parity; a move of
  // 1 is the last resort when the stage is nearly full.
  let parityBroken = false;
  for (let i = rowsUsed - 1; i >= 0; i--) {
    let guard = 0;
    while (sizes[i] > maxPerRow && guard++ < 10000) {
      const pairTarget = findRowWithRoom(sizes, maxPerRow, i, 2);
      if (pairTarget !== -1) {
        sizes[i] -= 2;
        sizes[pairTarget] += 2;
        continue;
      }
      const singleTarget = findRowWithRoom(sizes, maxPerRow, i, 1);
      if (singleTarget === -1) break;
      sizes[i] -= 1;
      sizes[singleTarget] += 1;
      parityBroken = true;
    }
  }
  if (parityBroken) {
    warnings.push("Row parities were relaxed to stay within stage capacity.");
  }

  // No used row may be empty (only possible with very small groups).
  for (let i = 0; i < rowsUsed; i++) {
    let guard = 0;
    while (sizes[i] < 1 && guard++ < 10000) {
      const donor = findDonorRow(sizes, i, 3);
      if (donor !== -1) {
        sizes[donor] -= 2;
        sizes[i] += 2;
        continue;
      }
      const singleDonor = findDonorRow(sizes, i, 2);
      if (singleDonor === -1) break;
      sizes[singleDonor] -= 1;
      sizes[i] += 1;
    }
  }

  // Keep rows balanced: a row should not dwarf the row behind it.
  // Moves of 2 preserve parity.
  let moved = true;
  let guard = 0;
  while (moved && guard++ < 1000) {
    moved = false;
    for (let i = 0; i < rowsUsed - 1; i++) {
      while (
        sizes[i] - sizes[i + 1] >= 2 &&
        sizes[i + 1] + 2 <= maxPerRow &&
        sizes[i] - 2 >= 1
      ) {
        sizes[i] -= 2;
        sizes[i + 1] += 2;
        moved = true;
      }
    }
  }

  const rows: RowPlan[] = sizes.map((size, i) => {
    const rowNumber = i + 1;
    const targetParity = targetParityForRow(rowNumber);
    const actualParity = parityOf(size);
    return {
      rowNumber,
      size,
      targetParity,
      actualParity,
      parityRelaxed: actualParity !== targetParity,
    };
  });

  const relaxed = rows.filter((r) => r.parityRelaxed);
  if (relaxed.length > 0) {
    warnings.push(
      `Row ${relaxed.map((r) => r.rowNumber).join(", ")} could not match the odd/even pattern with these totals (one row must absorb the difference).`,
    );
  }

  return {
    ok,
    rows,
    maxPerRow,
    capacity,
    placed,
    overflow: peopleCount - placed,
    warnings,
    suggestions,
  };
}

/** Back-most row (other than `exclude`) with at least `room` free seats. */
function findRowWithRoom(
  sizes: number[],
  maxPerRow: number,
  exclude: number,
  room: number,
): number {
  for (let i = sizes.length - 1; i >= 0; i--) {
    if (i !== exclude && sizes[i] + room <= maxPerRow) return i;
  }
  return -1;
}

/** Fullest row (other than `exclude`) with at least `minSize` people. */
function findDonorRow(
  sizes: number[],
  exclude: number,
  minSize: number,
): number {
  let best = -1;
  for (let i = 0; i < sizes.length; i++) {
    if (i === exclude) continue;
    if (sizes[i] >= minSize && (best === -1 || sizes[i] > sizes[best])) {
      best = i;
    }
  }
  return best;
}
