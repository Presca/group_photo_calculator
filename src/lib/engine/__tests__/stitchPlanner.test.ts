import { describe, expect, it } from "vitest";
import { planStitch } from "../stitchPlanner";

describe("planStitch", () => {
  it("divides 8 rows into three photos with no overlap", () => {
    expect(planStitch(8, 3, 0)).toEqual([
      { label: "Photo A", fromRow: 8, toRow: 6 },
      { label: "Photo B", fromRow: 5, toRow: 3 },
      { label: "Photo C", fromRow: 2, toRow: 1 },
    ]);
  });

  it("shares rows between photos when overlap is set", () => {
    expect(planStitch(8, 3, 1)).toEqual([
      { label: "Photo A", fromRow: 8, toRow: 6 },
      { label: "Photo B", fromRow: 6, toRow: 4 },
      { label: "Photo C", fromRow: 4, toRow: 2 },
      { label: "Photo D", fromRow: 2, toRow: 1 },
    ]);
  });

  it("always covers down to row 1", () => {
    for (let rows = 1; rows <= 12; rows++) {
      for (let per = 1; per <= 4; per++) {
        for (let overlap = 0; overlap < per; overlap++) {
          const photos = planStitch(rows, per, overlap);
          expect(photos[photos.length - 1].toRow).toBe(1);
          expect(photos[0].fromRow).toBe(rows);
        }
      }
    }
  });

  it("clamps overlap below rows-per-photo to avoid infinite plans", () => {
    const photos = planStitch(8, 3, 5);
    expect(photos.length).toBeLessThan(26);
    expect(photos[photos.length - 1].toRow).toBe(1);
  });

  it("returns nothing for zero rows", () => {
    expect(planStitch(0, 3, 1)).toEqual([]);
  });
});
