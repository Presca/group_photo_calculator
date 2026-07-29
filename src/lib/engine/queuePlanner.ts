import type { GroupRowSpan, HeightGroup, QueuePlan } from "./types";

/**
 * One queue per height group: the tallest group is Queue A because it
 * is called first (back rows fill first).
 */
export function planQueues(
  groups: HeightGroup[],
  spans: GroupRowSpan[],
): QueuePlan[] {
  const spanByGroup = new Map(spans.map((s) => [s.groupId, s]));
  return groups
    .filter((g) => g.count > 0)
    .map((group, i) => {
      const span = spanByGroup.get(group.id);
      return {
        letter: String.fromCharCode(65 + i),
        groupId: group.id,
        rank: group.rank,
        descriptor: group.descriptor,
        fromRow: span?.fromRow ?? 0,
        toRow: span?.toRow ?? 0,
        count: group.count,
      };
    });
}

/** "Rows 8–7" or "Row 8" for a single row. */
export function formatRowRange(fromRow: number, toRow: number): string {
  if (fromRow <= 0) return "—";
  return fromRow === toRow ? `Row ${fromRow}` : `Rows ${fromRow}–${toRow}`;
}
