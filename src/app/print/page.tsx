"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { StageSnapshot } from "@/components/StageSnapshot";
import { BigButton, EmptyState } from "@/components/ui";
import { formatRowRange, type StageLayout } from "@/lib/engine";
import { useSession } from "@/store/SessionContext";

const SECTIONS = [
  { key: "layout", label: "Layout Sheet" },
  { key: "teachers", label: "Teacher Guide" },
  { key: "queues", label: "Queue Guide" },
  { key: "labels", label: "Row Labels" },
  { key: "zones", label: "Height Zone Guide" },
  { key: "checklist", label: "Session Checklist" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export default function PrintPage() {
  return (
    <Suspense>
      <PrintPack />
    </Suspense>
  );
}

function PrintPack() {
  const { state, layout } = useSession();
  const params = useSearchParams();
  const [enabled, setEnabled] = useState<Record<SectionKey, boolean>>({
    layout: true,
    teachers: true,
    queues: true,
    labels: true,
    zones: true,
    checklist: true,
  });

  // /print?only=queues preselects a single section (quick links).
  useEffect(() => {
    const only = params.get("only") as SectionKey | null;
    if (only && SECTIONS.some((s) => s.key === only)) {
      setEnabled({
        layout: false,
        teachers: false,
        queues: false,
        labels: false,
        zones: false,
        checklist: false,
        [only]: true,
      });
    }
  }, [params]);

  if (!state.hydrated) return null;

  if (!state.generated) {
    return (
      <EmptyState
        title="Nothing to print yet"
        detail="Generate a layout first, then export the print pack."
        action={
          <Link href="/">
            <BigButton>Go to Setup</BigButton>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="no-print rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Print Pack</h1>
            <p className="font-semibold text-slate-500">
              Choose sections, then Export — use “Save as PDF” in the print
              dialog.
            </p>
          </div>
          <BigButton onClick={() => window.print()}>Export / Print PDF</BigButton>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              className={`min-h-12 rounded-xl border-2 px-4 font-bold ${
                enabled[s.key]
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
              onClick={() =>
                setEnabled((prev) => ({ ...prev, [s.key]: !prev[s.key] }))
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {enabled.layout && <LayoutSheet layout={layout} />}
      {enabled.teachers && <TeacherGuide layout={layout} />}
      {enabled.queues && <QueueGuide layout={layout} />}
      {enabled.labels && <RowLabels layout={layout} />}
      {enabled.zones && <ZoneGuide layout={layout} />}
      {enabled.checklist && <Checklist layout={layout} />}
    </div>
  );
}

function Sheet({
  title,
  layout,
  children,
}: {
  title: string;
  layout: StageLayout;
  children: React.ReactNode;
}) {
  return (
    <section className="print-sheet mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <header className="mb-6 flex items-baseline justify-between border-b-2 border-slate-900 pb-3">
        <h2 className="text-2xl font-black uppercase tracking-tight">{title}</h2>
        <span className="font-bold text-slate-500">
          {layout.config.schoolName || "Group photo session"}
        </span>
      </header>
      {children}
    </section>
  );
}

function LayoutSheet({ layout }: { layout: StageLayout }) {
  const rowsBackFirst = [...layout.rowsResult.rows].sort(
    (a, b) => b.rowNumber - a.rowNumber,
  );
  const descriptorByZone = new Map(
    layout.groups.map((g) => [g.id, g.descriptor]),
  );
  return (
    <Sheet title="Layout Sheet" layout={layout}>
      <StageSnapshot layout={layout} />
      <table className="mt-6 w-full text-left">
        <thead>
          <tr className="border-b-2 border-slate-300 text-sm font-bold uppercase text-slate-500">
            <th className="py-2">Row</th>
            <th className="py-2">People</th>
            <th className="py-2">Who</th>
          </tr>
        </thead>
        <tbody className="text-lg font-semibold">
          {rowsBackFirst.map((row) => (
            <tr key={row.rowNumber} className="border-b border-slate-200">
              <td className="py-2 font-extrabold">Row {row.rowNumber}</td>
              <td className="py-2 tabular-nums">
                {row.size}
                {layout.extras && layout.extras.rowNumber === row.rowNumber
                  ? ` +${layout.extras.count} extra`
                  : ""}
              </td>
              <td className="py-2">
                {[
                  ...layout.rowSlices
                    .filter((s) => s.rowNumber === row.rowNumber)
                    .map(
                      (s) =>
                        `${descriptorByZone.get(s.groupId) ?? s.groupId} (${s.count})`,
                    ),
                  ...layout.teacherRows
                    .filter((t) => t.rowNumber === row.rowNumber)
                    .map((t) => `${t.count} teachers`),
                ].join(", ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}

function TeacherGuide({ layout }: { layout: StageLayout }) {
  return (
    <Sheet title="Teacher Guide" layout={layout}>
      <p className="mb-4 text-lg font-semibold text-slate-600">
        Teachers take the front row: VIPs in the centre (VIP 1 dead centre),
        teachers outward. Overflow teachers go to the next row, spread evenly
        between the students.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {layout.teacherRows
          .map((r, i) => ({
            title:
              i === 0
                ? `Front row — Row ${r.rowNumber} (${r.count})`
                : `Between students — Row ${r.rowNumber} (${r.count})`,
            list: layout.teachers.filter((t) => t.rowNumber === r.rowNumber),
          }))
          .filter((g) => g.list.length > 0)
          .map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-lg font-extrabold">{g.title}</h3>
              <table className="w-full text-left font-semibold">
                <thead>
                  <tr className="border-b border-slate-300 text-sm uppercase text-slate-500">
                    <th className="py-1">Seat</th>
                    <th className="py-1">Who</th>
                  </tr>
                </thead>
                <tbody>
                  {[...g.list]
                    .sort((a, b) => a.seatNumber - b.seatNumber)
                    .map((t) => (
                      <tr key={t.id} className="border-b border-slate-100">
                        <td className="py-1 tabular-nums">{t.seatNumber}</td>
                        <td className="py-1">
                          {t.label}
                          {t.role === "vip" && " ★"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </Sheet>
  );
}

function QueueGuide({ layout }: { layout: StageLayout }) {
  return (
    <>
      {layout.queues.map((queue) => (
        <section
          key={queue.letter}
          className="print-sheet mx-auto flex w-full max-w-3xl flex-col items-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"
        >
          <div className="text-3xl font-black uppercase tracking-[0.2em] text-slate-400">
            Queue
          </div>
          <div className="text-[10rem] font-black leading-none text-blue-700">
            {queue.letter}
          </div>
          <div className="mt-6 text-7xl font-black">{queue.descriptor}</div>
          <div className="mt-8 rounded-2xl bg-slate-900 px-8 py-4 text-4xl font-black text-white">
            {formatRowRange(queue.fromRow, queue.toRow)}
          </div>
          <div className="mt-6 rounded-2xl bg-slate-100 px-6 py-3 text-2xl font-extrabold text-slate-700">
            Tallest first · fill LEFT of centre, then RIGHT
          </div>
          <div className="mt-4 text-xl font-bold text-slate-400">
            {queue.count} students ·{" "}
            {layout.config.schoolName || "Group photo session"}
          </div>
        </section>
      ))}
    </>
  );
}

function RowLabels({ layout }: { layout: StageLayout }) {
  return (
    <>
      {layout.rowLabels.map((label) => (
        <section
          key={label.rowNumber}
          className="print-sheet mx-auto flex w-full max-w-3xl flex-col items-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"
        >
          <div className="text-[9rem] font-black leading-none">
            ROW {label.rowNumber}
          </div>
          <div className="mt-6 text-6xl font-black text-blue-700">
            {label.descriptor}
          </div>
          <div className="mt-8 text-3xl font-extrabold text-slate-500">
            {label.size} people
          </div>
        </section>
      ))}
    </>
  );
}

function ZoneGuide({ layout }: { layout: StageLayout }) {
  return (
    <Sheet title="Height Zone Guide" layout={layout}>
      <p className="mb-4 text-lg font-semibold text-slate-600">
        Sort students by height into these zones before queueing. Tallest zone
        is called first.
      </p>
      <table className="w-full text-left text-lg font-semibold">
        <thead>
          <tr className="border-b-2 border-slate-300 text-sm font-bold uppercase text-slate-500">
            <th className="py-2">Queue</th>
            <th className="py-2">Height</th>
            <th className="py-2">Students</th>
            <th className="py-2">Rows</th>
          </tr>
        </thead>
        <tbody>
          {layout.queues.map((queue) => (
            <tr key={queue.groupId} className="border-b border-slate-200">
              <td className="py-2 font-extrabold text-blue-700">
                {queue.letter}
              </td>
              <td className="py-2 font-extrabold">{queue.descriptor}</td>
              <td className="py-2 tabular-nums">{queue.count}</td>
              <td className="py-2">
                {formatRowRange(queue.fromRow, queue.toRow)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}

const CHECKLIST = [
  "Measure the usable stage width and update Setup.",
  "Confirm final student and teacher counts (use Adjust Live for changes).",
  "Print and post the queue signs where students assemble.",
  "Tape the row labels to the stage edge / platform steps.",
  "Brief the helping teachers: follow the Operate screen.",
  "Sort students into height zones at the queue signs.",
  "Teachers to the front row first (principal centred); overflow teachers spread between students in the next row.",
  "Call zones from the Operate screen, tallest first.",
  "Each row: tallest leads, fill left of centre outward, then right of centre outward.",
  "Final checks: spacing, faces visible, eyes on camera.",
  "For stitched photos: shoot each group with the planned overlap rows.",
];

function Checklist({ layout }: { layout: StageLayout }) {
  return (
    <Sheet title="Session Checklist" layout={layout}>
      <ol className="space-y-3 text-xl font-semibold">
        {CHECKLIST.map((item, i) => (
          <li key={item} className="flex items-start gap-3">
            <span className="mt-0.5 inline-block h-7 w-7 shrink-0 rounded-md border-2 border-slate-400" />
            <span>
              {i + 1}. {item}
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
