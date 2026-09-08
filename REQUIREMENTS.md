# 留白 V1 — agreed product behavior

Alex's decisions in this conversation:

1. Plan tomorrow the evening before; adjust for 1–2 minutes in the morning.
2. Unfinished tasks remain in a backlog. Ask whether to continue at the next planning session; do not schedule them automatically.
3. Accept a free-text paragraph, organize tasks, and ask for missing details.
4. Propose changes to the remaining day and apply only after explicit user confirmation.
5. Protect wake time, breakfast, lunch, dinner and bedtime during automatic scheduling.

Defaults inherit the prior schedule: wake 07:30, breakfast 07:45, lunch 12:00, dinner 19:15, bed 23:00. Meal durations are 30 minutes. These defaults are editable settings, not medical recommendations.

Preserve breakfast, post-lunch gym including preparation/travel/shower, realistic meal preparation, two 15-minute cat-play sessions, nighttime cat care and reading. The work target is configurable; initial target is six hours of work, with breaks tracked separately. Actual and planned time remain independent.

The V1 text organizer is conservative rule-based extraction of punctuation-separated tasks, common explicit durations, priorities and appointment times. It does not use an LLM and does not claim full conversational understanding. All extracted tasks remain editable and require the user to confirm missing durations before scheduling. A future model integration can replace extraction without replacing the deterministic scheduler or confirmation boundary.

Implementation must preserve existing dated schedules, actual logs and account isolation. Drafts are persisted separately from confirmed days. Applied migrations are immutable; only additive schema migrations are permitted.

## V2 — desktop planning, mobile execution

Alex chose: plan on a computer, view and record on a phone.

- Desktop keeps a full-day agenda alongside the current-task panel. Mobile leads with current task and next task; its bottom navigation opens now, agenda, planning and review.
- Detailed statistics belong to Review. Full-day mobile agenda and secondary routine settings expand on demand.
- Planning asks about one missing task duration at a time, then shows priorities and daily energy/gym context. Optional task details stay expandable.
- Draft edits autosave after a pause and persist through the same authenticated D1 API. Visible saving/failure states and explicit retry preserve unsubmitted input. A revision conflict never silently overwrites another device.
- Returning to an idle tab, reconnecting, and a 30-second visible-tab interval refresh server state. Do not apply background reads while a form is open, a write is pending, or a goal has unsaved edits. This is online sync; there is no offline write queue.
- Replanning offers delay, lower energy, or new-task entry. Show grouped before/after times and removed tasks before the user's explicit confirmation. A delayed start never shifts protected routine anchors.
- Completion can be undone without deleting actual time records. Keep account isolation, existing records, and immutable migrations.

## V3 — a background focus space

Alex chose: keep the computer tab in the background and return to it when needed.

- A dedicated focus view shows the explicitly chosen/current active task, its accumulated recorded time, a real 3D activity scene, pause and completion controls. Opening or closing the view never starts or stops the timer by itself.
- The active server session wins over a scheduled suggestion. A paused view retains its selected block; crossing a scheduled boundary never starts the next task. Moving to the next task is explicit.
- Six bundled procedural Three.js scenes: desk, reading, stationary bike, two cats, kitchen, and window-side rest. Scene selection follows task/category rules and can be overridden locally. These are visual activity cues, not exercise instructions.
- Background tabs stop animation frames and per-second UI updates; elapsed time derives from saved timestamps on return. Foreground animation is limited to 24 rendered frames per second and pixel ratio 1.5. Respect reduced-motion preferences and a manual still-picture option. No sound is played.
- A reload restores the open focus view in the same tab using only device-local view selection. Actual sessions and records continue to come from the authenticated database. No extra timer or offline write queue is introduced.
- Scene code loads only on entering focus. Failure to initialize WebGL displays a retryable fallback while keeping task and timer controls usable. Exit disposes scene geometry, materials and the graphics context.
- Existing scheduling, data, account boundaries, protected routines and migrations remain intact.

## V3.1 — resume, recover, verify

Alex approved the first three suggested improvements: a saved next step, an "我跑偏了" flow, and trustworthy time correction.

- Current-task and focus views display an optional next-step note, up to 240 characters. Pausing offers a skippable editor. Notes follow linked tasks across split blocks/replanning; routine/manual notes belong to the dated block. All notes persist in D1 separately from descriptive instructions.
- "我跑偏了" offers verification of a running timer, then asks for remaining flexible-task minutes and energy, with a priority selector. Existing selected/today's unfinished tasks are candidates; other backlog tasks are opt-in. Routines and fixed appointments stay outside the task budget. Changes require preview and explicit confirmation.
- Recovery may schedule part of a divisible work task. Unplaced work remains in the pool, even after only the partial segment is completed. The future portion of a currently scheduled unfinished flexible task may be shortened in the proposal; elapsed portions and actual logs are preserved.
- After 90 minutes since start or the last confirmation, show a nonmodal review prompt on the visible page. Never infer work from tab visibility or automatically pause. Manual review is always available while timing.
- Review options: keep, shorten the end (including zero work), or split one rest interval into work/rest/work. Keeping may continue timing; corrections pause, with explicit resumption available. The cutoff is captured when the window opens. Closing without saving changes nothing. Historical corrections remain in Review.
- Authenticated revision-guarded transactions prevent stale overwrites and duplicate time records. Failed forms preserve input. No schema migration, external tracking, notifications, or offline write queue is added.

## One-day overview

Alex asked to keep the existing detailed agenda and add a clearer, more visual view.

- Default to 一日总览, with explicit tabs for 详细日程 and 回顾. Keep the full existing agenda and editing/recording flows.
- Show a compact current-task entry, a proportional waking-day time strip, and morning/afternoon/evening cards. Nighttime remains a separate compact section so sleep does not dominate the map.
- Show real planned durations, gaps, completion flags, and an actual-time marker. Explicitly distinguish a running timer from a scheduled suggestion. Do not infer completion or create actual records from the visualization.
- Group adjacent meal steps for scanning, while retaining every original block in a detail dialog. Preserve distinct tasks and clip cross-period blocks only for presentation. Open the original block in the detailed agenda for editing.
- Desktop displays three period cards side by side; mobile lets the user select one period with nighttime accessible below. No new persistence, external service, or scheduling mutation is introduced.
