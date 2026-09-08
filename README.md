# 留白 · Alex 的一天

A private, Chinese-language daily planner for Alex with an ADHD-friendly workflow.

## V1 daily planning

- Evening free-text capture, task review, saved schedule proposals and morning adjustments.
- Persistent backlog, explicit selection of carry-over tasks, completion and reversible archiving.
- Configurable protected wake, meal and sleep anchors, plus realistic routines, breaks and buffer time.
- Explicit confirmation is required before applying a generated or revised day. Stale proposals are rejected.
- Rule-based text extraction handles common Chinese durations and appointment times; extracted fields are always editable. No LLM provider or API key is configured.
- See `REQUIREMENTS.md` for the four user decisions and defaults.

## Features

- Editable day plans, with normal, grocery-shopping and slow-cooking templates.
- Toronto time zone; a planning day starts at 07:30 and ends at 07:30 the next day.
- One persistent timer, pause/resume via timestamped sessions, completion marks and manual corrections.
- Actual time is independent of completion marks. Cross-day sessions belong to their starting planning day.
- Daily category comparisons, seven-day recorded work charts and CSV export.
- Account-scoped D1 persistence and revision checks to avoid overwriting changes from another tab.
- Desktop and mobile layouts; keyboard-accessible Radix dialogs and tabs.

## Implementation

- `app/planner.tsx`: interactive application.
- `app/planning-workspace.tsx`: capture, clarification, proposal, backlog and settings views.
- `lib/planning.ts`: text extraction, schemas and deterministic scheduling.
- `app/api/planning/route.ts`: persistent drafts and confirmation boundary.
- `db/snapshot.ts`: account-scoped state and transactional writes.
- `lib/planner.ts`: templates, schemas and Toronto time calculations.
- `app/api/planner/route.ts`: authenticated persistence with prepared D1 statements.
- `db/schema.ts`, `drizzle/`: account and day storage and generated migrations.
- Uses the platform's authenticated user ID. Private site access is enforced by Sites.
- Day plans default to the template until first changed or used. Actual records are never seeded.

## Verification

- `node tests/planner/run.mjs`: SQLite-backed API tests, revision conflict protection, user isolation, validation, timer round trips, Toronto summer/winter conversion and DST gaps.
- `npx tsc --noEmit`: TypeScript verification.
- Build and hosting use the installed Sites workflow.

No medical measurements, partner health information or uploaded screenshots are stored in this application. No notifications or calendar integrations are enabled.

### V2 interface

Desktop planning and mobile execution use the same server-backed account data. The mobile first screen emphasizes the current task, timer controls, and next task. Whole-day agenda, routine settings, and detailed review remain available. Planning is progressive, saves drafts automatically, and displays grouped schedule changes before explicit application. Completion undo changes only the completion flag; recorded time is retained.

Idle visible pages refresh every 30 seconds and on focus/reconnection. Background reads are ignored if local editing or a newer revision makes them stale. Writes still use the shared revision guard; V2 does not support offline writes. Text organization remains rule based; no LLM was added.

Validation: `node tests/planner/run.mjs`, `npx tsc --noEmit`, and the Sites production build. Browser interaction and visual testing have not been performed in this iteration.

### V3 focus space

Enter through the sidebar's 专注空间 or the current-task card's 进入专注空间 button. Opening/closing the view is independent of starting/pausing an actual session. The focused block stays pinned while paused; the true active server session takes priority. Accumulated time combines saved logs for that block with the current wall-clock interval.

The six activity scenes use original procedural Three.js geometry, with articulated limbs and small activity-specific motions. The renderer is dynamically imported on entry, caps rendering at 24 fps and DPR 1.5, stops requesting frames while hidden/paused/static, respects reduced motion, and disposes resources on exit. Geometry tests validate bounded finite transforms and material cleanup. WebGL/GPU rendering and browser interactions have not been visually tested in this iteration.

Scene selection and focus-view restoration are device-local UI preferences. The existing authenticated database remains the source of truth for all tracked time. Scene rendering never mutates a schedule or log.

Implementation references: [Three.js resource cleanup](https://threejs.org/manual/en/cleanup.html), [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

### V3.1 resume and recovery

The current-task card and focus view share a saved next-step note, a recovery entry, and active-session verification. Pausing offers an optional note; task notes stay associated with the task across replanning. The recovery flow collects a time budget and energy, generates a proposal, and uses the existing explicit confirmation boundary. Partial work is marked so completing only the scheduled portion does not remove the remaining task from the backlog.

`app/api/focus/route.ts` stores notes and atomic time corrections with account authentication, prepared statements, and the shared revision guard. Optional fields in existing task/day/active JSON preserve compatibility; deployed SQL migrations are unchanged. `lib/recovery.ts` handles note lookup, the 90-minute review prompt, and validated interval splitting. `app/recovery-controls.tsx` supplies the shared accessible controls and dialogs. Corrections use the timestamp captured when review opens; a continued confirmed session retains its original start. Tab visibility never classifies actual activity.

`tests/planner/recovery-check.ts` covers durable notes, task identity, user isolation, stale/repeated writes, confirmed and shortened timers, rest splits, epoch arithmetic, recovery budgets, protected anchors, explicit application, and partial work retained in the task pool. Browser interaction and visual QA were not performed in this iteration.

### One-day overview

The default overview presents a proportional waking-day plan map, three daytime cards, and a separate nighttime section. Adjacent meal steps can be grouped, but the original blocks and saved records are unchanged. Clicking a group shows its source blocks, with a direct link to the existing detailed agenda. The current-task entry uses the actual active session first; scheduled suggestions are explicitly labeled.

`lib/day-overview.ts` clips and groups only for presentation. `app/day-overview.tsx` renders the map, compact cards, and detail dialog. `tests/planner/overview-check.ts` verifies duration conservation, gaps, period boundaries, source identity, grouping, and empty plans. No database schema or timer changes. Browser/visual QA has not been performed for this view.

### Illustrated overview

Morning, afternoon, and evening cards have matching original scene covers, with separate readable text headers and category icon badges on tasks. The covers use responsive local WebP files, reserved aspect ratios, and lazy loading. Task data, timers, detail dialogs, and the mobile period selector retain their existing behavior. Artwork prompts and provenance are in `public/images/day-overview/ASSETS.md`. Source image inspection, TypeScript, and the production build are used for validation; browser/visual QA has not been performed.

Daytime rows and free gaps share one duration scale across desktop and mobile: 30 minutes = 5rem. Heights use each group's clipped start/end range, including merged steps. Task rows retain a 5rem readability floor, gaps retain 2.75rem, and wrapped content may expand a row. No maximum-height clamp compresses long blocks. Pastel surfaces and category edges make each block's extent visible; the header notes the short-row exception. The full-day map remains strictly proportional, and the detailed agenda, data, and timing behavior are unchanged.
