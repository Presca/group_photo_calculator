import { describe, expect, it } from "vitest";
import {
  applySeatSwaps,
  DEFAULT_CONFIG,
  generateLayout,
} from "../layoutEngine";
import type { SessionConfig } from "../types";

const baseConfig: SessionConfig = {
  ...DEFAULT_CONFIG,
  schoolName: "Test High",
  totalStudents: 300,
  totalTeachers: 20,
  stageWidthM: 18,
  shoulderWidthM: 0.45,
  standingRows: 8,
};

describe("generateLayout", () => {
  it("seats every student and teacher exactly once", () => {
    const layout = generateLayout(baseConfig);
    const seats = layout.seatRows.flatMap((r) => r.seats);
    const students = seats.filter((s) => s.occupant.kind === "student");
    const teachers = seats.filter((s) => s.occupant.kind === "teacher");
    expect(students).toHaveLength(300);
    expect(teachers).toHaveLength(20);
  });

  it("puts the principal in the centre of the seated row", () => {
    const layout = generateLayout(baseConfig);
    const seatedRow = layout.seatRows.find((r) => r.kind === "seated");
    expect(seatedRow).toBeDefined();
    const principal = seatedRow!.seats.find(
      (s) => s.occupant.role === "principal",
    );
    expect(principal).toBeDefined();
    expect(principal!.seatNumber).toBe(Math.ceil(20 / 2));
  });

  it("stands teachers in the centre of row 1 for front-standing layout", () => {
    const layout = generateLayout({
      ...baseConfig,
      teacherLayout: "front-standing",
    });
    expect(layout.seatRows.find((r) => r.kind === "seated")).toBeUndefined();
    const row1 = layout.seatRows.find((r) => r.rowNumber === 1)!;
    const teacherSeats = row1.seats.filter(
      (s) => s.occupant.kind === "teacher",
    );
    expect(teacherSeats).toHaveLength(20);
    const principal = teacherSeats.find((s) => s.occupant.role === "principal")!;
    expect(principal.seatNumber).toBe(Math.ceil(row1.seats.length / 2));
  });

  it("builds one queue per non-empty height group", () => {
    const layout = generateLayout(baseConfig);
    expect(layout.queues).toHaveLength(9);
    expect(layout.queues[0].letter).toBe("A");
    expect(layout.queues[0].groupId).toBe("S9");
    expect(layout.queues[0].fromRow).toBe(8);
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

describe("applySeatSwaps", () => {
  it("swaps two occupants and ignores stale swaps", () => {
    const layout = generateLayout(baseConfig);
    const swapped = applySeatSwaps(layout.seatRows, [
      {
        a: { rowNumber: 1, seatNumber: 1 },
        b: { rowNumber: 8, seatNumber: 1 },
      },
      // Stale swap referencing a seat that does not exist.
      { a: { rowNumber: 99, seatNumber: 1 }, b: { rowNumber: 1, seatNumber: 2 } },
    ]);
    const row1 = layout.seatRows.find((r) => r.rowNumber === 1)!;
    const row8 = layout.seatRows.find((r) => r.rowNumber === 8)!;
    const newRow1 = swapped.find((r) => r.rowNumber === 1)!;
    const newRow8 = swapped.find((r) => r.rowNumber === 8)!;
    expect(newRow1.seats[0].occupant).toEqual(row8.seats[0].occupant);
    expect(newRow8.seats[0].occupant).toEqual(row1.seats[0].occupant);
    // Original untouched (pure function).
    expect(layout.seatRows.find((r) => r.rowNumber === 1)!.seats[0].occupant)
      .toEqual(row1.seats[0].occupant);
  });
});
