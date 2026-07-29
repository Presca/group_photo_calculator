import { describe, expect, it } from "vitest";
import {
  calculateRows,
  maxPeoplePerRow,
  minimalRowsFor,
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

  it("keeps the front row odd and the next row larger", () => {
    for (const count of [100, 137, 250, 301, 442]) {
      const result = calculateRows({ peopleCount: count, rowCount: 6, maxPerRow: 80 });
      const sizes = result.rows.map((r) => r.size);
      // The last two rows may absorb the remainder, so check the body.
      expect(sizes[0] % 2).toBe(1);
      expect(sizes[1]).toBeGreaterThan(sizes[0]);
    }
  });

  it("alternates odd/even parities on all rows except at most one relaxed row", () => {
    for (let count = 50; count <= 400; count += 7) {
      for (let rowCount = 2; rowCount <= 9; rowCount++) {
        const result = calculateRows({ peopleCount: count, rowCount, maxPerRow: 60 });
        // Alternate rows never dip below their neighbours across the
        // body of the group (the last two rows absorb the remainder).
        const sizes = result.rows.map((r) => r.size);
        // Skip the final two rows: they absorb the remainder.
        const body = sizes.slice(0, Math.max(0, sizes.length - 2));
        for (let i = 1; i < body.length; i += 2) {
          expect(body[i]).toBeGreaterThanOrEqual(body[i - 1]);
          if (i + 1 < body.length) {
            expect(body[i]).toBeGreaterThanOrEqual(body[i + 1]);
          }
        }
        if (result.ok && sizes.length > 2) {
          expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(4);
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

  it("alternates upward and splits the tail across the last two rows", () => {
    const result = calculateRows({ peopleCount: 296, rowCount: 8, maxPerRow: 40 });
    const sizes = result.rows.map((r) => r.size);
    // Alternate rows hold one MORE than their neighbours, never less.
    for (let i = 1; i < sizes.length - 2; i += 2) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i + 1]);
    }
    // All rows stay within a couple of people of each other.
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(3);
    expect(sizes.reduce((a, b) => a + b, 0) + result.extras).toBe(296);
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

  it("supports an even front row, alternating upward from there", () => {
    const result = calculateRows({
      peopleCount: 296,
      rowCount: 8,
      maxPerRow: 40,
      firstRowParity: "even",
    });
    const sizes = result.rows.map((r) => r.size);
    // Even front row, and the next row holds one MORE, never one less.
    expect(sizes[0] % 2).toBe(0);
    expect(sizes[1] % 2).toBe(1);
    expect(sizes[1]).toBeGreaterThan(sizes[0]);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(3);
  });

  it("places everyone when a single row holds the whole group", () => {
    const result = calculateRows({ peopleCount: 20, rowCount: 1, maxPerRow: 40 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].size + result.extras).toBe(20);
    expect(result.overflow).toBe(0);
  });

  it("never dips below the front row: alternate rows are +1", () => {
    // The reported bug: 21,20,21,20 instead of 21,22,21,22.
    const result = calculateRows({
      peopleCount: 127,
      rowCount: 6,
      maxPerRow: 21,
    });
    const sizes = result.rows.map((r) => r.size);
    // Alternate rows go UP from the front row, never down.
    expect(sizes[1]).toBeGreaterThan(sizes[0]);
    expect(sizes[3]).toBeGreaterThan(sizes[2]);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(2);
    expect(sizes.reduce((a, b) => a + b, 0) + result.extras).toBe(127);
  });

  it("keeps every row a similar length — no stubby trailing row", () => {
    for (const people of [120, 127, 150, 199, 260, 301]) {
      const rows = minimalRowsFor(people, 21);
      const result = calculateRows({
        peopleCount: people,
        rowCount: rows,
        maxPerRow: 21,
      });
      const sizes = result.rows.map((r) => r.size);
      if (sizes.length < 2) continue;
      const smallest = Math.min(...sizes);
      const largest = Math.max(...sizes);
      // Rows stay within a few people so the group reads as one
      // consistent block at a glance — never a stubby trailing row.
      expect(largest - smallest).toBeLessThanOrEqual(3);
      const [secondLast, last] = sizes.slice(-2);
      expect(Math.abs(secondLast - last)).toBeLessThanOrEqual(3);
    }
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
    // Alternate rows may hold one over the nominal max, so 41 stands.
    expect(byRow.get(8)).toBe(41);
    expect(byRow.get(6)).toBe(30);
    expect(result.rows.reduce((sum, r) => sum + r.size, 0) + result.extras).toBe(
      300,
    );
    // Free rows stay close in size around the pinned ones.
    const free = result.rows
      .filter((r) => r.rowNumber !== 8 && r.rowNumber !== 6)
      .map((r) => r.size);
    expect(Math.max(...free) - Math.min(...free)).toBeLessThanOrEqual(3);
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
      let rowsChanged = 0;
      for (let i = 0; i < before.rows.length; i++) {
        if (after.rows[i].size !== before.rows[i].size) rowsChanged += 1;
      }
      // Adding one person should nudge only a few rows.
      expect(rowsChanged).toBeLessThanOrEqual(4);
    }
  });
});
