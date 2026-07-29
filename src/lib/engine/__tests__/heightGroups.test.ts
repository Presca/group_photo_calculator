import { describe, expect, it } from "vitest";
import {
  assignGroupsToRows,
  calculateHeightGroups,
  heightDescriptor,
} from "../heightGroups";

describe("calculateHeightGroups", () => {
  it("splits students across the requested number of zones", () => {
    for (const groupCount of [5, 7, 9] as const) {
      const groups = calculateHeightGroups(300, groupCount);
      expect(groups).toHaveLength(groupCount);
      expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(300);
    }
  });

  it("names zones tallest-first (S9 … S1)", () => {
    const groups = calculateHeightGroups(90, 9);
    expect(groups[0].id).toBe("S9");
    expect(groups[0].descriptor).toBe("Tallest");
    expect(groups[8].id).toBe("S1");
    expect(groups[8].descriptor).toBe("Shortest");
  });

  it("gives remainder students to the tallest zones", () => {
    const groups = calculateHeightGroups(93, 9);
    expect(groups[0].count).toBe(11);
    expect(groups[8].count).toBe(10);
  });

  it("labels the middle zone Medium", () => {
    expect(heightDescriptor(4, 9)).toBe("Medium");
    expect(heightDescriptor(2, 5)).toBe("Medium");
    expect(heightDescriptor(1, 9)).toBe("Tall");
    expect(heightDescriptor(7, 9)).toBe("Short");
  });
});

describe("assignGroupsToRows", () => {
  it("fills back rows with the tallest groups first", () => {
    const rows = [
      { rowNumber: 1, studentCapacity: 10 },
      { rowNumber: 2, studentCapacity: 10 },
      { rowNumber: 3, studentCapacity: 10 },
    ];
    const groups = calculateHeightGroups(30, 5);
    const { spans, slices, unplaced } = assignGroupsToRows(rows, groups);
    expect(unplaced).toBe(0);
    // Tallest group starts in the back row.
    expect(spans[0].fromRow).toBe(3);
    // Shortest group ends in the front row.
    expect(spans[spans.length - 1].toRow).toBe(1);
    // Slice counts match group counts.
    for (const group of groups) {
      const placed = slices
        .filter((s) => s.groupId === group.id)
        .reduce((sum, s) => sum + s.count, 0);
      expect(placed).toBe(group.count);
    }
  });

  it("reports students that do not fit", () => {
    const rows = [{ rowNumber: 1, studentCapacity: 5 }];
    const groups = calculateHeightGroups(20, 5);
    const { unplaced } = assignGroupsToRows(rows, groups);
    expect(unplaced).toBe(15);
  });
});
