"use client";

import type { StageLayout } from "@/lib/engine";
import { zoneIsDark, zoneShade } from "./StageCanvas";

/**
 * Glanceable snapshot of the finished photograph, sized to fit any
 * phone screen with no scrolling: one band per row, band width
 * proportional to the head-count, with the count printed on the band.
 * Back (tallest) row at the top, seated teachers at the bottom.
 */
export function StageSnapshot({ layout }: { layout: StageLayout }) {
  const rows = [...layout.rowsResult.rows].sort(
    (a, b) => b.rowNumber - a.rowNumber,
  );
  const maxSize = Math.max(
    1,
    ...rows.map((r) => r.size),
    layout.seatedTeacherCount,
  );
  const zoneByRow = new Map(
    layout.rowSlices.map((s) => [s.rowNumber, s.groupId]),
  );
  const standingTeachers = new Map<number, number>();
  for (const t of layout.teachers) {
    if (t.placement !== "standing") continue;
    standingTeachers.set(
      t.rowNumber,
      (standingTeachers.get(t.rowNumber) ?? 0) + 1,
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const zone = zoneByRow.get(row.rowNumber);
        const dark = zoneIsDark(zone);
        const teacherCount = standingTeachers.get(row.rowNumber) ?? 0;
        return (
          <div key={row.rowNumber} className="flex justify-center">
            <div
              className={`flex h-11 min-w-0 items-center justify-between gap-2 rounded-xl px-3 ${
                dark ? "text-white" : "text-slate-800"
              }`}
              style={{
                width: `${Math.max(40, (row.size / maxSize) * 100)}%`,
                backgroundColor: zoneShade(zone),
              }}
            >
              <span className="whitespace-nowrap text-sm font-extrabold">
                Row {row.rowNumber}
              </span>
              <span className="text-xl font-black tabular-nums leading-none">
                {row.size}
              </span>
              <span
                className={`whitespace-nowrap text-xs font-bold ${
                  dark ? "text-white/80" : "text-slate-500"
                }`}
              >
                {zone ?? "—"}
                {teacherCount > 0 && ` +${teacherCount}T`}
              </span>
            </div>
          </div>
        );
      })}

      {layout.seatedTeacherCount > 0 && (
        <div className="flex justify-center">
          <div
            className="flex h-11 min-w-0 items-center justify-between gap-2 rounded-xl bg-blue-600 px-3 text-white"
            style={{
              width: `${Math.max(40, (layout.seatedTeacherCount / maxSize) * 100)}%`,
            }}
          >
            <span className="whitespace-nowrap text-sm font-extrabold">
              Seated
            </span>
            <span className="text-xl font-black tabular-nums leading-none">
              {layout.seatedTeacherCount}
            </span>
            <span className="whitespace-nowrap text-xs font-bold text-white/80">
              Teachers
            </span>
          </div>
        </div>
      )}

      <div className="mt-2 text-center text-[11px] font-extrabold tracking-[0.25em] text-slate-400">
        ▲ CAMERA THIS SIDE ▲
      </div>
    </div>
  );
}
