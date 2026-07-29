"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/store/SessionContext";
import { maxPeoplePerRow } from "@/lib/engine";
import {
  BigButton,
  FieldLabel,
  NumberStepper,
  SectionCard,
  SegmentedControl,
  StatChip,
} from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const { state, layout, patchConfig, markGenerated, reset } = useSession();
  const { config } = state;

  if (!state.hydrated) return null;

  const maxPerRow = maxPeoplePerRow(config.stageWidthM, config.shoulderWidthM);
  // Teachers (VIPs included) occupy row seats too, so everyone counts
  // towards stage capacity. Rows are computed automatically.
  const totalPeople =
    config.totalStudents + config.totalTeachers + config.vipTeachers;
  const rowsNeeded = maxPerRow > 0 ? Math.ceil(totalPeople / maxPerRow) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <SectionCard title="Session Setup">
        <div className="grid gap-5">
          <label className="block">
            <FieldLabel>School Name</FieldLabel>
            <input
              type="text"
              className="min-h-14 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-xl font-semibold focus:border-blue-500 focus:outline-none"
              placeholder="e.g. Northside High School"
              value={config.schoolName}
              onChange={(e) => patchConfig({ schoolName: e.target.value })}
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <NumberStepper
              label="Total Students"
              value={config.totalStudents}
              min={0}
              max={2000}
              onChange={(v) => patchConfig({ totalStudents: Math.round(v) })}
            />
            <NumberStepper
              label="Teachers"
              value={config.totalTeachers}
              min={0}
              max={300}
              onChange={(v) => patchConfig({ totalTeachers: Math.round(v) })}
            />
            <NumberStepper
              label="VIP Teachers"
              value={config.vipTeachers}
              min={0}
              max={50}
              onChange={(v) => patchConfig({ vipTeachers: Math.round(v) })}
            />
          </div>
          <p className="-mt-2 text-sm font-semibold text-slate-500">
            VIP teachers take precedence: centre of the front row, called
            first.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <NumberStepper
              label="Stage Width"
              value={config.stageWidthM}
              min={1}
              max={100}
              step={0.5}
              suffix="m"
              onChange={(v) => patchConfig({ stageWidthM: v })}
            />
            <NumberStepper
              label="Shoulder Width"
              value={config.shoulderWidthM}
              min={0.2}
              max={1}
              step={0.05}
              suffix="m"
              onChange={(v) => patchConfig({ shoulderWidthM: v })}
            />
          </div>

          <SegmentedControl
            label="Front row count"
            value={config.firstRowParity}
            options={[
              { value: "odd", label: "Odd" },
              { value: "even", label: "Even" },
            ]}
            onChange={(v) => patchConfig({ firstRowParity: v })}
          />
          <p className="-mt-2 text-sm font-semibold text-slate-500">
            Rows alternate from the front: odd → even → odd… or even → odd →
            even…
          </p>

          <SegmentedControl
            label="Photo Mode"
            value={config.photoMode}
            options={[
              { value: "single", label: "Single photo" },
              { value: "stitch", label: "Multi-shot stitching" },
            ]}
            onChange={(v) => patchConfig({ photoMode: v })}
          />

          <div className="mt-2 grid gap-3 sm:grid-cols-[2fr_1fr]">
            <BigButton
              onClick={() => {
                markGenerated();
                router.push("/plan");
              }}
            >
              Generate Layout
            </BigButton>
            <BigButton
              variant="danger"
              onClick={() => {
                if (window.confirm("Reset the whole session?")) reset();
              }}
            >
              Reset
            </BigButton>
          </div>
        </div>
      </SectionCard>

      <div className="grid content-start gap-6">
        <SectionCard title="Stage Width Calculator">
          <div className="grid grid-cols-2 gap-3">
            <StatChip label="Max per row" value={maxPerRow} />
            <StatChip label="Total people" value={totalPeople} />
            <StatChip
              label="Rows (auto)"
              value={rowsNeeded}
              tone={maxPerRow > 0 ? "good" : "bad"}
            />
            <StatChip
              label="Photos"
              value={layout.stitch ? layout.stitch.length : 1}
            />
          </div>

          {maxPerRow <= 0 ? (
            <p className="mt-4 text-lg font-bold text-red-700">
              Check the stage and shoulder widths — nobody fits in a row.
            </p>
          ) : (
            <p className="mt-4 text-lg font-semibold text-emerald-700">
              ✓ Rows are calculated automatically — {rowsNeeded} rows for this
              group.
            </p>
          )}
        </SectionCard>

        <SectionCard title="At a glance">
          <ul className="space-y-2 text-lg text-slate-700">
            <li>
              <strong>{layout.rowsResult.rows.length}</strong> rows planned
            </li>
            <li>
              Teachers:{" "}
              {layout.teacherRows.length === 0
                ? "none"
                : layout.teacherRows
                    .map((r, i) =>
                      i === 0
                        ? `${r.count} in the front row`
                        : `${r.count} between students in Row ${r.rowNumber}`,
                    )
                    .join(", ")}
            </li>
            <li>
              <strong>{layout.groups.length}</strong> height zones,{" "}
              <strong>{layout.queues.length}</strong> queues
            </li>
            {layout.stitch && (
              <li>
                <strong>{layout.stitch.length}</strong> stitched photos planned
              </li>
            )}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
