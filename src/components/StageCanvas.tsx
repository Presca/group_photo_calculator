"use client";

import { useMemo, useRef, useState } from "react";
import type { Seat, SeatRef, SeatRow } from "@/lib/engine";

interface SeatPoint {
  seat: Seat;
  x: number;
  y: number;
  rowKind: "seated" | "standing";
}

interface StageCanvasProps {
  seatRows: SeatRow[];
  onSwap?: (a: SeatRef, b: SeatRef) => void;
  interactive?: boolean;
}

const SPAN = Math.PI * 0.5; // total arc angle for the widest row
const BASE_RADIUS = 320;
const ROW_GAP = 56;

/**
 * Top-down stage view. Rows are concentric arcs around the camera
 * position; each seat is a circle. Blue = teachers, grey = students
 * (darker grey = taller zone). Tap a seat for details, drag one seat
 * onto another to swap them.
 */
export function StageCanvas({
  seatRows,
  onSwap,
  interactive = true,
}: StageCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
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
  const { points, arcs, viewBox, seatRadius, cameraY } = geometry;

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
    if (best && bestDist <= (seatRadius * 3) ** 2) return best;
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
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full select-none"
        style={{ touchAction: interactive ? "none" : "auto" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setHovered(null)}
      >
        {/* Row arcs */}
        {arcs.map((arc) => (
          <g key={arc.rowNumber}>
            <path
              d={arc.path}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={seatRadius * 2.4}
              strokeLinecap="round"
            />
            <text
              x={arc.labelX}
              y={arc.labelY}
              textAnchor="end"
              className="fill-slate-500"
              fontSize={seatRadius * 1.6}
              fontWeight={700}
            >
              {arc.rowNumber === 0 ? "Seated" : `Row ${arc.rowNumber}`}
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
              r={seatRadius}
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
              style={{ cursor: interactive ? "grab" : "default" }}
              onPointerDown={handlePointerDown(p)}
              onMouseEnter={(e) =>
                setHovered({ seat: p.seat, clientX: e.clientX, clientY: e.clientY })
              }
              onMouseMove={(e) =>
                setHovered({ seat: p.seat, clientX: e.clientX, clientY: e.clientY })
              }
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* Drag ghost */}
        {drag && drag.moved && (
          <circle
            cx={drag.x}
            cy={drag.y}
            r={seatRadius * 1.2}
            fill="#2563eb"
            opacity={0.5}
          />
        )}

        {/* Camera marker */}
        <g>
          <rect
            x={-34}
            y={cameraY - 14}
            width={68}
            height={36}
            rx={8}
            fill="#0f172a"
          />
          <circle cx={0} cy={cameraY + 4} r={10} fill="#38bdf8" />
          <text
            x={0}
            y={cameraY + 44}
            textAnchor="middle"
            className="fill-slate-500"
            fontSize={16}
            fontWeight={700}
          >
            CAMERA
          </text>
        </g>
      </svg>

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
          <span className="text-lg font-bold">
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

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600">
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full bg-blue-600" />
          Teachers
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border border-slate-500 bg-slate-400" />
          Students (darker = taller)
        </span>
        {interactive && <span>Tap a seat for details · drag to swap</span>}
      </div>
    </div>
  );
}

function seatFill(seat: Seat): string {
  if (seat.occupant.kind === "teacher") {
    return seat.occupant.role === "principal" ? "#1d4ed8" : "#3b82f6";
  }
  // Shade students by height zone: taller (higher number) = darker.
  const groupId = seat.occupant.groupId;
  if (!groupId) return "#cbd5e1";
  const n = Number(groupId.replace("S", ""));
  if (!Number.isFinite(n)) return "#cbd5e1";
  const shades = [
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
  return shades[Math.min(shades.length - 1, Math.max(0, n - 1))];
}

function seatDescription(seat: Seat): string {
  const where =
    seat.rowNumber === 0 ? "Seated row" : `Row ${seat.rowNumber}`;
  if (seat.occupant.kind === "teacher") {
    return `${where} · Seat ${seat.seatNumber} · ${seat.occupant.label}`;
  }
  return `${where} · Seat ${seat.seatNumber} · Height group ${
    seat.occupant.groupId ?? "—"
  }`;
}

function buildGeometry(seatRows: SeatRow[]) {
  const maxSeats = Math.max(1, ...seatRows.map((r) => r.seats.length));
  const anglePerSeat = SPAN / maxSeats;

  const rows = [...seatRows].sort((a, b) => a.rowNumber - b.rowNumber);
  const seatRadius = Math.max(
    7,
    Math.min(16, BASE_RADIUS * anglePerSeat * 0.42),
  );

  const points: SeatPoint[] = [];
  const arcs: {
    rowNumber: number;
    path: string;
    labelX: number;
    labelY: number;
  }[] = [];

  rows.forEach((row, idx) => {
    const radius = BASE_RADIUS + idx * ROW_GAP;
    const n = row.seats.length;
    const total = anglePerSeat * n;
    const start = -Math.PI / 2 - total / 2 + anglePerSeat / 2;

    row.seats.forEach((seat, i) => {
      // Angle increases left → right as seen from the camera.
      const theta = start + i * anglePerSeat;
      points.push({
        seat,
        x: radius * Math.cos(theta),
        y: radius * Math.sin(theta),
        rowKind: row.kind,
      });
    });

    const a0 = start - anglePerSeat / 2;
    const a1 = start + total - anglePerSeat / 2;
    const x0 = radius * Math.cos(a0);
    const y0 = radius * Math.sin(a0);
    const x1 = radius * Math.cos(a1);
    const y1 = radius * Math.sin(a1);
    arcs.push({
      rowNumber: row.rowNumber,
      path: `M ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1}`,
      labelX: x0 - seatRadius * 1.8,
      labelY: y0,
    });
  });

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = seatRadius * 2 + 70;
  // The camera marker sits between the geometric focal point and the
  // front row so the diagram stays compact.
  const cameraY = -BASE_RADIUS + 150;
  const minX = Math.min(...xs, -120) - pad;
  const maxX = Math.max(...xs, 120) + pad;
  const minY = Math.min(...ys, cameraY) - pad;
  const maxY = Math.max(...ys, cameraY + 60) + pad;

  return {
    points,
    arcs,
    seatRadius,
    cameraY,
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
  };
}
