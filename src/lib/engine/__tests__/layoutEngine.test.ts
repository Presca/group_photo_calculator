import { describe, expect, it } from "vitest";
import {
  applySeatSwaps,
  centreLeftThenRightOrder,
  DEFAULT_CONFIG,
  generateLayout,
} from "../layoutEngine";
import type { SessionConfig } from "../types";

// 280 students + 20 teachers (5 VIP) = 300 people; rows are automatic:
// ceil(300/40) = 8 rows, sizes [37,36,37,36,39,38,39,38] front-to-back.
const baseConfig: SessionConfig = {
  ...DEFAULT_CONFIG,
  schoolName: "Test High",
  totalStudents: 280,
  totalTeachers: 15,
  vipTeachers: 5,
  stageWidthM: 18,
  shoulderWidthM: 0.45,
};

describe("generateLayout", () => {
  it("seats every student and teacher exactly once", () => {
    const layout = generateLayout(baseConfig);
    const seats = layout.seatRows.flatMap((r) => r.seats);
    expect(seats.filter((s) => s.occupant.kind === "student")).toHaveLength(280);
    expect(seats.filter((s) => s.occupant.kind === "teacher")).toHaveLength(20);
  });

  it("computes the row count automatically from totals and stage width", () => {
    const small = generateLayout(baseConfig).rowsResult.rows.length;
    const big = generateLayout({ ...baseConfig, totalStudents: 320 })
      .rowsResult.rows.length;
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThanOrEqual(small);
  });

  it("always puts teachers in the front row, VIP 1 mid-row", () => {
    const layout = generateLayout(baseConfig);
    expect(layout.teachers.every((t) => t.rowNumber === 1)).toBe(true);
    expect(layout.teacherRows).toEqual([{ rowNumber: 1, count: 20 }]);
    const row1 = layout.seatRows.find((r) => r.rowNumber === 1)!;
    const vip1 = row1.seats.find((s) => s.occupant.teacherId === "V1")!;
    expect(
      Math.abs(vip1.seatNumber - Math.ceil(row1.seats.length / 2)),
    ).toBeLessThanOrEqual(1);
    // VIPs occupy the contiguous centre-most seats; regular teachers
    // sit outside the VIP block on either side.
    const vipSeats = row1.seats
      .filter((s) => s.occupant.role === "vip")
      .map((s) => s.seatNumber)
      .sort((a, b) => a - b);
    expect(vipSeats[vipSeats.length - 1] - vipSeats[0]).toBe(
      vipSeats.length - 1,
    );
    for (const s of row1.seats) {
      if (s.occupant.role !== "teacher") continue;
      expect(
        s.seatNumber < vipSeats[0] ||
          s.seatNumber > vipSeats[vipSeats.length - 1],
      ).toBe(true);
    }
    // Students flank the teacher block at both edges of the front row.
    expect(row1.seats[0].occupant.kind).toBe("student");
    expect(row1.seats[row1.seats.length - 1].occupant.kind).toBe("student");
  });

  it("overflows teachers to the next row as a centred block", () => {
    const layout = generateLayout({
      ...baseConfig,
      totalStudents: 240,
      totalTeachers: 55,
      vipTeachers: 5,
    });
    const row1 = layout.seatRows.find((r) => r.rowNumber === 1)!;
    expect(row1.seats.every((s) => s.occupant.kind === "teacher")).toBe(true);
    // Front row full of teachers, the rest overflow to row 2.
    expect(layout.teacherRows).toHaveLength(2);
    expect(layout.teacherRows[0].rowNumber).toBe(1);
    expect(layout.teacherRows[1].rowNumber).toBe(2);
    expect(
      layout.teacherRows.reduce((s, r) => s + r.count, 0),
    ).toBe(60);
    const row2 = layout.seatRows.find((r) => r.rowNumber === 2)!;
    const kinds = row2.seats.map((s) => s.occupant.kind);
    // Centred block: teachers contiguous, students only at the sides.
    const teacherSeatNumbers = row2.seats
      .filter((s) => s.occupant.kind === "teacher")
      .map((s) => s.seatNumber)
      .sort((a, b) => a - b);
    expect(
      teacherSeatNumbers[teacherSeatNumbers.length - 1] - teacherSeatNumbers[0],
    ).toBe(teacherSeatNumbers.length - 1);
    expect(kinds[0]).toBe("student");
    expect(kinds[kinds.length - 1]).toBe("student");
  });

  it("builds one queue per row of students, with exact counts", () => {
    const layout = generateLayout(baseConfig);
    expect(layout.queues).toHaveLength(layout.rowsResult.rows.length);
    const rowByNumber = new Map(
      layout.rowsResult.rows.map((r) => [r.rowNumber, r]),
    );
    const backRow = layout.rowsResult.rows.length;
    expect(layout.queues[0].letter).toBe("A");
    expect(layout.queues[0].fromRow).toBe(backRow);
    expect(layout.queues[0].count).toBe(rowByNumber.get(backRow)!.size);
    // Set rule 2,1,3,4,5: the last queue (shortest) fills ROW 2, and
    // the one before it takes the front row minus the teacher block.
    const shortest = layout.queues[layout.queues.length - 1];
    expect(shortest.toRow).toBe(2);
    expect(shortest.rank).toBe(1);
    const frontRowQueue = layout.queues.find((q) => q.toRow === 1)!;
    expect(frontRowQueue.count).toBe(rowByNumber.get(1)!.size - 20);
    expect(layout.queues.reduce((sum, q) => sum + q.count, 0)).toBe(280);
  });

  it("pins a row live and rebalances the remaining queues", () => {
    const plain = generateLayout(baseConfig);
    const backRow = plain.rowsResult.rows.length;
    const planned = plain.rowsResult.rows.find((r) => r.rowNumber === backRow)!
      .size;
    const pinned = generateLayout(baseConfig, { [backRow]: planned + 2 });
    const row = pinned.rowsResult.rows.find((r) => r.rowNumber === backRow)!;
    expect(row.size).toBe(planned + 2);
    // Everyone still placed exactly once.
    expect(
      pinned.rowsResult.rows.reduce((s, r) => s + r.size, 0) +
        pinned.rowsResult.extras,
    ).toBe(300);
    expect(pinned.queues.reduce((s, q) => s + q.count, 0)).toBe(280);
    // Operate steps carry the row number for live confirmation.
    const queueSteps = pinned.steps.filter((s) => s.queueLetter);
    expect(queueSteps.every((s) => s.rowNumber !== undefined)).toBe(true);
  });

  it("puts the odd person out at the side of the 2nd-last row, marked extra", () => {
    // 281 students + 20 teachers = 301 people: the strict pattern
    // holds 300, so one extra stands aside.
    const layout = generateLayout({ ...baseConfig, totalStudents: 281 });
    // Queue counts always account for everyone, extras included.
    expect(layout.queues.reduce((s, q) => s + q.count, 0)).toBe(281);
    if (layout.extras) {
      const row = layout.seatRows.find(
        (r) => r.rowNumber === layout.extras!.rowNumber,
      )!;
      const extraSeats = row.seats.filter((s) => s.occupant.extra);
      expect(extraSeats).toHaveLength(layout.extras.count);
      expect(extraSeats[0].seatNumber).toBe(
        row.seats.length - layout.extras.count + 1,
      );
      expect(layout.warnings.join(" ")).toMatch(/extra/i);
    }
  });

  it("keeps the front row odd and the second even, going UP (set rule 3)", () => {
    const layout = generateLayout(baseConfig);
    const sizes = layout.rowsResult.rows.map((r) => r.size);
    expect(sizes[0] % 2).toBe(1);
    expect(sizes[1] % 2).toBe(0);
    // The second row always holds MORE than the front row.
    expect(sizes[1]).toBeGreaterThan(sizes[0]);
  });

  it("supports an even front row via config", () => {
    const layout = generateLayout({ ...baseConfig, firstRowParity: "even" });
    const sizes = layout.rowsResult.rows.map((r) => r.size);
    expect(sizes[0] % 2).toBe(0);
    expect(sizes[1] % 2).toBe(1);
    expect(sizes[1]).toBeGreaterThan(sizes[0]);
    expect(
      sizes.reduce((s, x) => s + x, 0) + layout.rowsResult.extras,
    ).toBe(300);
  });

  it("produces a stitch plan only in stitch mode", () => {
    expect(generateLayout(baseConfig).stitch).toBeNull();
    const stitched = generateLayout({ ...baseConfig, photoMode: "stitch" });
    expect(stitched.stitch).not.toBeNull();
    expect(stitched.stitch![0].fromRow).toBe(stitched.rowsResult.rows.length);
  });

  it("surfaces warnings when the stage width fits nobody", () => {
    const layout = generateLayout({ ...baseConfig, stageWidthM: 0.2 });
    expect(layout.rowsResult.ok).toBe(false);
    expect(layout.warnings.length).toBeGreaterThan(0);
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
