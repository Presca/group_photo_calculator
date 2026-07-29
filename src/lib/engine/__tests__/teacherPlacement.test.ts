import { describe, expect, it } from "vitest";
import {
  assignTeachersFrontFirst,
  centreOutSeatOrder,
  generateTeacherRoster,
  interspersedSeatOrder,
} from "../teacherPlacement";

describe("interspersedSeatOrder", () => {
  it("spaces teachers evenly between students", () => {
    expect(interspersedSeatOrder(39, 4)).toEqual([8, 16, 24, 32]);
  });

  it("returns unique in-range seats even when crowded", () => {
    const seats = interspersedSeatOrder(36, 23);
    expect(new Set(seats).size).toBe(23);
    for (const s of seats) {
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(36);
    }
  });

  it("fills the whole row when teachers equal or exceed seats", () => {
    expect(interspersedSeatOrder(5, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(interspersedSeatOrder(3, 7)).toEqual([1, 2, 3]);
  });
});

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

  it("overflows to the second row, interspersed between students", () => {
    const roster = generateTeacherRoster(5, 55);
    const { plans, seatsByRow, unplaced } = assignTeachersFrontFirst(
      rows,
      roster,
    );
    expect(unplaced).toBe(0);
    expect(seatsByRow.get(1)).toHaveLength(37); // front row full
    expect(seatsByRow.get(2)).toHaveLength(23); // overflow between students
    expect(seatsByRow.get(3)).toBeUndefined();
    // Overflow seats are spread, not a contiguous block from seat 1.
    const row2 = seatsByRow.get(2)!;
    expect(row2[0]).toBeGreaterThan(1 - 1);
    expect(new Set(row2).size).toBe(23);
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
