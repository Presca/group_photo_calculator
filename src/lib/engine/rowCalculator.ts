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
 * going towards the back. This is strict: generated rows never deviate
 * — the arithmetic remainder stands at the side as an "extra" instead.
 */
export function targetParityForRow(rowNumber: number): Parity {
  return rowNumber % 2 === 1 ? "odd" : "even";
}

/** Largest size ≤ maxPerRow with the row's required parity. */
export function rowCapFor(rowNumber: number, maxPerRow: number): number {
  const wantOdd = targetParityForRow(rowNumber) === "odd";
  if (wantOdd) return maxPerRow % 2 === 1 ? maxPerRow : maxPerRow - 1;
  return maxPerRow % 2 === 0 ? maxPerRow : maxPerRow - 1;
}

/** Total people the strict odd/even pattern can hold in rowCount rows. */
export function strictRowCapacity(
  rowCount: number,
  maxPerRow: number,
): number {
  let sum = 0;
  for (let r = 1; r <= rowCount; r++) sum += rowCapFor(r, maxPerRow);
  return sum;
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
 * Set rule: every generated row strictly follows the odd/even/odd/even
 * pattern. Sizes are constructed directly with the correct parity:
 * odd-target rows are seeded with 1 person and the rest are dealt out
 * in pairs (pairs never change parity), remainder pairs going to the
 * back rows so the back is fullest. When the total's parity cannot
 * match the pattern, the odd person out becomes an "extra" (reported
 * in `extras`) who stands at the side of the layout rather than
 * breaking a row's parity.
 *
 * Because the construction is a closed formula rather than an
 * iterative shuffle, changing the head-count by 1 or 2 only nudges one
 * or two rows — which is what keeps live adjustments stable on the day.
 *
 * With `fixedSizes` (live pins), pinned rows are untouchable — a pin
 * is allowed to break the pattern because it records reality — and the
 * remaining people are distributed strictly across the unpinned rows.
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
      extras: 0,
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

  const fixed = sanitizeFixed(fixedSizes, rowCount, maxPerRow, warnings);

  if (fixed.size === 0) {
    const rowsUsed = Math.min(rowCount, peopleCount);
    if (rowsUsed < rowCount) {
      warnings.push(
        `Only ${rowsUsed} of ${rowCount} rows are needed for this group size.`,
      );
    }
    const rowNumbers = Array.from({ length: rowsUsed }, (_, i) => i + 1);
    const { sizes, sideExtras, unplaced } = distribute(
      peopleCount,
      rowNumbers,
      maxPerRow,
    );
    if (unplaced > 0) {
      ok = false;
      warnings.push(
        `${unplaced} ${unplaced === 1 ? "person does" : "people do"} not fit the odd/even row pattern at this stage width.`,
      );
      suggestions.push("Add another row or switch to multi-shot stitching.");
    }
    return buildResult({
      rowNumbers,
      sizes,
      extras: sideExtras,
      pinnedRows: fixed,
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
  let remaining = peopleCount - fixedSum;
  if (remaining < 0) {
    warnings.push(
      `Pinned rows hold ${fixedSum} people but the session only has ${peopleCount} — update the totals or unpin a row.`,
    );
    remaining = 0;
  }

  const freeRowNumbers: number[] = [];
  for (let r = 1; r <= rowCount; r++) {
    if (!fixed.has(r)) freeRowNumbers.push(r);
  }

  const { sizes: freeSizes, sideExtras, unplaced } = distribute(
    remaining,
    freeRowNumbers,
    maxPerRow,
  );
  if (unplaced > 0) {
    ok = false;
    warnings.push(
      `${unplaced} people do not fit in the unpinned rows.`,
    );
    suggestions.push("Unpin a row, add another row, or switch to stitching.");
  }

  const rowNumbers = Array.from({ length: rowCount }, (_, i) => i + 1);
  const freeSizeByRow = new Map(freeRowNumbers.map((r, i) => [r, freeSizes[i]]));
  const sizes = rowNumbers.map(
    (r) => fixed.get(r) ?? freeSizeByRow.get(r) ?? 0,
  );

  return buildResult({
    rowNumbers,
    sizes,
    extras: sideExtras,
    pinnedRows: fixed,
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
  extras: number;
  pinnedRows: Map<number, number>;
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
  extras,
  pinnedRows,
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

  const relaxedPinned = rows.filter(
    (r) => r.parityRelaxed && pinnedRows.has(r.rowNumber),
  );
  if (relaxedPinned.length > 0) {
    warnings.push(
      `Pinned row ${relaxedPinned.map((r) => r.rowNumber).join(", ")} breaks the odd/even pattern (pinned counts keep their real value).`,
    );
  }

  const placed = sizes.reduce((a, b) => a + b, 0) + extras;
  return {
    ok,
    rows,
    maxPerRow,
    capacity,
    placed,
    extras,
    overflow: peopleCount - placed,
    warnings,
    suggestions,
  };
}

/**
 * Core strict-parity distribution over an ordered set of rows (front
 * first). Each row's cap is the largest size ≤ maxPerRow with its
 * required parity, so generated rows can never break the pattern.
 * Returns `sideExtras` — the odd person out who stands at the side —
 * and `unplaced` when the strict pattern cannot hold everyone.
 */
function distribute(
  count: number,
  rowNumbers: number[],
  maxPerRow: number,
): { sizes: number[]; sideExtras: number; unplaced: number } {
  const n = rowNumbers.length;
  const sizes: number[] = new Array(n).fill(0);
  if (n === 0 || count <= 0) {
    return { sizes, sideExtras: 0, unplaced: Math.max(0, count) };
  }

  if (count < n) {
    // Degenerate: fewer people than rows. Back rows get one each.
    for (let i = 0; i < count; i++) sizes[n - 1 - i] = 1;
    return { sizes, sideExtras: 0, unplaced: 0 };
  }

  const caps = rowNumbers.map((r) => rowCapFor(r, maxPerRow));
  const seeds: number[] = rowNumbers.map((r) =>
    targetParityForRow(r) === "odd" ? 1 : 0,
  );
  const oddCount = seeds.reduce((a, b) => a + b, 0);

  const pool = count - oddCount;
  const pairsWanted = pool >> 1;
  const sideExtras = pool & 1;

  const pairCaps = caps.map((c, i) => Math.max(0, (c - seeds[i]) >> 1));
  const totalPairCap = pairCaps.reduce((a, b) => a + b, 0);
  const pairs = Math.min(pairsWanted, totalPairCap);
  const unplaced = 2 * (pairsWanted - pairs);

  // Even share first, capped per row; remainder pairs go to the back.
  const per = Math.floor(pairs / n);
  const assigned = pairCaps.map((pc) => Math.min(per, pc));
  let remaining = pairs - assigned.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (remaining > 0 && guard++ < 100000) {
    let progressed = false;
    for (let i = n - 1; i >= 0 && remaining > 0; i--) {
      if (assigned[i] < pairCaps[i]) {
        assigned[i] += 1;
        remaining -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  for (let i = 0; i < n; i++) sizes[i] = 2 * assigned[i] + seeds[i];

  // No used row should be empty: pull a pair from the fullest row
  // (pair moves preserve parity).
  for (let i = 0; i < n; i++) {
    let fillGuard = 0;
    while (sizes[i] < 1 && fillGuard++ < 1000) {
      let donor = -1;
      for (let j = 0; j < n; j++) {
        if (j !== i && sizes[j] >= 3 && (donor === -1 || sizes[j] > sizes[donor])) {
          donor = j;
        }
      }
      if (donor === -1) break;
      sizes[donor] -= 2;
      sizes[i] += 2;
    }
  }

  // Keep rows balanced: a row should not dwarf the row behind it.
  // Pair moves preserve parity; per-row caps preserve the pattern.
  let moved = true;
  guard = 0;
  while (moved && guard++ < 1000) {
    moved = false;
    for (let i = 0; i < n - 1; i++) {
      while (
        sizes[i] - sizes[i + 1] >= 2 &&
        sizes[i + 1] + 2 <= caps[i + 1] &&
        sizes[i] - 2 >= 1
      ) {
        sizes[i] -= 2;
        sizes[i + 1] += 2;
        moved = true;
      }
    }
  }

  return { sizes, sideExtras, unplaced };
}
