import { formatRowRange } from "./queuePlanner";
import type {
  GroupRowSpan,
  HeightGroup,
  OperationStep,
  TeacherLayout,
} from "./types";

export interface CommandContext {
  groups: HeightGroup[];
  spans: GroupRowSpan[];
  teacherLayout: TeacherLayout;
  teacherCount: number;
  standingRowNumber: number;
}

function teacherSteps(ctx: CommandContext): OperationStep[] {
  if (ctx.teacherCount <= 0) return [];
  switch (ctx.teacherLayout) {
    case "front-seated":
      return [
        {
          kind: "call",
          heading: "NOW CALL",
          primary: "TEACHERS",
          detail: "Take your seats in the front row",
        },
      ];
    case "front-standing":
      return [
        {
          kind: "call",
          heading: "NOW CALL",
          primary: "TEACHERS",
          detail: "Stand in the centre of Row 1",
        },
      ];
    case "mixed":
      return [
        {
          kind: "call",
          heading: "NOW CALL",
          primary: "TEACHERS",
          detail: `Seated teachers to the front row, standing teachers to the centre of Row ${ctx.standingRowNumber}`,
        },
      ];
  }
}

/**
 * Ordered steps for Operation Mode: teachers first, then height groups
 * tallest-to-shortest, then the final tidy-up directions.
 */
export function buildOperationSteps(ctx: CommandContext): OperationStep[] {
  const spanByGroup = new Map(ctx.spans.map((s) => [s.groupId, s]));
  const steps: OperationStep[] = [...teacherSteps(ctx)];

  ctx.groups
    .filter((g) => g.count > 0)
    .forEach((group, i) => {
      const span = spanByGroup.get(group.id);
      steps.push({
        kind: "call",
        heading: "NOW CALL",
        primary: group.id,
        detail: span
          ? `Move to ${formatRowRange(span.fromRow, span.toRow)}`
          : "Move to your row",
        queueLetter: String.fromCharCode(65 + i),
      });
    });

  steps.push(
    { kind: "direction", heading: "EVERYONE", primary: "FILL FROM CENTRE", detail: "Close the gaps towards the middle" },
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

  if (ctx.teacherCount > 0) {
    if (ctx.teacherLayout === "front-seated") {
      commands.push("Teachers please take your seats in the front row.");
      commands.push("Teachers please remain seated.");
    } else if (ctx.teacherLayout === "front-standing") {
      commands.push("Teachers please stand in the centre of Row 1.");
    } else {
      commands.push(
        `Seated teachers to the front row. Standing teachers to the centre of Row ${ctx.standingRowNumber}.`,
      );
      commands.push("Seated teachers please remain seated.");
    }
  }

  for (const group of ctx.groups) {
    if (group.count <= 0) continue;
    const span = spanByGroup.get(group.id);
    if (span && span.fromRow > 0) {
      commands.push(`${group.id} move to ${formatRowRange(span.fromRow, span.toRow)}.`);
    }
  }

  commands.push(
    "Fill from centre.",
    "Move closer.",
    "Check your spacing.",
    "Freeze.",
    "Eyes on camera.",
    "Big smiles!",
  );
  return commands;
}
