"use client";

import Link from "next/link";
import { StageSnapshot } from "@/components/StageSnapshot";
import {
  LiveAdjustBar,
  StitchPanel,
  TeacherPanel,
  WarningsBanner,
} from "@/components/planPanels";
import {
  BigButton,
  EmptyState,
  SectionCard,
  SegmentedControl,
  StatChip,
} from "@/components/ui";
import { formatRowRange } from "@/lib/engine";
import { useSession } from "@/store/SessionContext";

export default function PlanPage() {
  const { state, layout, patchConfig } = useSession();

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

        <SectionCard title="Stage Layout">
          <StageSnapshot layout={layout} />
        </SectionCard>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatChip label="Students" value={state.config.totalStudents} />
          <StatChip label="Teachers" value={state.config.totalTeachers} />
          <StatChip
            label="Max / row"
            value={layout.maxPerRow}
            tone={layout.rowsResult.ok ? "good" : "bad"}
          />
        </div>

        <SectionCard
          title="Queues"
          action={
            <SegmentedControl
              label=""
              value={String(layout.config.heightGroupCount) as "5" | "7" | "9"}
              options={[
                { value: "5", label: "5" },
                { value: "7", label: "7" },
                { value: "9", label: "9" },
              ]}
              onChange={(v) =>
                patchConfig({ heightGroupCount: Number(v) as 5 | 7 | 9 })
              }
            />
          }
        >
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
                    {queue.groupId} · {queue.descriptor}
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
