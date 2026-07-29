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
 * Row parities alternate starting from the chosen front-row parity
 * (odd by default): odd/even/odd/even… or even/odd/even/odd…
 * This is strict: generated rows never deviate — the arithmetic
 * remainder stands at the side as an "extra" instead.
 */
export function targetParityForRow(
  rowNumber: number,
  firstRowParity: Parity = "odd",
): Parity {
  const sameAsFirst = rowNumber % 2 === 1;
  if (sameAsFirst) return firstRowParity;
  return firstRowParity === "odd" ? "even" : "odd";
}

/** Largest size ≤ maxPerRow with the row's required parity. */
export function rowCapFor(
  rowNumber: number,
  maxPerRow: number,
  firstRowParity: Parity = "odd",
): number {
  const wantOdd = targetParityForRow(rowNumber, firstRowParity) === "odd";
  if (wantOdd) return maxPerRow % 2 === 1 ? maxPerRow : maxPerRow - 1;
  return maxPerRow % 2 === 0 ? maxPerRow : maxPerRow - 1;
}

/** Total people the strict parity pattern can hold in rowCount rows. */
export function strictRowCapacity(
  rowCount: number,
  maxPerRow: number,
  firstRowParity: Parity = "odd",
): number {
  let sum = 0;
  for (let r = 1; r <= rowCount; r++) {
    sum += rowCapFor(r, maxPerRow, firstRowParity);
  }
  return sum;
}

/**
 * Fewest rows whose strict parity pattern holds `count` people (one
 * arithmetic remainder is allowed — they stand at the side).
 */
export function minimalRowsFor(
  count: number,
  maxPerRow: number,
  firstRowParity: Parity = "odd",
): number {
  if (count <= 0 || maxPerRow <= 0) return 0;
  let rows = Math.max(1, Math.ceil(count / maxPerRow));
  let guard = 0;
  while (
    strictRowCapacity(rows, maxPerRow, firstRowParity) < count - 1 &&
    guard++ < 1000
  ) {
    rows += 1;
  }
  return rows;
}

export interface CalculateRowsInput {
  peopleCount: number;
  rowCount: number;
  maxPerRow: number;
  /** Front row parity; subsequent rows alternate. Default odd. */
  firstRowParity?: Parity;
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
 * Set rules:
 * - Every generated row strictly alternates parity from the chosen
 *   front-row parity; rows never deviate. The arithmetic remainder
 *   becomes an "extra" (reported in `extras`) standing at the side.
 * - Rows FILL UP: each row front-to-back is filled to its parity
 *   capacity, and the back row takes the remainder. Adding a person
 *   on the day therefore only changes the back row.
 *
 * With `fixedSizes` (live pins), pinned rows are untouchable — a pin
 * is allowed to break the pattern because it records reality — and the
 * remaining people fill the unpinned rows front-to-back.
 */
export function calculateRows({
  peopleCount,
  rowCount,
  maxPerRow,
  firstRowParity = "odd",
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
    const rowsUsed = Math.min(
      rowCount,
      minimalRowsFor(peopleCount, maxPerRow, firstRowParity),
    );
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
      firstRowParity,
    );
    if (unplaced > 0) {
      ok = false;
      warnings.push(
        `${unplaced} ${unplaced === 1 ? "person does" : "people do"} not fit the alternating row pattern at this stage width.`,
      );
      suggestions.push("Add another row or switch to multi-shot stitching.");
    }
    return buildResult({
      rowNumbers,
      sizes,
      extras: sideExtras,
      pinnedRows: fixed,
      firstRowParity,
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
    firstRowParity,
  );
  if (unplaced > 0) {
    ok = false;
    warnings.push(`${unplaced} people do not fit in the unpinned rows.`);
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
    firstRowParity,
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
  firstRowParity: Parity;
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
  firstRowParity,
  ok,
  maxPerRow,
  capacity,
  peopleCount,
  warnings,
  suggestions,
}: BuildResultInput): RowCalculationResult {
  const rows: RowPlan[] = rowNumbers.map((rowNumber, i) => {
    const size = sizes[i];
    const targetParity = targetParityForRow(rowNumber, firstRowParity);
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
      `Pinned row ${relaxedPinned.map((r) => r.rowNumber).join(", ")} breaks the alternating pattern (pinned counts keep their real value).`,
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
 * Core strict-parity FILL-UP distribution over an ordered set of rows
 * (front first). Each row is filled to its parity capacity in order;
 * the last rows take the remainder. Returns `sideExtras` — the odd
 * person out who stands at the side — and `unplaced` when the strict
 * pattern cannot hold everyone.
 */
function distribute(
  count: number,
  rowNumbers: number[],
  maxPerRow: number,
  firstRowParity: Parity,
): { sizes: number[]; sideExtras: number; unplaced: number } {
  const n = rowNumbers.length;
  const sizes: number[] = new Array(n).fill(0);
  if (n === 0 || count <= 0) {
    return { sizes, sideExtras: 0, unplaced: Math.max(0, count) };
  }

  if (count < n) {
    // Degenerate: fewer people than rows. Front rows get one each.
    for (let i = 0; i < count; i++) sizes[i] = 1;
    return { sizes, sideExtras: 0, unplaced: 0 };
  }

  const caps = rowNumbers.map((r) => rowCapFor(r, maxPerRow, firstRowParity));
  const seeds: number[] = rowNumbers.map((r) =>
    targetParityForRow(r, firstRowParity) === "odd" ? 1 : 0,
  );
  const oddCount = seeds.reduce((a, b) => a + b, 0);

  const pool = count - oddCount;
  const pairsWanted = pool >> 1;
  const sideExtras = pool & 1;

  const pairCaps = caps.map((c, i) => Math.max(0, (c - seeds[i]) >> 1));
  const totalPairCap = pairCaps.reduce((a, b) => a + b, 0);
  const pairs = Math.min(pairsWanted, totalPairCap);
  const unplaced = 2 * (pairsWanted - pairs);

  // Fill up: front rows take their full parity capacity, the back row
  // takes whatever remains.
  let left = pairs;
  for (let i = 0; i < n; i++) {
    const take = Math.min(pairCaps[i], left);
    sizes[i] = 2 * take + seeds[i];
    left -= take;
  }

  return { sizes, sideExtras, unplaced };
}
