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
  /**
   * rowNumber → pinned size. Live on-the-day overrides: pinned rows
   * keep exactly this many people (reality wins over parity) and only
   * the remaining rows are rebalanced.
   */
  fixedSizes?: Record<number, number>;
}

/**
 * Distribute people across rows.
 *
 * Sizes are constructed directly with the correct parity: every
 * odd-target row is seeded with 1 person and the rest are dealt out in
 * pairs (pairs never change parity), remainder pairs going to the back
 * rows so the back is fullest. When the total makes the pattern
 * arithmetically impossible, exactly one person is absorbed by the
 * back row and that row is flagged as relaxed.
 *
 * Because the construction is a closed formula rather than an
 * iterative shuffle, changing the head-count by 1 or 2 only nudges one
 * or two rows — which is what keeps live adjustments stable on the day.
 *
 * With `fixedSizes` (live pins), pinned rows are untouchable: the
 * remaining people are distributed across the unpinned rows with the
 * same rules.
 */
export function calculateRows({
  peopleCount,
  rowCount,
  maxPerRow,
  fixedSizes,
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

  const fixed = sanitizeFixed(fixedSizes, rowCount, maxPerRow, warnings);

  if (fixed.size === 0) {
    const rowsUsed = Math.min(rowCount, placed);
    if (rowsUsed < rowCount) {
      warnings.push(
        `Only ${rowsUsed} of ${rowCount} rows are needed for this group size.`,
      );
    }
    const rowNumbers = Array.from({ length: rowsUsed }, (_, i) => i + 1);
    const { sizes, capacityParityBroken } = distribute(
      placed,
      rowNumbers,
      maxPerRow,
    );
    if (capacityParityBroken) {
      warnings.push("Row parities were relaxed to stay within stage capacity.");
    }
    return buildResult({
      rowNumbers,
      sizes,
      ok,
      maxPerRow,
      capacity,
      peopleCount,
      warnings,
      suggestions,
    });
  }

  // --- Live pins present: pinned rows are fixed, the rest rebalance. ---
  const fixedSum = [...fixed.values()].reduce((a, b) => a + b, 0);
  let remaining = placed - fixedSum;
  if (remaining < 0) {
    warnings.push(
      `Pinned rows hold ${fixedSum} people but the session only has ${placed} — update the totals or unpin a row.`,
    );
    remaining = 0;
  }

  const freeRowNumbers: number[] = [];
  for (let r = 1; r <= rowCount; r++) {
    if (!fixed.has(r)) freeRowNumbers.push(r);
  }
  const freeCapacity = freeRowNumbers.length * maxPerRow;
  if (remaining > freeCapacity) {
    ok = false;
    warnings.push(
      `${remaining - freeCapacity} people do not fit in the unpinned rows.`,
    );
    suggestions.push("Unpin a row, add another row, or switch to stitching.");
    remaining = freeCapacity;
  }

  const { sizes: freeSizes, capacityParityBroken } = distribute(
    remaining,
    freeRowNumbers,
    maxPerRow,
  );
  if (capacityParityBroken) {
    warnings.push("Row parities were relaxed to stay within stage capacity.");
  }

  const rowNumbers = Array.from({ length: rowCount }, (_, i) => i + 1);
  const freeSizeByRow = new Map(freeRowNumbers.map((r, i) => [r, freeSizes[i]]));
  const sizes = rowNumbers.map(
    (r) => fixed.get(r) ?? freeSizeByRow.get(r) ?? 0,
  );

  return buildResult({
    rowNumbers,
    sizes,
    ok,
    maxPerRow,
    capacity,
    peopleCount,
    warnings,
    suggestions,
  });
}

function sanitizeFixed(
  fixedSizes: Record<number, number> | undefined,
  rowCount: number,
  maxPerRow: number,
  warnings: string[],
): Map<number, number> {
  const fixed = new Map<number, number>();
  if (!fixedSizes) return fixed;
  for (const [key, value] of Object.entries(fixedSizes)) {
    const rowNumber = Number(key);
    if (
      !Number.isInteger(rowNumber) ||
      rowNumber < 1 ||
      rowNumber > rowCount ||
      !Number.isFinite(value)
    ) {
      continue;
    }
    const size = Math.round(value);
    if (size > maxPerRow) {
      warnings.push(
        `Row ${rowNumber} is pinned at ${size} but the stage fits ${maxPerRow} per row — clamped.`,
      );
    }
    fixed.set(rowNumber, Math.min(maxPerRow, Math.max(1, size)));
  }
  return fixed;
}

interface BuildResultInput {
  rowNumbers: number[];
  sizes: number[];
  ok: boolean;
  maxPerRow: number;
  capacity: number;
  peopleCount: number;
  warnings: string[];
  suggestions: string[];
}

function buildResult({
  rowNumbers,
  sizes,
  ok,
  maxPerRow,
  capacity,
  peopleCount,
  warnings,
  suggestions,
}: BuildResultInput): RowCalculationResult {
  const rows: RowPlan[] = rowNumbers.map((rowNumber, i) => {
    const size = sizes[i];
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

  const placed = sizes.reduce((a, b) => a + b, 0);
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

/**
 * Core parity-correct distribution over an ordered set of rows (front
 * first). Each row's target parity comes from its real row number, so
 * this works for the full stage and for the "free rows only" subset
 * used when live pins are active.
 */
function distribute(
  count: number,
  rowNumbers: number[],
  maxPerRow: number,
): { sizes: number[]; capacityParityBroken: boolean } {
  const n = rowNumbers.length;
  const sizes: number[] = new Array(n).fill(0);
  if (n === 0 || count <= 0) return { sizes, capacityParityBroken: false };

  if (count < n) {
    // Not enough people to fill every row: back rows get one each.
    for (let i = 0; i < count; i++) sizes[n - 1 - i] = 1;
    return { sizes, capacityParityBroken: false };
  }

  // Seed odd-target rows with 1, then deal the rest out in pairs.
  const oddRowCount = rowNumbers.filter(
    (r) => targetParityForRow(r) === "odd",
  ).length;
  const pool = count - oddRowCount;
  const pairs = Math.floor(pool / 2);
  const leftover = pool % 2;

  const basePairs = Math.floor(pairs / n);
  const extraPairs = pairs % n;
  for (let i = 0; i < n; i++) {
    const seed = targetParityForRow(rowNumbers[i]) === "odd" ? 1 : 0;
    // Remainder pairs go to the back rows.
    const extra = i >= n - extraPairs ? 1 : 0;
    sizes[i] = 2 * (basePairs + extra) + seed;
  }
  // When the total's parity cannot match the pattern, the back row
  // absorbs the odd person out.
  sizes[n - 1] += leftover;

  // Enforce the per-row maximum. Moves of 2 preserve parity; a move of
  // 1 is the last resort when the stage is nearly full.
  let capacityParityBroken = false;
  for (let i = n - 1; i >= 0; i--) {
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
      capacityParityBroken = true;
    }
  }

  // No used row may be empty (only possible with very small groups).
  for (let i = 0; i < n; i++) {
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
    for (let i = 0; i < n - 1; i++) {
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

  return { sizes, capacityParityBroken };
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
