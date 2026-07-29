"use client";

import { useMemo, useRef, useState } from "react";
import type { Seat, SeatRef, SeatRow } from "@/lib/engine";

interface SeatPoint {
  seat: Seat;
  x: number;
  y: number;
}

interface StageCanvasProps {
  seatRows: SeatRow[];
  onSwap?: (a: SeatRef, b: SeatRef) => void;
  interactive?: boolean;
}

const SEAT_SPACING = 22;
const ROW_SPACING = 44;
const SEAT_R = 8.5;
const LABEL_W = 64;
const PAD = 14;

/**
 * Front view of the finished photograph: straight rows on risers, the
 * back (tallest) row at the top, the seated teacher row at the bottom —
 * exactly what the camera will see. Blue = teachers, grey = students
 * (darker grey = taller zone). Tap a seat for details, drag one seat
 * onto another to swap them.
 */
export function StageCanvas({
  seatRows,
  onSwap,
  interactive = true,
}: StageCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<SeatRef | null>(null);
  const [hovered, setHovered] = useState<{
    seat: Seat;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [drag, setDrag] = useState<{
    from: SeatRef;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);

  const geometry = useMemo(() => buildGeometry(seatRows), [seatRows]);
  const { points, bands, width, height } = geometry;

  const toSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  };

  const nearestSeat = (x: number, y: number): SeatPoint | null => {
    let best: SeatPoint | null = null;
    let bestDist = Infinity;
    for (const p of points) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best && bestDist <= (SEAT_R * 3) ** 2) return best;
    return null;
  };

  const handlePointerDown = (p: SeatPoint) => (e: React.PointerEvent) => {
    if (!interactive) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const { x, y } = toSvgCoords(e.clientX, e.clientY);
    setDrag({
      from: { rowNumber: p.seat.rowNumber, seatNumber: p.seat.seatNumber },
      x,
      y,
      moved: false,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const { x, y } = toSvgCoords(e.clientX, e.clientY);
    setDrag({ ...drag, x, y, moved: true });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const { x, y } = toSvgCoords(e.clientX, e.clientY);
    const target = nearestSeat(x, y);
    if (
      drag.moved &&
      target &&
      onSwap &&
      (target.seat.rowNumber !== drag.from.rowNumber ||
        target.seat.seatNumber !== drag.from.seatNumber)
    ) {
      onSwap(drag.from, {
        rowNumber: target.seat.rowNumber,
        seatNumber: target.seat.seatNumber,
      });
    } else if (!drag.moved) {
      setSelected(
        selected &&
          selected.rowNumber === drag.from.rowNumber &&
          selected.seatNumber === drag.from.seatNumber
          ? null
          : drag.from,
      );
    }
    setDrag(null);
  };

  const selectedSeat = selected
    ? points.find(
        (p) =>
          p.seat.rowNumber === selected.rowNumber &&
          p.seat.seatNumber === selected.seatNumber,
      )?.seat
    : undefined;

  return (
    <div className="relative">
      <div ref={scrollRef} className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className={interactive ? "mx-auto h-auto" : "h-auto w-full"}
          style={interactive ? { width, minWidth: Math.min(width, 640) } : undefined}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => setHovered(null)}
        >
          {/* Riser bands, one per row */}
          {bands.map((band) => (
            <g key={band.key}>
              <rect
                x={0}
                y={band.y - ROW_SPACING / 2}
                width={width}
                height={ROW_SPACING}
                fill={band.fill}
              />
              <text
                x={8}
                y={band.y + 4}
                className="fill-slate-500"
                fontSize={12}
                fontWeight={700}
              >
                {band.label}
              </text>
            </g>
          ))}

          {/* Seats */}
          {points.map((p) => {
            const isTeacher = p.seat.occupant.kind === "teacher";
            const isPrincipal = p.seat.occupant.role === "principal";
            const isDragSource =
              drag &&
              drag.from.rowNumber === p.seat.rowNumber &&
              drag.from.seatNumber === p.seat.seatNumber;
            const isSelected =
              selected &&
              selected.rowNumber === p.seat.rowNumber &&
              selected.seatNumber === p.seat.seatNumber;
            return (
              <circle
                key={`${p.seat.rowNumber}:${p.seat.seatNumber}`}
                cx={p.x}
                cy={p.y}
                r={SEAT_R}
                fill={seatFill(p.seat)}
                stroke={
                  isPrincipal
                    ? "#1e3a8a"
                    : isSelected
                      ? "#2563eb"
                      : isTeacher
                        ? "#1d4ed8"
                        : "#64748b"
                }
                strokeWidth={isSelected || isPrincipal ? 3 : 1}
                opacity={isDragSource ? 0.35 : 1}
                style={{
                  cursor: interactive ? "grab" : "default",
                  touchAction: interactive ? "none" : undefined,
                }}
                onPointerDown={handlePointerDown(p)}
                onMouseEnter={(e) =>
                  setHovered({
                    seat: p.seat,
                    clientX: e.clientX,
                    clientY: e.clientY,
                  })
                }
                onMouseMove={(e) =>
                  setHovered({
                    seat: p.seat,
                    clientX: e.clientX,
                    clientY: e.clientY,
                  })
                }
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}

          {/* Drag ghost */}
          {drag && drag.moved && (
            <circle cx={drag.x} cy={drag.y} r={SEAT_R * 1.3} fill="#2563eb" opacity={0.5} />
          )}

          {/* Camera side marker */}
          <text
            x={width / 2}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-400"
            fontSize={12}
            fontWeight={800}
            letterSpacing={3}
          >
            ▲ CAMERA THIS SIDE ▲
          </text>
        </svg>
      </div>

      {/* Hover tooltip (mouse devices) */}
      {hovered && !drag && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-lg"
          style={{ left: hovered.clientX + 14, top: hovered.clientY + 14 }}
        >
          {seatDescription(hovered.seat)}
        </div>
      )}

      {/* Selected seat panel (touch devices) */}
      {selectedSeat && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
          <span className="text-base font-bold sm:text-lg">
            {seatDescription(selectedSeat)}
          </span>
          <button
            className="rounded-lg bg-white/20 px-3 py-1 font-semibold"
            onClick={() => setSelected(null)}
          >
            Close
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600 sm:text-sm">
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full bg-blue-600" />
          Teachers
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border border-slate-500 bg-slate-400" />
          Students (darker = taller)
        </span>
        {interactive && <span>Tap for details · drag to swap · scroll sideways</span>}
      </div>
    </div>
  );
}

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

function seatFill(seat: Seat): string {
  if (seat.occupant.kind === "teacher") {
    return seat.occupant.role === "principal" ? "#1d4ed8" : "#3b82f6";
  }
  return zoneShade(seat.occupant.groupId);
}

function seatDescription(seat: Seat): string {
  const where = seat.rowNumber === 0 ? "Seated row" : `Row ${seat.rowNumber}`;
  if (seat.occupant.kind === "teacher") {
    return `${where} · Seat ${seat.seatNumber} · ${seat.occupant.label}`;
  }
  return `${where} · Seat ${seat.seatNumber} · Zone ${
    seat.occupant.groupId ?? "—"
  }`;
}

function buildGeometry(seatRows: SeatRow[]) {
  // Photo order: back row at the top, then forward, seated row last.
  const ordered = [
    ...seatRows
      .filter((r) => r.kind === "standing")
      .sort((a, b) => b.rowNumber - a.rowNumber),
    ...seatRows.filter((r) => r.kind === "seated"),
  ];

  const maxSeats = Math.max(1, ...ordered.map((r) => r.seats.length));
  const width = LABEL_W + maxSeats * SEAT_SPACING + PAD * 2;
  const height = PAD + ordered.length * ROW_SPACING + 28;

  const points: SeatPoint[] = [];
  const bands: { key: string; y: number; label: string; fill: string }[] = [];

  ordered.forEach((row, idx) => {
    const y = PAD + idx * ROW_SPACING + ROW_SPACING / 2;
    const n = row.seats.length;
    const xStart = LABEL_W + PAD + ((maxSeats - n) * SEAT_SPACING) / 2 + SEAT_SPACING / 2;

    bands.push({
      key: `band-${row.rowNumber}`,
      y,
      label: row.kind === "seated" ? "Seated" : `Row ${row.rowNumber}`,
      fill:
        row.kind === "seated" ? "#eff6ff" : idx % 2 === 0 ? "#f8fafc" : "#ffffff",
    });

    row.seats.forEach((seat, i) => {
      points.push({ seat, x: xStart + i * SEAT_SPACING, y });
    });
  });

  return { points, bands, width, height };
}
