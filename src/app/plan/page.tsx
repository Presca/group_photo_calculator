"use client";

import Link from "next/link";
import { useState } from "react";
import { StageSnapshot } from "@/components/StageSnapshot";
import {
  LiveAdjustBar,
  StitchPanel,
  TeacherPanel,
  WarningsBanner,
} from "@/components/planPanels";
import { BigButton, EmptyState, SectionCard, StatChip } from "@/components/ui";
import { formatRowRange } from "@/lib/engine";
import { useSession } from "@/store/SessionContext";

export default function PlanPage() {
  const { state, layout, setRowOverride, clearRowOverrides } = useSession();
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  if (!state.hydrated) return null;

  if (!state.generated) {
    return (
      <EmptyState
        title="No layout yet"
        detail="Set up the session first, then generate the arrangement plan."
        action={
          <Link href="/">
            <BigButton>Go to Setup</BigButton>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 pb-20 sm:gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {state.config.schoolName || "Unnamed session"}
          </h1>
          <p className="text-sm font-semibold text-slate-500 sm:text-base">
            {state.config.photoMode === "stitch"
              ? "Multi-shot stitching"
              : "Single photo"}{" "}
            · {state.config.stageWidthM} m stage ·{" "}
            {layout.rowsResult.rows.length} rows
          </p>
        </div>

        <WarningsBanner layout={layout} />

        <SectionCard
          title="Stage Layout"
          action={
            Object.keys(state.rowOverrides).length > 0 ? (
              <button
                className="min-h-10 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-100"
                onClick={() => {
                  clearRowOverrides();
                  setSelectedRow(null);
                }}
              >
                Clear pins ({Object.keys(state.rowOverrides).length})
              </button>
            ) : undefined
          }
        >
          <StageSnapshot
            layout={layout}
            pinnedRows={Object.keys(state.rowOverrides).map(Number)}
            onRowTap={(rowNumber) =>
              setSelectedRow((prev) => (prev === rowNumber ? null : rowNumber))
            }
          />
          {selectedRow !== null &&
            (() => {
              const row = layout.rowsResult.rows.find(
                (r) => r.rowNumber === selectedRow,
              );
              if (!row) return null;
              const isPinned = state.rowOverrides[selectedRow] !== undefined;
              return (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-white">
                  <span className="text-base font-bold">
                    Row {selectedRow} · {row.size} people
                    {isPinned && " · 📌 pinned"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label={`One fewer in row ${selectedRow}`}
                      className="min-h-12 w-12 rounded-xl bg-white/15 text-xl font-extrabold active:bg-white/30"
                      onClick={() =>
                        setRowOverride(selectedRow, row.size - 1)
                      }
                    >
                      −
                    </button>
                    <button
                      aria-label={`One more in row ${selectedRow}`}
                      className="min-h-12 w-12 rounded-xl bg-white/15 text-xl font-extrabold active:bg-white/30"
                      onClick={() =>
                        setRowOverride(selectedRow, row.size + 1)
                      }
                    >
                      +
                    </button>
                    {isPinned && (
                      <button
                        className="min-h-12 rounded-xl bg-white/15 px-3 font-bold active:bg-white/30"
                        onClick={() => setRowOverride(selectedRow, null)}
                      >
                        Unpin
                      </button>
                    )}
                    <button
                      className="min-h-12 rounded-xl px-2 font-bold text-white/70"
                      onClick={() => setSelectedRow(null)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })()}
          <p className="mt-2 text-xs font-semibold text-slate-400 sm:text-sm">
            Tap a row to pin its real count on the day — the other rows
            rebalance automatically.
          </p>
        </SectionCard>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatChip label="Students" value={state.config.totalStudents} />
          <StatChip
            label="Teachers"
            value={state.config.totalTeachers + state.config.vipTeachers}
          />
          <StatChip
            label="Max / row"
            value={layout.maxPerRow}
            tone={layout.rowsResult.ok ? "good" : "bad"}
          />
        </div>

        <SectionCard title="Queues">
          <p className="mb-3 text-sm font-semibold text-slate-500 sm:text-base">
            One queue per row, tallest first — fill left of centre outward,
            then right of centre outward. When a queue empties, its row is
            full.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {layout.queues.map((queue) => (
              <div
                key={queue.letter}
                className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl font-extrabold text-white">
                  {queue.letter}
                </span>
                <div>
                  <div className="font-extrabold">
                    {formatRowRange(queue.fromRow, queue.toRow)} ·{" "}
                    {queue.count} students
                  </div>
                  <div className="text-sm font-semibold text-slate-500">
                    {queue.descriptor}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
            <Link href="/print?only=queues">
              <BigButton variant="secondary">Print queue signs</BigButton>
            </Link>
            <Link href="/print?only=labels">
              <BigButton variant="secondary">Print row labels</BigButton>
            </Link>
            <Link href="/operate">
              <BigButton>Start Operation Mode</BigButton>
            </Link>
          </div>
        </SectionCard>

        <StitchPanel layout={layout} />
        <TeacherPanel layout={layout} />
      </div>
      <LiveAdjustBar />
    </>
  );
}
