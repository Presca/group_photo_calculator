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
  const { state, layout } = useSession();
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
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <div className="flex items-center justify-between text-lg font-bold text-slate-500">
        <span>
          Step {clamped + 1} of {layout.steps.length}
        </span>
        {step.queueLetter && <span>Queue {step.queueLetter}</span>}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-white py-10 text-center shadow-sm border border-slate-200 my-4">
        <div className="text-2xl font-extrabold uppercase tracking-[0.3em] text-slate-400">
          {step.heading}
        </div>
        <div
          className={`my-4 font-black leading-none tracking-tight ${
            step.primary.length <= 3 ? "text-[9rem] sm:text-[13rem]" : "text-6xl sm:text-8xl"
          } ${step.kind === "call" ? "text-blue-700" : "text-slate-900"}`}
        >
          {step.primary}
        </div>
        <div className="max-w-2xl px-6 text-3xl font-extrabold text-slate-700">
          {step.detail}
        </div>
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
