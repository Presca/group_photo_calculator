"use client";

import Link from "next/link";
import { StageCanvas } from "@/components/StageCanvas";
import {
  HeightGroupsPanel,
  LiveAdjustBar,
  RowBreakdown,
  StitchPanel,
  TeacherPanel,
  WarningsBanner,
} from "@/components/planPanels";
import { BigButton, EmptyState, SectionCard, StatChip } from "@/components/ui";
import { formatRowRange } from "@/lib/engine";
import { useSession } from "@/store/SessionContext";

export default function PlanPage() {
  const { state, layout, seatRows, addSwap, clearSwaps } = useSession();

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
      <div className="grid gap-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              {state.config.schoolName || "Unnamed session"}
            </h1>
            <p className="text-slate-500 font-semibold">
              {state.config.photoMode === "stitch"
                ? "Multi-shot stitching"
                : "Single photo"}{" "}
              · {state.config.stageWidthM} m stage
            </p>
          </div>
          <div className="grid grid-flow-col gap-3">
            <StatChip label="Students" value={state.config.totalStudents} />
            <StatChip label="Teachers" value={state.config.totalTeachers} />
            <StatChip
              label="Rows"
              value={layout.rowsResult.rows.length}
              tone={layout.rowsResult.ok ? "good" : "bad"}
            />
          </div>
        </div>

        <WarningsBanner layout={layout} />

        <SectionCard
          title="Stage Layout"
          action={
            state.swaps.length > 0 ? (
              <BigButton variant="ghost" onClick={clearSwaps}>
                Undo all swaps ({state.swaps.length})
              </BigButton>
            ) : undefined
          }
        >
          <StageCanvas
            seatRows={seatRows}
            onSwap={(a, b) => addSwap({ a, b })}
          />
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <RowBreakdown layout={layout} />
          <div className="grid content-start gap-6">
            <HeightGroupsPanel layout={layout} />
            <TeacherPanel layout={layout} />
          </div>
        </div>

        <StitchPanel layout={layout} />

        <SectionCard title="Queues (one per row)">
          <p className="mb-3 text-sm font-semibold text-slate-500 sm:text-base">
            Each queue holds exactly its row&apos;s student count — when a queue
            empties, its row is full. If they don&apos;t match, a count is off.
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
                    {queue.groupId} · {queue.descriptor}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
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
      </div>
      <LiveAdjustBar />
    </>
  );
}
