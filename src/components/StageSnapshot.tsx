"use client";

import { useMemo } from "react";
import type { StageLayout } from "@/lib/engine";

const ZONE_SHADES = [
  "#e2e8f0", // shortest
  "#dbe1e8",
  "#cbd5e1",
  "#b6c2d1",
  "#a3b1c2",
  "#94a3b8",
  "#8393aa",
  "#71809b",
  "#64748b", // tallest
];

/** Grey shade for a height zone id ("S1"…"S9"): taller = darker. */
export function zoneShade(groupId?: string): string {
  if (!groupId) return "#cbd5e1";
  const n = Number(groupId.replace("S", ""));
  if (!Number.isFinite(n)) return "#cbd5e1";
  return ZONE_SHADES[Math.min(ZONE_SHADES.length - 1, Math.max(0, n - 1))];
}

/** Whether a zone's shade is dark enough to need white text on it. */
export function zoneIsDark(groupId?: string): boolean {
  if (!groupId) return false;
  const n = Number(groupId.replace("S", ""));
  return Number.isFinite(n) && n >= 6;
}

interface BandSegment {
  kind: "student" | "teacher" | "extra";
  count: number;
  color: string;
}

/**
 * Glanceable snapshot of the finished photograph, sized to fit any
 * phone screen with no scrolling: one band per row, band width
 * proportional to the head-count, the count printed on the band.
 * Blue segments show exactly where teachers sit/stand vs students
 * (a centred block in every teacher row, students at the sides).
 * Back (tallest) row at the top.
 */
export function StageSnapshot({
  layout,
  pinnedRows,
  onRowTap,
}: {
  layout: StageLayout;
  /** Rows pinned at an on-the-day count (shown with a pin marker). */
  pinnedRows?: number[];
  /** Makes bands tappable (used for pinning a row's actual count). */
  onRowTap?: (rowNumber: number) => void;
}) {
  const rows = useMemo(
    () => [...layout.seatRows].sort((a, b) => b.rowNumber - a.rowNumber),
    [layout],
  );
  const pinned = new Set(pinnedRows ?? []);
  const maxSize = Math.max(1, ...rows.map((r) => r.seats.length));
  const zoneByRow = new Map(
    layout.rowSlices.map((s) => [s.rowNumber, s.groupId]),
  );
  const descriptorByZone = new Map(
    layout.groups.map((g) => [g.id, g.descriptor]),
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
        const extraCount = row.seats.filter((s) => s.occupant.extra).length;
        const official = size - extraCount;
        const studentCount = official - teacherCount;
        const segments = buildSegments(row.seats, zone);
        const mostlyTeachers = teacherCount > size / 2;
        const darkText = mostlyTeachers || zoneIsDark(zone);
        // Mixed rows spell out the split so the count is never mistaken
        // for "37 teachers": e.g. "30T + 7S". Extras show as "+1".
        const base =
          teacherCount > 0
            ? studentCount > 0
              ? `${teacherCount}T + ${studentCount}S`
              : `${teacherCount}T`
            : `${official}`;
        const centreLabel = extraCount > 0 ? `${base} +${extraCount}` : base;
        const isPinned = pinned.has(row.rowNumber);
        return (
          <div key={row.rowNumber} className="flex justify-center">
            <div
              className={`relative h-11 min-w-0 overflow-hidden rounded-xl ${
                onRowTap ? "cursor-pointer active:opacity-80" : ""
              } ${isPinned ? "ring-2 ring-slate-900" : ""}`}
              style={{ width: `${Math.max(42, (size / maxSize) * 100)}%` }}
              onClick={onRowTap ? () => onRowTap(row.rowNumber) : undefined}
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
                  {isPinned && "📌 "}Row {row.rowNumber}
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
                  {zone
                    ? (descriptorByZone.get(zone) ?? zone)
                    : teacherCount > 0
                      ? "Teachers"
                      : "—"}
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
          <span className="inline-block h-3 w-5 rounded bg-blue-900" />
          VIPs
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded bg-blue-500" />
          Teachers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded bg-slate-400" />
          Students (darker = taller)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded bg-amber-500" />
          Extra — stands at the side
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
    const kind: BandSegment["kind"] = seat.occupant.extra
      ? "extra"
      : seat.occupant.kind;
    const color =
      kind === "extra"
        ? "#f59e0b"
        : kind === "teacher"
          ? seat.occupant.role === "vip"
            ? "#1e3a8a"
            : "#3b82f6"
          : zoneShade(zone);
    const last = segments[segments.length - 1];
    if (last && last.kind === kind && last.color === color) {
      last.count += 1;
    } else {
      segments.push({ kind, count: 1, color });
    }
  }
  return segments;
}
