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

/**
 * Capacity of a row under the alternating pattern. The front-row
 * parity takes the largest size ≤ maxPerRow with that parity; the
 * alternate rows take that size + 1 — one MORE than the front row,
 * never one less (e.g. max 21 → 21, 22, 21, 22…). The +1 row may
 * exceed the nominal per-row max by one; rows compress slightly.
 */
export function rowCapFor(
  rowNumber: number,
  maxPerRow: number,
  firstRowParity: Parity = "odd",
): number {
  const firstWantsOdd = firstRowParity === "odd";
  const base =
    maxPerRow % 2 === (firstWantsOdd ? 1 : 0) ? maxPerRow : maxPerRow - 1;
  return targetParityForRow(rowNumber, firstRowParity) === firstRowParity
    ? base
    : base + 1;
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
  // Smallest row count whose pattern capacity holds everyone (one
  // arithmetic remainder may stand at the side). Searching upward from
  // 1 keeps rows as full as possible, so no stubby trailing row.
  let rows = 1;
  while (
    strictRowCapacity(rows, maxPerRow, firstRowParity) < count - 1 &&
    rows < 1000
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
    // The alternating pattern legitimately squeezes one extra person
    // into alternate rows, so pins may go one over the nominal max.
    const pinCap = maxPerRow + 1;
    if (size > pinCap) {
      warnings.push(
        `Row ${rowNumber} is pinned at ${size} but the stage fits about ${maxPerRow} per row — clamped.`,
      );
    }
    fixed.set(rowNumber, Math.min(pinCap, Math.max(1, size)));
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
 * Core distribution over an ordered set of rows (front first).
 *
 * Every row sits on a common base: front-parity rows hold `b`, the
 * alternate rows hold `b + 1` — one MORE than the front row, never one
 * less. The base is the largest that fits, then the leftover is handed
 * out two at a time to the front rows (pairs preserve parity), so all
 * rows stay within a couple of people of each other and the group
 * reads as one consistent block. The odd person out stands at the side.
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
  const capSum = caps.reduce((a, b) => a + b, 0);
  if (count >= capSum) {
    for (let i = 0; i < n; i++) sizes[i] = caps[i];
    return { sizes, sideExtras: 0, unplaced: count - capSum };
  }

  // `bumped[i]` is 1 when row i is an alternate (+1) row.
  const bumped: number[] = rowNumbers.map((r) =>
    targetParityForRow(r, firstRowParity) === firstRowParity ? 0 : 1,
  );
  const bumpTotal = bumped.reduce((a, b) => a + b, 0);
  const baseCap = caps[bumped.findIndex((b) => b === 0)] ?? maxPerRow;

  // Largest base whose parity matches the front row.
  let base = Math.floor((count - bumpTotal) / n);
  if (parityOf(base) !== firstRowParity) base -= 1;
  base = Math.max(1, Math.min(base, baseCap));

  for (let i = 0; i < n; i++) sizes[i] = base + bumped[i];
  let remaining = count - sizes.reduce((a, b) => a + b, 0);

  // Hand the leftover out to ADJACENT ROW PAIRS (+2 each, 4 per pair),
  // front pairs first. Bumping a pair together keeps the zigzag: an
  // alternate row always stays larger than the rows either side of it.
  let guard = 0;
  while (remaining >= 4 && guard++ < 10000) {
    let progressed = false;
    for (let i = 0; i + 1 < n && remaining >= 4; i += 2) {
      if (sizes[i] + 2 <= caps[i] && sizes[i + 1] + 2 <= caps[i + 1]) {
        sizes[i] += 2;
        sizes[i + 1] += 2;
        remaining -= 4;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  // The final 0–3 people join the last two rows, split as evenly as
  // possible, so the group never ends on a stubby row. Only from three
  // rows up — with fewer, this would disturb the front row, whose
  // parity is a hard rule.
  if (remaining > 0 && n >= 3) {
    const toSecondLast = Math.ceil(remaining / 2);
    const toLast = remaining - toSecondLast;
    if (
      sizes[n - 2] + toSecondLast <= caps[n - 2] + 2 &&
      sizes[n - 1] + toLast <= caps[n - 1] + 2
    ) {
      sizes[n - 2] += toSecondLast;
      sizes[n - 1] += toLast;
      remaining = 0;
    }
  }

  return { sizes, sideExtras: remaining, unplaced: 0 };
}
