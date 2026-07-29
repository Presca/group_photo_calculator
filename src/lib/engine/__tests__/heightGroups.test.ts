import { describe, expect, it } from "vitest";
import { buildRowAlignedZones, heightDescriptor } from "../heightGroups";

const rows = (capacities: number[]) =>
  // capacities given front-to-back: index 0 = row 1
  capacities.map((studentCapacity, i) => ({
    rowNumber: i + 1,
    studentCapacity,
  }));

describe("heightDescriptor", () => {
  it("labels the extremes and the middle", () => {
    expect(heightDescriptor(0, 9)).toBe("Tallest");
    expect(heightDescriptor(8, 9)).toBe("Shortest");
    expect(heightDescriptor(4, 9)).toBe("Medium");
    expect(heightDescriptor(2, 5)).toBe("Medium");
    expect(heightDescriptor(1, 9)).toBe("Tall");
    expect(heightDescriptor(7, 9)).toBe("Short");
  });
});

describe("buildRowAlignedZones", () => {
  it("makes one zone per row when enough zones are requested", () => {
    const { groups, spans, slices } = buildRowAlignedZones(
      rows([37, 36, 37, 36, 39, 38, 39, 38]),
      9,
    );
    expect(groups).toHaveLength(8); // capped at row count
    // Tallest zone is exactly the back row.
    expect(groups[0].id).toBe("S8");
    expect(groups[0].descriptor).toBe("Tallest");
    expect(groups[0].count).toBe(38); // row 8's capacity
    expect(spans[0]).toMatchObject({ groupId: "S8", fromRow: 8, toRow: 8 });
    // Shortest zone is exactly the front row.
    expect(groups[7].descriptor).toBe("Shortest");
    expect(spans[7]).toMatchObject({ fromRow: 1, toRow: 1 });
    // Each row appears in exactly one slice with its full capacity.
    expect(slices).toHaveLength(8);
  });

  it("zone counts equal their rows' capacities exactly", () => {
    const capacities = [37, 36, 37, 36, 39, 38, 39, 38];
    for (const zones of [5, 7, 9]) {
      const { groups, slices } = buildRowAlignedZones(rows(capacities), zones);
      const total = capacities.reduce((a, b) => a + b, 0);
      expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(total);
      expect(slices.reduce((sum, s) => sum + s.count, 0)).toBe(total);
    }
  });

  it("merges adjacent rows when fewer zones than rows, extras at the back", () => {
    const { groups, spans } = buildRowAlignedZones(
      rows([10, 10, 10, 10, 10, 10, 10, 10]),
      5,
    );
    expect(groups).toHaveLength(5);
    // 8 rows into 5 zones: back zones get the extra rows (2,2,2,1,1).
    expect(spans[0]).toMatchObject({ fromRow: 8, toRow: 7 });
    expect(spans[1]).toMatchObject({ fromRow: 6, toRow: 5 });
    expect(spans[2]).toMatchObject({ fromRow: 4, toRow: 3 });
    expect(spans[3]).toMatchObject({ fromRow: 2, toRow: 2 });
    expect(spans[4]).toMatchObject({ fromRow: 1, toRow: 1 });
    expect(groups[0].count).toBe(20);
    expect(groups[4].count).toBe(10);
  });

  it("spans are contiguous back-to-front with no gaps or overlaps", () => {
    const { spans } = buildRowAlignedZones(
      rows([5, 6, 7, 8, 9, 10, 11]),
      5,
    );
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].fromRow).toBe(spans[i - 1].toRow - 1);
    }
    expect(spans[0].fromRow).toBe(7);
    expect(spans[spans.length - 1].toRow).toBe(1);
  });

  it("skips rows with no student seats", () => {
    // Row 1 fully occupied by standing teachers.
    const { groups, slices } = buildRowAlignedZones(
      rows([0, 10, 10]),
      9,
    );
    expect(groups).toHaveLength(2);
    expect(slices.every((s) => s.rowNumber !== 1)).toBe(true);
  });

  it("returns nothing for empty input", () => {
    expect(buildRowAlignedZones([], 9)).toEqual({
      groups: [],
      spans: [],
      slices: [],
    });
    expect(buildRowAlignedZones(rows([0, 0]), 9).groups).toHaveLength(0);
  });
});
