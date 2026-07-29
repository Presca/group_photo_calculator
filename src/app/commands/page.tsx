"use client";

import Link from "next/link";
import { useState } from "react";
import { BigButton, EmptyState } from "@/components/ui";
import { useSession } from "@/store/SessionContext";

/**
 * Command Screen: the exact phrases photographers read aloud, one at a
 * time, in the right order.
 */
export default function CommandsPage() {
  const { state, layout } = useSession();
  const [index, setIndex] = useState(0);

  if (!state.hydrated) return null;

  if (!state.generated || layout.commands.length === 0) {
    return (
      <EmptyState
        title="No commands yet"
        detail="Generate a layout first — the command script follows the arrangement."
        action={
          <Link href="/">
            <BigButton>Go to Setup</BigButton>
          </Link>
        }
      />
    );
  }

  const clamped = Math.min(index, layout.commands.length - 1);
  const command = layout.commands[clamped];

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col md:min-h-[calc(100vh-8rem)]">
      <div className="text-base font-bold text-slate-500 sm:text-lg">
        Command {clamped + 1} of {layout.commands.length}
      </div>

      <div className="my-3 flex flex-1 items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:my-4 sm:p-10">
        <p className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          “{command}”
        </p>
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
        {clamped + 1 < layout.commands.length ? (
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

      <div className="no-print mt-6 rounded-2xl bg-slate-50 p-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Full script
        </h2>
        <ol className="grid list-decimal gap-1 pl-5 font-semibold text-slate-600 sm:grid-cols-2">
          {layout.commands.map((c, i) => (
            <li
              key={c + i}
              className={i === clamped ? "text-blue-700" : undefined}
            >
              <button className="text-left" onClick={() => setIndex(i)}>
                {c}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
