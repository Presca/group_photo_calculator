/**
 * Core domain types for the Group Photo Planner calculation engine.
 *
 * The engine is intentionally pure and UI-free so it can be unit tested,
 * reused server-side, and extended with future AI features (row
 * optimisation, face visibility scoring, attendance import, etc.)
 * without touching React code.
 */

export type TeacherLayout = "front-seated" | "front-standing" | "mixed";
export type PhotoMode = "single" | "stitch";
export type HeightGroupCount = 5 | 7 | 9;
export type Parity = "odd" | "even";

export interface SessionConfig {
  schoolName: string;
  totalStudents: number;
  totalTeachers: number;
  /** Usable stage width in metres. */
  stageWidthM: number;
  /** Average shoulder width per person in metres (editable default 0.45). */
  shoulderWidthM: number;
  /** Number of standing rows / platform levels available. */
  standingRows: number;
  teacherLayout: TeacherLayout;
  photoMode: PhotoMode;
  heightGroupCount: HeightGroupCount;
  /** Rows covered by each photo when stitching. */
  stitchRowsPerPhoto: number;
  /** Rows shared between adjacent stitched photos. */
  stitchOverlapRows: number;
}

export interface RowPlan {
  /** 1 = front row, higher numbers are further back. */
  rowNumber: number;
  size: number;
  targetParity: Parity;
  actualParity: Parity;
  /** True when totals made the target parity impossible for this row. */
  parityRelaxed: boolean;
}

export interface RowCalculationResult {
  /** False when the requested people cannot fit on the stage. */
  ok: boolean;
  /** Front row first (rowNumber ascending). */
  rows: RowPlan[];
  maxPerRow: number;
  capacity: number;
  /** How many people the plan actually places (capped at capacity). */
  placed: number;
  /** People that could not be placed (0 when ok). */
  overflow: number;
  warnings: string[];
  suggestions: string[];
}

export interface HeightGroup {
  /** e.g. "S9". Higher number = taller. */
  id: string;
  /** 0 = tallest group. */
  indexFromTallest: number;
  /** Human descriptor: Tallest / Tall / Medium / Short / Shortest. */
  descriptor: string;
  count: number;
}

export interface GroupRowSpan {
  groupId: string;
  /** Back-most row this group occupies (highest number). */
  fromRow: number;
  /** Front-most row this group occupies (lowest number). */
  toRow: number;
  /** Students of this group actually placed in rows. */
  placed: number;
}

export interface RowGroupSlice {
  rowNumber: number;
  groupId: string;
  count: number;
}

export type TeacherRole = "principal" | "senior" | "teacher";

export interface TeacherPlan {
  id: string;
  label: string;
  role: TeacherRole;
  placement: "seated" | "standing";
  /** 0 = seated row in front of row 1; otherwise the standing row number. */
  rowNumber: number;
  /** Seat number within the row (1 = stage left). */
  seatNumber: number;
}

export interface SeatOccupant {
  kind: "student" | "teacher";
  label: string;
  groupId?: string;
  teacherId?: string;
  role?: TeacherRole;
}

export interface Seat {
  rowNumber: number;
  seatNumber: number;
  occupant: SeatOccupant;
}

export interface SeatRow {
  rowNumber: number;
  kind: "seated" | "standing";
  seats: Seat[];
}

export interface QueuePlan {
  /** "A", "B", ... */
  letter: string;
  groupId: string;
  descriptor: string;
  fromRow: number;
  toRow: number;
  count: number;
}

export interface StitchPhoto {
  /** "Photo A", "Photo B", ... */
  label: string;
  fromRow: number;
  toRow: number;
}

export interface OperationStep {
  kind: "call" | "direction";
  /** Small heading, e.g. "NOW CALL". */
  heading: string;
  /** The big central text, e.g. "S9". */
  primary: string;
  /** Instruction, e.g. "Move to Row 8". */
  detail: string;
  queueLetter?: string;
}

export interface RowLabel {
  rowNumber: number;
  descriptor: string;
  groupIds: string[];
  size: number;
}

export interface StageLayout {
  config: SessionConfig;
  maxPerRow: number;
  rowsResult: RowCalculationResult;
  groups: HeightGroup[];
  groupSpans: GroupRowSpan[];
  rowSlices: RowGroupSlice[];
  teachers: TeacherPlan[];
  seatedTeacherCount: number;
  standingTeacherCount: number;
  /** Front (seated) row first, then standing rows front to back. */
  seatRows: SeatRow[];
  queues: QueuePlan[];
  rowLabels: RowLabel[];
  stitch: StitchPhoto[] | null;
  steps: OperationStep[];
  commands: string[];
  warnings: string[];
  suggestions: string[];
}

export interface SeatRef {
  rowNumber: number;
  seatNumber: number;
}

export interface SeatSwap {
  a: SeatRef;
  b: SeatRef;
}
