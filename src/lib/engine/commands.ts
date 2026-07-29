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
  totalTeachers: number;
}

/** One-line description of where the teachers go. */
export function teacherPlacementSummary(ctx: CommandContext): string {
  if (ctx.totalTeachers <= 0 || ctx.teacherRows.length === 0) return "";
  const [front, ...overflow] = ctx.teacherRows;
  let summary = `Front row (Row ${front.rowNumber}) — principal in the centre`;
  if (overflow.length > 0) {
    summary +=
      "; " +
      overflow
        .map((r) => `${r.count} to Row ${r.rowNumber}, spread between students`)
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
          ? `${group.descriptor} — fill ${formatRowRange(span.fromRow, span.toRow)}, tallest leads`
          : `${group.descriptor} — move to your row`,
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
    commands.push(
      `Teachers please take the front row. Principal in the centre.`,
    );
    for (const r of overflow) {
      commands.push(
        `Remaining ${r.count} teachers to Row ${r.rowNumber}, spread out between the students.`,
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
