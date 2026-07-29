import { describe, expect, it } from "vitest";
import {
  applySeatSwaps,
  centreLeftThenRightOrder,
  DEFAULT_CONFIG,
  generateLayout,
} from "../layoutEngine";
import type { SessionConfig } from "../types";

// 280 students + 20 teachers = 300 people in 8 rows of ≤40:
// row sizes [37,36,37,36,39,38,39,38] front-to-back.
const baseConfig: SessionConfig = {
  ...DEFAULT_CONFIG,
  schoolName: "Test High",
  totalStudents: 280,
  totalTeachers: 20,
  stageWidthM: 18,
  shoulderWidthM: 0.45,
  standingRows: 8,
};

describe("generateLayout", () => {
  it("seats every student and teacher exactly once", () => {
    const layout = generateLayout(baseConfig);
    const seats = layout.seatRows.flatMap((r) => r.seats);
    expect(seats.filter((s) => s.occupant.kind === "student")).toHaveLength(280);
    expect(seats.filter((s) => s.occupant.kind === "teacher")).toHaveLength(20);
  });

  it("always puts teachers in the front row, principal mid-row", () => {
    const layout = generateLayout(baseConfig);
    expect(layout.teachers.every((t) => t.rowNumber === 1)).toBe(true);
    expect(layout.teacherRows).toEqual([{ rowNumber: 1, count: 20 }]);
    const row1 = layout.seatRows.find((r) => r.rowNumber === 1)!;
    const principal = row1.seats.find(
      (s) => s.occupant.role === "principal",
    )!;
    expect(
      Math.abs(principal.seatNumber - Math.ceil(row1.seats.length / 2)),
    ).toBeLessThanOrEqual(1);
    // Students flank the teacher block at both edges of the front row.
    expect(row1.seats[0].occupant.kind).toBe("student");
    expect(row1.seats[row1.seats.length - 1].occupant.kind).toBe("student");
  });

  it("overflows teachers to the next row, interspersed between students", () => {
    const layout = generateLayout({
      ...baseConfig,
      totalStudents: 240,
      totalTeachers: 60,
    });
    const row1 = layout.seatRows.find((r) => r.rowNumber === 1)!;
    expect(row1.seats.every((s) => s.occupant.kind === "teacher")).toBe(true);
    expect(layout.teacherRows).toEqual([
      { rowNumber: 1, count: 37 },
      { rowNumber: 2, count: 23 },
    ]);
    const row2 = layout.seatRows.find((r) => r.rowNumber === 2)!;
    const kinds = row2.seats.map((s) => s.occupant.kind);
    expect(kinds.filter((k) => k === "teacher")).toHaveLength(23);
    expect(kinds.filter((k) => k === "student")).toHaveLength(13);
    // Interspersed: the row must not start with a solid teacher block.
    expect(kinds.slice(0, 2)).toContain("student");
  });

  it("builds one queue per row of students, with exact counts", () => {
    const layout = generateLayout(baseConfig);
    expect(layout.queues).toHaveLength(8);
    const rowByNumber = new Map(
      layout.rowsResult.rows.map((r) => [r.rowNumber, r]),
    );
    expect(layout.queues[0].letter).toBe("A");
    expect(layout.queues[0].fromRow).toBe(8);
    expect(layout.queues[0].count).toBe(rowByNumber.get(8)!.size);
    // Front queue excludes the 20 teacher seats.
    const front = layout.queues[layout.queues.length - 1];
    expect(front.toRow).toBe(1);
    expect(front.count).toBe(rowByNumber.get(1)!.size - 20);
    expect(layout.queues.reduce((sum, q) => sum + q.count, 0)).toBe(280);
  });

  it("keeps the front row odd and the second even (set rule 3)", () => {
    const layout = generateLayout(baseConfig);
    expect(layout.rowsResult.rows[0].size % 2).toBe(1);
    expect(layout.rowsResult.rows[1].size % 2).toBe(0);
  });

  it("produces a stitch plan only in stitch mode", () => {
    expect(generateLayout(baseConfig).stitch).toBeNull();
    const stitched = generateLayout({ ...baseConfig, photoMode: "stitch" });
    expect(stitched.stitch).not.toBeNull();
    expect(stitched.stitch![0].fromRow).toBe(8);
  });

  it("surfaces warnings when the stage is too small", () => {
    const layout = generateLayout({
      ...baseConfig,
      totalStudents: 600,
      standingRows: 4,
      stageWidthM: 10,
    });
    expect(layout.rowsResult.ok).toBe(false);
    expect(layout.warnings.length).toBeGreaterThan(0);
    expect(layout.suggestions.length).toBeGreaterThan(0);
  });
});

describe("centreLeftThenRightOrder", () => {
  it("fills left of centre outward, then right of centre outward", () => {
    // Row of 6, all seats free: centre is seat 3.
    expect(centreLeftThenRightOrder([1, 2, 3, 4, 5, 6], 6)).toEqual([
      3, 2, 1, 4, 5, 6,
    ]);
  });

  it("works around occupied teacher seats", () => {
    // Row of 7 where seats 3-5 are teachers.
    expect(centreLeftThenRightOrder([1, 2, 6, 7], 7)).toEqual([2, 1, 6, 7]);
  });
});

describe("applySeatSwaps", () => {
  it("swaps two occupants and ignores stale swaps", () => {
    const layout = generateLayout(baseConfig);
    const swapped = applySeatSwaps(layout.seatRows, [
      {
        a: { rowNumber: 1, seatNumber: 1 },
        b: { rowNumber: 8, seatNumber: 1 },
      },
      { a: { rowNumber: 99, seatNumber: 1 }, b: { rowNumber: 1, seatNumber: 2 } },
    ]);
    const row1 = layout.seatRows.find((r) => r.rowNumber === 1)!;
    const row8 = layout.seatRows.find((r) => r.rowNumber === 8)!;
    const newRow1 = swapped.find((r) => r.rowNumber === 1)!;
    const newRow8 = swapped.find((r) => r.rowNumber === 8)!;
    expect(newRow1.seats[0].occupant).toEqual(row8.seats[0].occupant);
    expect(newRow8.seats[0].occupant).toEqual(row1.seats[0].occupant);
    expect(layout.seatRows.find((r) => r.rowNumber === 1)!.seats[0].occupant)
      .toEqual(row1.seats[0].occupant);
  });
});
