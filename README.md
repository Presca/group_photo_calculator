# Group Photo Planner

An operations tool for large school photography sessions (150–600 students,
20–80 teachers). Instead of photographers figuring out arrangements live, the
app generates a complete plan instantly: rows, height zones, teacher
placement, queue signs, printable labels, and an on-the-day operation screen —
so arranging hundreds of people needs minimal verbal instructions.

Built with **Next.js + React + TypeScript + TailwindCSS**. State lives in
`localStorage` — no backend required. Mobile-first UI (bottom tab bar, large
touch targets, minimal taps) designed for on-the-go, high-pressure use;
scales up to tablet and desktop.

## Running

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine unit tests (vitest)
npm run build    # production build
```

## Features

| Area | What it does |
| --- | --- |
| **Session Setup** | School, student/teacher/VIP counts, stage width, shoulder width, photo mode. Rows are computed automatically from the head-count and stage width — nothing to configure. |
| **Row Calculator** | Front row always odd, second always even, alternating back; sizes balanced with the back fullest; never exceeds stage capacity. Recalculates instantly. |
| **Height Zones / Queues** | Zones are aligned to row boundaries: each queue holds exactly its row's student count, so a queue empties into its row and the row comes out full — no mid-queue splits, and miscounts surface immediately. Choose up to 5 / 7 / 9 zones; fewer zones than rows merge adjacent rows per queue. |
| **Teacher Placement** | Set rule: teachers always take the front row; VIP teachers take precedence — the contiguous centre-most seats (VIP 1 dead centre) and first in the call sequence. Overflow spills to Row 2, Row 3, … spread evenly *between* students. |
| **Within-row taper** | Set rule: tallest in the middle of every row, tapering to the shortest at the sides. Queues stay single-file: tallest leads, fill left of centre outward, then right of centre outward — nobody is split off once queued. |
| **Visual Stage Layout** | Glanceable snapshot that fits a phone screen: one proportional band per row with the head-count printed on it; blue segments show exactly where teachers are vs students. |
| **Queue Planner** | One printable sign per queue: Queue A → Row 8 → 38 students (Tallest), etc. |
| **Row Labels** | Huge printable labels (ROW 8 / Tallest). Export via print-to-PDF. |
| **Operation Mode** | Full-screen "NOW CALL QUEUE A → fill Row 8" steps with giant Next/Back buttons; helpers just follow the screen. |
| **Adjust Live** | +/− student/teacher buttons; the plan is a deterministic function of the counts, so ±1 nudges one or two rows instead of reshuffling. |
| **Live row pins** | On-the-day flexibility: confirm each row's *actual* count in Operate mode (−2/−1/+1/+2) or tap a band on the Plan screen. The pinned row is fixed at reality and only the not-yet-filled rows rebalance — rows already on stage never move. |
| **Stage Width Calculator** | Max people per row from stage/shoulder width; warns when impossible and offers one-tap fixes (add rows or switch to stitching). |
| **Stitch Planner** | Divides rows into photo groups (Photo A: Rows 8–6 …) with configurable rows-per-photo and overlap. |
| **Command Screen** | The exact phrases to read aloud, one at a time, in arrangement order. |
| **Print Pack** | Layout sheet, teacher guide, queue guide, row labels, height zone guide, session checklist — export everything as one PDF via the print dialog. |

## Architecture

```
src/
  lib/engine/        Pure calculation engine (no React, fully unit tested)
    rowCalculator    Row sizes, parity rules, capacity checks
    heightGroups     Row-aligned height zones (zone = whole rows, exact counts)
    teacherPlacement Roster, front-row-first placement, interspersed overflow
    stitchPlanner    Multi-shot photo grouping with overlap
    queuePlanner     Queue signs from zones + row spans
    commands         Operation steps + spoken command script
    layoutEngine     Orchestrates everything into one StageLayout
  store/             SessionProvider: config + manual swaps, localStorage persistence
  components/        Reusable UI (big buttons, steppers, stage canvas, panels)
  app/               Routes: / (setup) /plan /operate /commands /print
```

**Engine and UI are strictly separated.** Every calculation is a pure
function over plain types (`SessionConfig` in → `StageLayout` out), which is
what makes live adjustments stable and the whole plan reproducible.

### Extending with AI features

The pure-function boundary is the extension point. Planned features slot in
as additional modules that consume/produce the same types:

- **Automatic row optimisation** — a post-processor `optimise(StageLayout): StageLayout`.
- **Camera framing suggestions** — consume `StageLayout` geometry (stage width, row arcs).
- **Face visibility scoring** — score `Seat[]` occlusion, feed swaps back through `applySeatSwaps`.
- **Attendance import / QR check-in** — replace `generateTeacherRoster` and the anonymous student pools with named people; every downstream type already carries occupant identity.
- **Blocked-face detection** — map camera-frame detections back to seats via the same seat geometry used by `StageCanvas`.
