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
        const relaxed = result.rows.filter((r) => r.parityRelaxed);
        // At or over physical capacity the stage limits win over parity;
        // otherwise at most one row may be relaxed.
        if (result.ok) expect(relaxed.length).toBeLessThanOrEqual(1);
        for (const row of result.rows) {
          if (row.parityRelaxed) continue;
          expect(parityOf(row.size)).toBe(targetParityForRow(row.rowNumber));
        }
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

  it("keeps row sizes balanced with the back rows fullest", () => {
    const result = calculateRows({ peopleCount: 296, rowCount: 8, maxPerRow: 40 });
    const sizes = result.rows.map((r) => r.size);
    // A row should never dwarf the row behind it.
    for (let i = 0; i < sizes.length - 1; i++) {
      expect(sizes[i] - sizes[i + 1]).toBeLessThanOrEqual(1);
    }
    // Largest row is at (or near) the back.
    const max = Math.max(...sizes);
    expect(sizes[sizes.length - 1]).toBeGreaterThanOrEqual(max - 2);
  });

  it("flags impossible sessions and suggests fixes", () => {
    const result = calculateRows({ peopleCount: 600, rowCount: 4, maxPerRow: 40 });
    expect(result.ok).toBe(false);
    expect(result.capacity).toBe(160);
    expect(result.placed).toBe(160);
    expect(result.overflow).toBe(440);
    expect(result.suggestions.join(" ")).toMatch(/row/i);
    expect(result.suggestions.join(" ")).toMatch(/stitch/i);
    // Best-effort plan still fills the stage.
    expect(result.rows.reduce((sum, r) => sum + r.size, 0)).toBe(160);
  });

  it("uses fewer rows when the group is tiny", () => {
    const result = calculateRows({ peopleCount: 5, rowCount: 8, maxPerRow: 40 });
    expect(result.rows.length).toBe(5);
    expect(result.rows.reduce((sum, r) => sum + r.size, 0)).toBe(5);
  });

  it("relaxes parity on a single row when totals make it impossible", () => {
    // One row, even count: cannot be odd without dropping someone.
    const result = calculateRows({ peopleCount: 20, rowCount: 1, maxPerRow: 40 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].size).toBe(20);
    expect(result.rows[0].parityRelaxed).toBe(true);
  });

  it("handles zero people gracefully", () => {
    const result = calculateRows({ peopleCount: 0, rowCount: 8, maxPerRow: 40 });
    expect(result.rows).toHaveLength(0);
    expect(result.placed).toBe(0);
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
