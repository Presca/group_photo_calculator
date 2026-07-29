"use client";

import { useMemo } from "react";
import type { StageLayout } from "@/lib/engine";
import { zoneIsDark, zoneShade } from "./StageCanvas";

interface BandSegment {
  kind: "student" | "teacher";
  count: number;
  color: string;
}

/**
 * Glanceable snapshot of the finished photograph, sized to fit any
 * phone screen with no scrolling: one band per row, band width
 * proportional to the head-count, the count printed on the band.
 * Blue segments show exactly where teachers sit/stand vs students
 * (centred block in the front row, interspersed slivers in overflow
 * rows). Back (tallest) row at the top.
 */
export function StageSnapshot({ layout }: { layout: StageLayout }) {
  const rows = useMemo(
    () => [...layout.seatRows].sort((a, b) => b.rowNumber - a.rowNumber),
    [layout],
  );
  const maxSize = Math.max(1, ...rows.map((r) => r.seats.length));
  const zoneByRow = new Map(
    layout.rowSlices.map((s) => [s.rowNumber, s.groupId]),
  );
  const teacherCountByRow = new Map(
    layout.teacherRows.map((t) => [t.rowNumber, t.count]),
  );

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const size = row.seats.length;
        const zone = zoneByRow.get(row.rowNumber);
        const teacherCount = teacherCountByRow.get(row.rowNumber) ?? 0;
        const studentCount = size - teacherCount;
        const segments = buildSegments(row.seats, zone);
        const mostlyTeachers = teacherCount > size / 2;
        const darkText = mostlyTeachers || zoneIsDark(zone);
        // Mixed rows spell out the split so the count is never mistaken
        // for "37 teachers": e.g. "30T + 7S".
        const centreLabel =
          teacherCount > 0
            ? studentCount > 0
              ? `${teacherCount}T + ${studentCount}S`
              : `${teacherCount}T`
            : `${size}`;
        return (
          <div key={row.rowNumber} className="flex justify-center">
            <div
              className="relative h-11 min-w-0 overflow-hidden rounded-xl"
              style={{ width: `${Math.max(42, (size / maxSize) * 100)}%` }}
            >
              {/* Seat segments: grey students, blue teachers */}
              <div className="absolute inset-0 flex">
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${(seg.count / size) * 100}%`,
                      backgroundColor: seg.color,
                    }}
                  />
                ))}
              </div>
              {/* Labels over the band */}
              <div
                className={`absolute inset-0 flex items-center justify-between gap-2 px-3 ${
                  darkText ? "text-white" : "text-slate-800"
                }`}
              >
                <span className="whitespace-nowrap text-sm font-extrabold drop-shadow-sm">
                  Row {row.rowNumber}
                </span>
                <span
                  className={`whitespace-nowrap font-black tabular-nums leading-none drop-shadow-sm ${
                    teacherCount > 0 && studentCount > 0
                      ? "text-base sm:text-xl"
                      : "text-xl"
                  }`}
                >
                  {centreLabel}
                </span>
                <span
                  className={`whitespace-nowrap text-xs font-bold ${
                    darkText ? "text-white/85" : "text-slate-600"
                  }`}
                >
                  {zone ?? (teacherCount > 0 ? "Teachers" : "—")}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-2 text-center text-[11px] font-extrabold tracking-[0.25em] text-slate-400">
        ▲ CAMERA THIS SIDE ▲
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded bg-blue-600" />
          Teachers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded bg-slate-400" />
          Students (darker = taller)
        </span>
      </div>
    </div>
  );
}

/** Merge consecutive seats of the same kind into proportional segments. */
function buildSegments(
  seats: StageLayout["seatRows"][number]["seats"],
  zone: string | undefined,
): BandSegment[] {
  const segments: BandSegment[] = [];
  for (const seat of seats) {
    const kind = seat.occupant.kind;
    const color = kind === "teacher" ? "#2563eb" : zoneShade(zone);
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) {
      last.count += 1;
    } else {
      segments.push({ kind, count: 1, color });
    }
  }
  return segments;
}
