import { formatRowRange } from "./queuePlanner";
import type {
  GroupRowSpan,
  HeightGroup,
  OperationStep,
  TeacherRowSummary,
} from "./types";

export interface CommandContext {
  groups: HeightGroup[];
  spans: GroupRowSpan[];
  /** Rows containing teachers, front first. */
  teacherRows: TeacherRowSummary[];
  /** All teachers, VIPs included. */
  totalTeachers: number;
  /** VIP teachers — they take precedence in layout and sequence. */
  vipCount: number;
}

/** One-line description of where the teachers go. */
export function teacherPlacementSummary(ctx: CommandContext): string {
  if (ctx.totalTeachers <= 0 || ctx.teacherRows.length === 0) return "";
  const [front, ...overflow] = ctx.teacherRows;
  let summary =
    ctx.vipCount > 0
      ? `Front row (Row ${front.rowNumber}) — VIPs in the centre, teachers outward`
      : `Front row (Row ${front.rowNumber}) — most senior in the centre`;
  if (overflow.length > 0) {
    summary +=
      "; " +
      overflow
        .map((r) => `${r.count} to the centre of Row ${r.rowNumber}`)
        .join("; ");
  }
  return summary;
}

/**
 * Ordered steps for Operation Mode: teachers first, then one queue per
 * row block (tallest first), then the final tidy-up directions.
 */
export function buildOperationSteps(ctx: CommandContext): OperationStep[] {
  const spanByGroup = new Map(ctx.spans.map((s) => [s.groupId, s]));
  const steps: OperationStep[] = [];

  if (ctx.vipCount > 0 && ctx.teacherRows.length > 0) {
    steps.push({
      kind: "call",
      heading: "NOW CALL",
      primary: "VIPS",
      detail: `Centre of the front row — VIP 1 dead centre`,
    });
  }
  if (ctx.totalTeachers > 0 && ctx.teacherRows.length > 0) {
    steps.push({
      kind: "call",
      heading: "NOW CALL",
      primary: "TEACHERS",
      detail: teacherPlacementSummary(ctx),
    });
  }

  ctx.groups
    .filter((g) => g.count > 0)
    .forEach((group, i) => {
      const span = spanByGroup.get(group.id);
      const letter = String.fromCharCode(65 + i);
      steps.push({
        kind: "call",
        heading: "NOW CALL",
        primary: `QUEUE ${letter}`,
        detail: span
          ? `Height ${group.rank} (${group.descriptor}) — fill ${formatRowRange(span.fromRow, span.toRow)}, tallest leads`
          : `Height ${group.rank} (${group.descriptor}) — move to your row`,
        queueLetter: letter,
        rowNumber:
          span && span.fromRow === span.toRow ? span.fromRow : undefined,
      });
    });

  steps.push(
    {
      kind: "direction",
      heading: "EACH ROW",
      primary: "TAPER FROM CENTRE",
      detail: "Fill left of centre first, then right — tallest in the middle",
    },
    { kind: "direction", heading: "EVERYONE", primary: "MOVE CLOSER", detail: "Shoulder to shoulder" },
    { kind: "direction", heading: "EVERYONE", primary: "FREEZE", detail: "Hold your position" },
    { kind: "direction", heading: "EVERYONE", primary: "EYES ON CAMERA", detail: "Big smiles" },
  );
  return steps;
}

/**
 * Spoken commands for the Command Screen, shown one at a time.
 */
export function buildCommandScript(ctx: CommandContext): string[] {
  const spanByGroup = new Map(ctx.spans.map((s) => [s.groupId, s]));
  const commands: string[] = [];

  if (ctx.totalTeachers > 0 && ctx.teacherRows.length > 0) {
    const [front, ...overflow] = ctx.teacherRows;
    if (ctx.vipCount > 0) {
      commands.push("VIP teachers please take the centre of the front row.");
      commands.push("Teachers please fill the front row outward from the VIPs.");
    } else {
      commands.push(
        "Teachers please take the front row. Most senior in the centre.",
      );
    }
    for (const r of overflow) {
      commands.push(
        `Remaining ${r.count} teachers to the centre of Row ${r.rowNumber}.`,
      );
    }
    if (front.count > 0) {
      commands.push("Front row please be seated.");
    }
  }

  let queueIndex = 0;
  for (const group of ctx.groups) {
    if (group.count <= 0) continue;
    const letter = String.fromCharCode(65 + queueIndex);
    queueIndex += 1;
    const span = spanByGroup.get(group.id);
    if (span && span.fromRow > 0) {
      commands.push(
        `Queue ${letter}, fill ${formatRowRange(span.fromRow, span.toRow)}. Tallest leads.`,
      );
    }
  }

  commands.push(
    "Fill left of centre first, then right. Tallest in the middle.",
    "Move closer.",
    "Check your spacing.",
    "Freeze.",
    "Eyes on camera.",
    "Big smiles!",
  );
  return commands;
}
