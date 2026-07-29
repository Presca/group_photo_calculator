import { describe, expect, it } from "vitest";
import {
  calculateRows,
  maxPeoplePerRow,
  parityOf,
  targetParityForRow,
} from "../rowCalculator";

describe("maxPeoplePerRow", () => {
  it("floors stage width divided by shoulder width", () => {
    expect(maxPeoplePerRow(18, 0.45)).toBe(40);
    expect(maxPeoplePerRow(10, 0.45)).toBe(22);
    expect(maxPeoplePerRow(9.9, 0.5)).toBe(19);
  });

  it("returns 0 for invalid measurements", () => {
    expect(maxPeoplePerRow(0, 0.45)).toBe(0);
    expect(maxPeoplePerRow(18, 0)).toBe(0);
    expect(maxPeoplePerRow(-5, 0.45)).toBe(0);
  });
});

describe("targetParityForRow", () => {
  it("front row is odd and parities alternate", () => {
    expect(targetParityForRow(1)).toBe("odd");
    expect(targetParityForRow(2)).toBe("even");
    expect(targetParityForRow(3)).toBe("odd");
    expect(targetParityForRow(8)).toBe("even");
  });
});

describe("calculateRows", () => {
  it("places everyone exactly once", () => {
    const result = calculateRows({ peopleCount: 300, rowCount: 8, maxPerRow: 40 });
    expect(result.ok).toBe(true);
    expect(result.rows.reduce((sum, r) => sum + r.size, 0)).toBe(300);
    expect(result.overflow).toBe(0);
  });

  it("keeps the front row odd", () => {
    for (const count of [100, 137, 250, 301, 442]) {
      const result = calculateRows({ peopleCount: count, rowCount: 6, maxPerRow: 80 });
      expect(result.rows[0].size % 2).toBe(1);
    }
  });

  it("alternates odd/even parities on all rows except at most one relaxed row", () => {
    for (let count = 50; count <= 400; count += 7) {
      for (let rowCount = 2; rowCount <= 9; rowCount++) {
        const result = calculateRows({ peopleCount: count, rowCount, maxPerRow: 60 });
        // Strict rule: generated rows never deviate from the pattern.
        expect(result.rows.every((r) => !r.parityRelaxed)).toBe(true);
        expect(result.extras).toBeLessThanOrEqual(1);
        for (const row of result.rows) {
          expect(parityOf(row.size)).toBe(targetParityForRow(row.rowNumber));
        }
        // Everyone is accounted for: rows + extras + overflow.
        expect(
          result.rows.reduce((s, r) => s + r.size, 0) +
            result.extras +
            result.overflow,
        ).toBe(count);
      }
    }
  });

  it("never exceeds stage capacity per row and never leaves a used row empty", () => {
    for (let count = 10; count <= 500; count += 13) {
      const result = calculateRows({ peopleCount: count, rowCount: 7, maxPerRow: 40 });
      for (const row of result.rows) {
        expect(row.size).toBeLessThanOrEqual(40);
        expect(row.size).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("fills rows to capacity front-first, remainder in the back row", () => {
    const result = calculateRows({ peopleCount: 296, rowCount: 8, maxPerRow: 40 });
    const sizes = result.rows.map((r) => r.size);
    // Front rows at their parity caps: odd rows 39, even rows 40.
    expect(sizes.slice(0, 7)).toEqual([39, 40, 39, 40, 39, 40, 39]);
    // Back row takes what remains.
    expect(sizes[7]).toBe(296 - 276);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(296);
  });

  it("flags impossible sessions and suggests fixes", () => {
    const result = calculateRows({ peopleCount: 600, rowCount: 4, maxPerRow: 40 });
    expect(result.ok).toBe(false);
    expect(result.capacity).toBe(160);
    // Strict odd/even rows: 39 + 40 + 39 + 40.
    expect(result.placed).toBe(158);
    expect(result.overflow).toBe(442);
    expect(result.suggestions.join(" ")).toMatch(/row/i);
    expect(result.suggestions.join(" ")).toMatch(/stitch/i);
    expect(result.rows.reduce((sum, r) => sum + r.size, 0)).toBe(158);
    // Every row still strictly follows the pattern.
    expect(result.rows.every((r) => !r.parityRelaxed)).toBe(true);
  });

  it("uses fewer rows when the group is tiny", () => {
    // 5 people fit one strict row — no need to spread them out.
    const result = calculateRows({ peopleCount: 5, rowCount: 8, maxPerRow: 40 });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].size).toBe(5);
    expect(result.warnings.join(" ")).toMatch(/only 1 of 8 rows/i);
  });

  it("supports an even front row, alternating from there", () => {
    const result = calculateRows({
      peopleCount: 296,
      rowCount: 8,
      maxPerRow: 40,
      firstRowParity: "even",
    });
    const sizes = result.rows.map((r) => r.size);
    expect(sizes.slice(0, 7)).toEqual([40, 39, 40, 39, 40, 39, 40]);
    expect(sizes[0] % 2).toBe(0);
    expect(sizes[1] % 2).toBe(1);
    expect(result.rows.every((r) => !r.parityRelaxed)).toBe(true);
  });

  it("never relaxes parity — the odd person out becomes a side extra", () => {
    // One row, even count: the row stays odd, one person stands aside.
    const result = calculateRows({ peopleCount: 20, rowCount: 1, maxPerRow: 40 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].size).toBe(19);
    expect(result.rows[0].parityRelaxed).toBe(false);
    expect(result.extras).toBe(1);
    expect(result.placed).toBe(20);
    expect(result.overflow).toBe(0);
  });

  it("handles zero people gracefully", () => {
    const result = calculateRows({ peopleCount: 0, rowCount: 8, maxPerRow: 40 });
    expect(result.rows).toHaveLength(0);
    expect(result.placed).toBe(0);
  });

  it("respects pinned rows exactly and rebalances only the free rows", () => {
    const result = calculateRows({
      peopleCount: 300,
      rowCount: 8,
      maxPerRow: 40,
      fixedSizes: { 8: 41, 6: 30 },
    });
    const byRow = new Map(result.rows.map((r) => [r.rowNumber, r.size]));
    expect(byRow.get(8)).toBe(40); // 41 clamped to maxPerRow
    expect(byRow.get(6)).toBe(30);
    expect(result.rows.reduce((sum, r) => sum + r.size, 0)).toBe(300);
    expect(result.warnings.join(" ")).toMatch(/clamped/i);
    // Free rows still follow the parity pattern.
    for (const row of result.rows) {
      if (row.rowNumber === 8 || row.rowNumber === 6) continue;
      if (row.parityRelaxed) continue;
      expect(parityOf(row.size)).toBe(targetParityForRow(row.rowNumber));
    }
  });

  it("keeps a pinned row unchanged when the totals shift", () => {
    const before = calculateRows({
      peopleCount: 300,
      rowCount: 8,
      maxPerRow: 40,
      fixedSizes: { 8: 40 },
    });
    const after = calculateRows({
      peopleCount: 301,
      rowCount: 8,
      maxPerRow: 40,
      fixedSizes: { 8: 40 },
    });
    expect(before.rows[7].size).toBe(40);
    expect(after.rows[7].size).toBe(40);
    // 301st person: rows stay strict, one extra stands at the side.
    expect(
      after.rows.reduce((s, r) => s + r.size, 0) + after.extras,
    ).toBe(301);
  });

  it("warns when pinned rows exceed the session total", () => {
    const result = calculateRows({
      peopleCount: 10,
      rowCount: 3,
      maxPerRow: 40,
      fixedSizes: { 1: 15 },
    });
    expect(result.warnings.join(" ")).toMatch(/pinned/i);
    expect(result.rows.find((r) => r.rowNumber === 1)!.size).toBe(15);
  });

  it("flags overflow when people cannot fit in the unpinned rows", () => {
    const result = calculateRows({
      peopleCount: 120,
      rowCount: 3,
      maxPerRow: 40,
      fixedSizes: { 3: 10 },
    });
    // 110 remaining but only 2 free rows of 40.
    expect(result.ok).toBe(false);
    expect(result.suggestions.join(" ")).toMatch(/unpin/i);
  });

  it("stays stable when one person is added (no reshuffle)", () => {
    for (const base of [200, 287, 344]) {
      const before = calculateRows({ peopleCount: base, rowCount: 8, maxPerRow: 40 });
      const after = calculateRows({ peopleCount: base + 1, rowCount: 8, maxPerRow: 40 });
      let totalChange = 0;
      for (let i = 0; i < before.rows.length; i++) {
        totalChange += Math.abs(after.rows[i].size - before.rows[i].size);
      }
      // Adding one person should ripple through only a handful of rows.
      expect(totalChange).toBeLessThanOrEqual(5);
    }
  });
});
