import type { StitchPhoto } from "./types";

/**
 * Divide rows into photo groups for multi-shot stitching, working from
 * the back row forwards. Adjacent photos share `overlapRows` rows so
 * the stitcher has reference points.
 *
 * Example (8 rows, 3 per photo, overlap 0):
 *   Photo A rows 8–6, Photo B rows 5–3, Photo C rows 2–1.
 */
export function planStitch(
  rowCount: number,
  rowsPerPhoto: number,
  overlapRows: number,
): StitchPhoto[] {
  if (rowCount <= 0) return [];
  const per = Math.max(1, Math.floor(rowsPerPhoto));
  const overlap = Math.min(Math.max(0, Math.floor(overlapRows)), per - 1);

  const photos: StitchPhoto[] = [];
  let top = rowCount;
  let letter = 0;

  while (top >= 1 && letter < 26) {
    const bottom = Math.max(1, top - per + 1);
    photos.push({
      label: `Photo ${String.fromCharCode(65 + letter)}`,
      fromRow: top,
      toRow: bottom,
    });
    if (bottom === 1) break;
    top = bottom - 1 + overlap;
    letter += 1;
  }

  return photos;
}
