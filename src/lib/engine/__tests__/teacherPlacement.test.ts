import { describe, expect, it } from "vitest";
import {
  assignTeachersFrontFirst,
  centreOutSeatOrder,
  generateTeacherRoster,
} from "../teacherPlacement";

describe("assignTeachersFrontFirst", () => {
  const rows = [
    { rowNumber: 1, size: 37 },
    { rowNumber: 2, size: 36 },
    { rowNumber: 3, size: 37 },
  ];

  it("puts all teachers in the front row when they fit, centred block", () => {
    const roster = generateTeacherRoster(2, 8);
    const { plans, seatsByRow, unplaced } = assignTeachersFrontFirst(
      rows,
      roster,
    );
    expect(unplaced).toBe(0);
    expect(plans.every((p) => p.rowNumber === 1)).toBe(true);
    const seats = seatsByRow.get(1)!;
    // 10 teachers centred in a 37-seat row: seats 14..23.
    expect(Math.min(...seats)).toBe(14);
    expect(Math.max(...seats)).toBe(23);
    // VIP 1 lands mid-row.
    const vip1 = plans.find((p) => p.id === "V1")!;
    expect(vip1.role).toBe("vip");
    expect(Math.abs(vip1.seatNumber - Math.ceil(37 / 2))).toBeLessThanOrEqual(1);
  });

  it("overflows to the second row as a centred block, students at the sides", () => {
    const roster = generateTeacherRoster(5, 55);
    const { plans, seatsByRow, unplaced } = assignTeachersFrontFirst(
      rows,
      roster,
    );
    expect(unplaced).toBe(0);
    expect(seatsByRow.get(1)).toHaveLength(37); // front row full
    expect(seatsByRow.get(3)).toBeUndefined();
    // 23 overflow teachers form one contiguous centred block in row 2.
    const row2 = seatsByRow.get(2)!;
    expect(row2).toHaveLength(23);
    expect(row2[row2.length - 1] - row2[0]).toBe(22);
    expect(row2[0]).toBeGreaterThan(1); // students at the left side
    expect(row2[row2.length - 1]).toBeLessThan(36); // and at the right
    expect(plans).toHaveLength(60);
  });

  it("reports teachers who cannot fit at all", () => {
    const { unplaced } = assignTeachersFrontFirst(
      [{ rowNumber: 1, size: 5 }],
      generateTeacherRoster(0, 9),
    );
    expect(unplaced).toBe(4);
  });
});

describe("centreOutSeatOrder", () => {
  it("starts at the centre and radiates outward", () => {
    expect(centreOutSeatOrder(5)).toEqual([3, 4, 2, 5, 1]);
  });
});
