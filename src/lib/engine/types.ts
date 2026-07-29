/**
 * Core domain types for the Group Photo Planner calculation engine.
 *
 * The engine is intentionally pure and UI-free so it can be unit tested,
 * reused server-side, and extended with future AI features (row
 * optimisation, face visibility scoring, attendance import, etc.)
 * without touching React code.
 */

export type PhotoMode = "single" | "stitch";
export type Parity = "odd" | "even";

export interface SessionConfig {
  schoolName: string;
  totalStudents: number;
  /** Regular teachers. */
  totalTeachers: number;
  /**
   * VIP teachers (principal, guests of honour). They take precedence:
   * the centre-most front-row seats, and first in the call sequence.
   */
  vipTeachers: number;
  /** Usable stage width in metres. */
  stageWidthM: number;
  /** Average shoulder width per person in metres (editable default 0.45). */
  shoulderWidthM: number;
  /**
   * Whether the front row holds an odd or even count; subsequent rows
   * alternate from it.
   */
  firstRowParity: Parity;
  photoMode: PhotoMode;
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
  /**
   * People who don't fit the strict odd/even pattern arithmetic. They
   * stand at the sides of the 2nd/3rd-last row, marked distinctly.
   */
  extras: number;
  /** People that could not be placed (0 when ok). */
  overflow: number;
  warnings: string[];
  suggestions: string[];
}

export interface HeightGroup {
  /** e.g. "S9". Higher number = taller. */
  id: string;
  /** Height rank shown to people: 1 = shortest, N = tallest. */
  rank: number;
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

export type TeacherRole = "vip" | "teacher";

export interface TeacherPlan {
  id: string;
  label: string;
  role: TeacherRole;
  /** Row the teacher stands/sits in (1 = front row). */
  rowNumber: number;
  /** Seat number within the row (1 = stage left). */
  seatNumber: number;
}

/** How many teachers ended up in each row. */
export interface TeacherRowSummary {
  rowNumber: number;
  count: number;
}

export interface SeatOccupant {
  kind: "student" | "teacher";
  label: string;
  groupId?: string;
  teacherId?: string;
  role?: TeacherRole;
  /** Stands at the side of the row, outside the odd/even pattern. */
  extra?: boolean;
}

export interface Seat {
  rowNumber: number;
  seatNumber: number;
  occupant: SeatOccupant;
}

export interface SeatRow {
  rowNumber: number;
  seats: Seat[];
}

export interface QueuePlan {
  /** "A", "B", ... */
  letter: string;
  groupId: string;
  /** Height rank: 1 = shortest, N = tallest. */
  rank: number;
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
  /** The big central text, e.g. "QUEUE A". */
  primary: string;
  /** Instruction, e.g. "Tallest — fill Row 8". */
  detail: string;
  queueLetter?: string;
  /** Row this step fills — enables live count confirmation. */
  rowNumber?: number;
}

/** rowNumber → pinned size for live on-the-day adjustments. */
export type RowOverrides = Record<number, number>;

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
  /** Rows containing teachers, front first. */
  teacherRows: TeacherRowSummary[];
  /** Front row first (rowNumber ascending). */
  seatRows: SeatRow[];
  queues: QueuePlan[];
  rowLabels: RowLabel[];
  /** Extras standing at the sides of a row (odd person out). */
  extras: { rowNumber: number; count: number } | null;
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
