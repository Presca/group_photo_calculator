"use client";

import { formatRowRange, type StageLayout } from "@/lib/engine";
import { useSession } from "@/store/SessionContext";
import { BigButton, SectionCard, NumberStepper } from "./ui";

export function WarningsBanner({ layout }: { layout: StageLayout }) {
  const { patchConfig } = useSession();
  if (layout.warnings.length === 0) return null;
  return (
    <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
      <h2 className="text-lg font-bold text-amber-900">Check these</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
        {layout.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {!layout.rowsResult.ok && layout.config.photoMode === "single" && (
        <div className="mt-4">
          <BigButton
            variant="secondary"
            onClick={() => patchConfig({ photoMode: "stitch" })}
          >
            Use stitched photos
          </BigButton>
        </div>
      )}
    </div>
  );
}

export function StitchPanel({ layout }: { layout: StageLayout }) {
  const { patchConfig } = useSession();
  if (layout.config.photoMode !== "stitch" || !layout.stitch) return null;
  return (
    <SectionCard title="Stitch Planner">
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <NumberStepper
          label="Rows per photo"
          value={layout.config.stitchRowsPerPhoto}
          min={1}
          max={6}
          onChange={(v) => patchConfig({ stitchRowsPerPhoto: Math.round(v) })}
        />
        <NumberStepper
          label="Overlap rows"
          value={layout.config.stitchOverlapRows}
          min={0}
          max={3}
          onChange={(v) => patchConfig({ stitchOverlapRows: Math.round(v) })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {layout.stitch.map((photo) => (
          <div
            key={photo.label}
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-center"
          >
            <div className="text-lg font-extrabold">{photo.label}</div>
            <div className="text-2xl font-extrabold text-blue-700">
              {formatRowRange(photo.fromRow, photo.toRow)}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function LiveAdjustBar() {
  const { state, adjustCount } = useSession();
  const clusters: {
    label: string;
    field: "totalStudents" | "totalTeachers";
    value: number;
  }[] = [
    { label: "Students", field: "totalStudents", value: state.config.totalStudents },
    { label: "Teachers", field: "totalTeachers", value: state.config.totalTeachers },
  ];
  return (
    // Sits just above the bottom tab bar on phones, at the very bottom
    // on wide screens where the nav is at the top.
    <div className="no-print sticky bottom-16 z-30 -mx-3 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4 sm:py-3 md:bottom-0">
      <div className="mx-auto flex max-w-6xl items-stretch gap-2 sm:gap-3">
        {clusters.map((cluster) => (
          <div
            key={cluster.field}
            className="flex flex-1 items-stretch overflow-hidden rounded-2xl border-2 border-slate-300 bg-white"
          >
            <button
              aria-label={`Remove one of ${cluster.label}`}
              className="min-h-14 w-14 shrink-0 text-2xl font-extrabold text-slate-700 active:bg-slate-100"
              onClick={() => adjustCount(cluster.field, -1)}
            >
              −
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center border-x-2 border-slate-200 px-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">
                {cluster.label}
              </span>
              <span className="text-xl font-extrabold tabular-nums leading-none sm:text-2xl">
                {cluster.value}
              </span>
            </div>
            <button
              aria-label={`Add one of ${cluster.label}`}
              className="min-h-14 w-14 shrink-0 text-2xl font-extrabold text-slate-700 active:bg-slate-100"
              onClick={() => adjustCount(cluster.field, 1)}
            >
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
