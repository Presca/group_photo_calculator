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
  const standingTeachers =
    config.teacherLayout === "front-standing"
      ? config.totalTeachers
      : config.teacherLayout === "mixed"
        ? Math.floor(config.totalTeachers / 2)
        : 0;
  const standingPeople = config.totalStudents + standingTeachers;
  const capacity = maxPerRow * config.standingRows;
  const fits = standingPeople <= capacity;
  const rowsNeeded = maxPerRow > 0 ? Math.ceil(standingPeople / maxPerRow) : 0;

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
              label="Total Teachers"
              value={config.totalTeachers}
              min={0}
              max={300}
              onChange={(v) => patchConfig({ totalTeachers: Math.round(v) })}
            />
          </div>

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
            <NumberStepper
              label="Standing Rows"
              value={config.standingRows}
              min={1}
              max={12}
              onChange={(v) => patchConfig({ standingRows: Math.round(v) })}
            />
          </div>

          <SegmentedControl
            label="Teacher Layout"
            value={config.teacherLayout}
            options={[
              { value: "front-seated", label: "Front seated" },
              { value: "front-standing", label: "Front standing" },
              { value: "mixed", label: "Mixed" },
            ]}
            onChange={(v) => patchConfig({ teacherLayout: v })}
          />

          <SegmentedControl
            label="Photo Mode"
            value={config.photoMode}
            options={[
              { value: "single", label: "Single photo" },
              { value: "stitch", label: "Multi-shot stitching" },
            ]}
            onChange={(v) => patchConfig({ photoMode: v })}
          />

          <SegmentedControl
            label="Height Groups"
            value={String(config.heightGroupCount) as "5" | "7" | "9"}
            options={[
              { value: "5", label: "5 groups" },
              { value: "7", label: "7 groups" },
              { value: "9", label: "9 groups" },
            ]}
            onChange={(v) =>
              patchConfig({ heightGroupCount: Number(v) as 5 | 7 | 9 })
            }
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
            <StatChip
              label="Stage capacity"
              value={capacity}
              tone={fits ? "good" : "bad"}
            />
            <StatChip label="People standing" value={standingPeople} />
            <StatChip
              label="Rows needed"
              value={rowsNeeded}
              tone={rowsNeeded <= config.standingRows ? "good" : "warn"}
            />
          </div>

          {!fits && (
            <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
              <p className="text-lg font-bold text-amber-900">
                This group does not fit on the stage.
              </p>
              <p className="mt-1 text-amber-800">
                {standingPeople - capacity} people over capacity. Choose a fix:
              </p>
              <div className="mt-3 grid gap-2">
                <BigButton
                  variant="secondary"
                  onClick={() => patchConfig({ standingRows: rowsNeeded })}
                >
                  Use {rowsNeeded} rows instead
                </BigButton>
                {config.photoMode === "single" && (
                  <BigButton
                    variant="secondary"
                    onClick={() => patchConfig({ photoMode: "stitch" })}
                  >
                    Switch to stitched photos
                  </BigButton>
                )}
              </div>
            </div>
          )}
          {fits && (
            <p className="mt-4 text-lg font-semibold text-emerald-700">
              ✓ Everyone fits with the current stage settings.
            </p>
          )}
        </SectionCard>

        <SectionCard title="At a glance">
          <ul className="space-y-2 text-lg text-slate-700">
            <li>
              <strong>{layout.rowsResult.rows.length}</strong> standing rows
              planned
            </li>
            <li>
              <strong>{layout.seatedTeacherCount}</strong> teachers seated,{" "}
              <strong>{layout.standingTeacherCount}</strong> standing
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
