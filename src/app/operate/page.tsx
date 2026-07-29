"use client";

import Link from "next/link";
import { useState } from "react";
import { BigButton, EmptyState } from "@/components/ui";
import { useSession } from "@/store/SessionContext";

/**
 * Operation Mode: full-screen, high-contrast steps for use outdoors.
 * Helpers just follow the screen — no verbal instructions needed.
 */
export default function OperatePage() {
  const { state, layout, setRowOverride } = useSession();
  const [index, setIndex] = useState(0);

  if (!state.hydrated) return null;

  if (!state.generated || layout.steps.length === 0) {
    return (
      <EmptyState
        title="Nothing to run yet"
        detail="Generate a layout first, then run Operation Mode on the day."
        action={
          <Link href="/">
            <BigButton>Go to Setup</BigButton>
          </Link>
        }
      />
    );
  }

  const clamped = Math.min(index, layout.steps.length - 1);
  const step = layout.steps[clamped];
  const next =
    clamped + 1 < layout.steps.length ? layout.steps[clamped + 1] : null;

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col md:min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between text-base font-bold text-slate-500 sm:text-lg">
        <span>
          Step {clamped + 1} of {layout.steps.length}
        </span>
        {step.queueLetter && <span>Queue {step.queueLetter}</span>}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-white py-8 text-center shadow-sm border border-slate-200 my-3 sm:my-4 sm:py-10">
        <div className="text-xl font-extrabold uppercase tracking-[0.3em] text-slate-400 sm:text-2xl">
          {step.heading}
        </div>
        <div
          className={`my-4 px-2 font-black leading-none tracking-tight ${
            step.primary.length <= 8
              ? "text-6xl sm:text-8xl lg:text-[10rem]"
              : "text-4xl sm:text-6xl lg:text-8xl"
          } ${step.kind === "call" ? "text-blue-700" : "text-slate-900"}`}
        >
          {step.primary}
        </div>
        <div className="max-w-2xl px-4 text-2xl font-extrabold text-slate-700 sm:px-6 sm:text-3xl">
          {step.detail}
        </div>
        {step.rowNumber !== undefined && (
          <RowConfirm
            rowNumber={step.rowNumber}
            size={
              layout.rowsResult.rows.find(
                (r) => r.rowNumber === step.rowNumber,
              )?.size ?? 0
            }
            pinned={state.rowOverrides[step.rowNumber] !== undefined}
            onAdjust={(delta, current) =>
              setRowOverride(step.rowNumber!, current + delta)
            }
            onUnpin={() => setRowOverride(step.rowNumber!, null)}
          />
        )}
        {next && (
          <div className="mt-8 text-xl font-bold text-slate-400">
            Next: {next.primary}
            {next.kind === "call" && next.detail ? ` — ${next.detail}` : ""}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <BigButton
          variant="secondary"
          className="min-h-24 text-2xl"
          disabled={clamped === 0}
          onClick={() => setIndex(Math.max(0, clamped - 1))}
        >
          ← Back
        </BigButton>
        {next ? (
          <BigButton
            className="min-h-24 text-3xl"
            onClick={() => setIndex(clamped + 1)}
          >
            Next →
          </BigButton>
        ) : (
          <BigButton
            className="min-h-24 text-3xl"
            variant="secondary"
            onClick={() => setIndex(0)}
          >
            Restart
          </BigButton>
        )}
      </div>
    </div>
  );
}

/**
 * Live count confirmation: when a row takes more or fewer people than
 * planned, one tap pins it at the actual number and every remaining
 * queue rebalances instantly. Rows already filled never move.
 */
function RowConfirm({
  rowNumber,
  size,
  pinned,
  onAdjust,
  onUnpin,
}: {
  rowNumber: number;
  size: number;
  pinned: boolean;
  onAdjust: (delta: number, current: number) => void;
  onUnpin: () => void;
}) {
  return (
    <div className="mt-8 w-full max-w-md px-4">
      <div className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
        Row {rowNumber} actual count{pinned && " · pinned"}
      </div>
      <div className="flex items-stretch justify-center gap-2">
        <button
          aria-label={`Row ${rowNumber} took two fewer`}
          className="min-h-14 flex-1 rounded-2xl border-2 border-slate-300 text-xl font-extrabold text-slate-700 active:bg-slate-100"
          onClick={() => onAdjust(-2, size)}
        >
          −2
        </button>
        <button
          aria-label={`Row ${rowNumber} took one fewer`}
          className="min-h-14 flex-1 rounded-2xl border-2 border-slate-300 text-xl font-extrabold text-slate-700 active:bg-slate-100"
          onClick={() => onAdjust(-1, size)}
        >
          −1
        </button>
        <div
          className={`flex min-h-14 flex-1 items-center justify-center rounded-2xl text-2xl font-black tabular-nums ${
            pinned ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900"
          }`}
        >
          {size}
        </div>
        <button
          aria-label={`Row ${rowNumber} took one more`}
          className="min-h-14 flex-1 rounded-2xl border-2 border-slate-300 text-xl font-extrabold text-slate-700 active:bg-slate-100"
          onClick={() => onAdjust(1, size)}
        >
          +1
        </button>
        <button
          aria-label={`Row ${rowNumber} took two more`}
          className="min-h-14 flex-1 rounded-2xl border-2 border-slate-300 text-xl font-extrabold text-slate-700 active:bg-slate-100"
          onClick={() => onAdjust(2, size)}
        >
          +2
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm font-semibold text-slate-400">
        <span>Later queues rebalance automatically</span>
        {pinned && (
          <button className="font-bold text-blue-700" onClick={onUnpin}>
            Unpin
          </button>
        )}
      </div>
    </div>
  );
}
