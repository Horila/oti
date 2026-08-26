# LazyBum Comprehensive Bugfix Plan (`bugfix-plan.md`)

This document outlines all **31 bugs** discovered during the two diagnostic sweeps of the **LazyBum** codebase (`oti/oti/`), along with root cause analyses, exact file locations, and proposed code fixes.

---

## Table of Contents
1. [First Sweep Findings (B-01 to B-18)](#1-first-sweep-findings)
2. [Second Sweep Findings (B-19 to B-31)](#2-second-sweep-findings)
3. [Complete Master Bug List & Fix Strategy](#3-complete-master-bug-list--fix-strategy)
4. [Verification & Testing Plan](#4-verification--testing-plan)

---

## 1. First Sweep Findings

### 🔴 Critical Bugs
- **B-01**: **Streak Calculation Frozen** (`js/supabase.js:L132` & `js/views/player.js:L238`) — `computeNewStreak` called after inserting today's session into DB, causing `dayDiff === 0` and freezing streak.
- **B-02**: **Week 4 Infinite Loop** (`js/views/player.js:L249`) — Completing Week 4 Day 6 resets `currentDayInWeek = 0` and keeps `currentWeek = 4`, causing endless repetition.
- **B-03**: **Session Note Wiped Out on Dial Click** (`js/views/player.js:L383`) — Typing in `#session-note` then selecting rating dial calls `draw()`, erasing typed text.
- **B-04**: **View Unmount Cleanup Overwritten** (`js/main.js:L8-L56`) — Rapid routing overwrites `unmountCurrent` while async `getProfile()` is pending, leaking background timers.

### 🟠 High Severity Bugs
- **B-05**: **Unsaved Progress on Back Button** (`js/views/player.js:L221`) — Progress saved only on `#exit-btn` click, lost on back button navigation.
- **B-06**: **Swapped Exercise Reverts** (`js/views/player.js:L207`) — Swapped exercises held in memory only, lost on session resume.
- **B-07**: **Service Worker Offline TypeError** (`sw.js:L43`) — `.catch(() => cached)` evaluates to `undefined` when offline, causing `event.respondWith()` `TypeError`.
- **B-08**: **Offline ESM Script White-Screen Crash** (`js/supabase.js:L1`, `sw.js:L40`) — Supabase SDK loaded via `esm.sh` bypasses SW caching.

### 🟡 Medium & Low Severity Bugs
- **B-09 & B-10**: Audio/TTS Speech double triggers and untracked timeouts in `player.js`.
- **B-11**: Exercise images/audio omitted from `SHELL_URLS` in `sw.js`.
- **B-12 & B-13**: Unmapped DB properties in `toSnakeProfilePatch` and DST 23-hour date math discrepancy.
- **B-14 & B-15**: Synchronous `revokeObjectURL` breaks iOS Safari downloads; JSON export payload incomplete.
- **B-16, B-17, B-18**: Invalid `<h2>` inside `<button>`, missing ARIA radiogroup roles, and Safari cold-load voice selection failures.

---

## 2. Second Sweep Findings

### 🔴 Critical & High Bugs
- **B-19**: **Workout Completion Instantly Overwritten on View Unmount** (`js/views/player.js:L482`)
  - *Root Cause*: `handleCompletionSave()` clears `inProgressExerciseIndex` to `null` in Supabase, then calls `navigate("/home")`. Router `render()` invokes `unmountCurrent()`, which runs `saveProgress()`, writing `inProgressExerciseIndex = 5` BACK to Supabase! Home screen immediately shows "Resume Workout" for the completed session.
  - *Fix*: Skip `saveProgress()` inside `unmount()` if `completed` is true.
- **B-20**: **Same-Day Multi-Session Double Streak & Week Advancement** (`js/supabase.js:L148`, `js/views/player.js:L286`)
  - *Root Cause*: Completing a 2nd session on the same day increments `streakCount` again and advances `currentDayInWeek`.
  - *Fix*: Check if a session was already completed today before incrementing streak or day counts.
- **B-21**: **iOS Safari Audio Autoplay Blocked on Auto-Advance** (`js/views/player.js:L95`)
  - *Root Cause*: Auto-advancing inside `setInterval` calls `audioEl.play()` without user interaction.
  - *Fix*: Unlock `audioEl` during initial user click ("Pornește") by playing a silent audio buffer.
- **B-22**: **Negative `inProgressExerciseIndex` Crashes Player (`TypeError`)** (`js/views/player.js:L197`)
  - *Root Cause*: `profile.inProgressExerciseIndex = -5` evaluates `-5 || 0` to `-5`, setting `index = -5`. `sequence[-5]` is `undefined`, crashing `draw()`.
  - *Fix*: Clamp index: `Math.max(0, Math.min(profile.inProgressExerciseIndex || 0, sequence.length - 1))`.
- **B-23**: **Missing Notch / Status Bar Safe-Area Support** (`style.css:L118`)
  - *Root Cause*: Top padding hardcoded without `env(safe-area-inset-top)`.
  - *Fix*: Add `padding-top: calc(28px + env(safe-area-inset-top))`.
- **B-24**: **Modal Sheet Top Clipping on Small Screens** (`style.css:L347`)
  - *Root Cause*: `.sheet` anchored at bottom without `max-height` or `overflow-y: auto`.
  - *Fix*: Add `max-height: calc(100dvh - 32px)` and `overflow-y: auto`.

### 🟡 Medium & Low Bugs
- **B-25**: **Out-of-bounds `currentWeek` Persists in DB** (`js/data.js:L83`, `js/views/home.js:L85`) — Clamp `currentWeek` between 1 and 4.
- **B-26**: **Negative `streakCount` Increments Negatively** (`js/supabase.js:L148`) — Ensure `Math.max(0, streakCount)`.
- **B-27**: **Unhandled Errors on Missing DB Tables** (`js/views/home.js:L32`, `js/views/progress.js:L24`) — Add `try...catch` blocks around view data fetches.
- **B-28**: **Rating Dial Touch Target Violation (40px vs 44px)** (`style.css:L360`) — Increase height to `46px`.
- **B-29**: **Mobile Viewport Height Instability (`100vh` vs `100dvh`)** (`style.css:L44`) — Update to `100dvh`.
- **B-30**: **Timer Digit Width Wobble** (`style.css:L321`) — Add `font-feature-settings: "tnum"`.
- **B-31**: **Silent Failure in `handleReplace()` on Invalid IDs** (`js/views/player.js:L249`) — Filter invalid alternate IDs before selection.

---

## 3. Verification & Testing Plan

### Automated Verification:
- Run Node test script verifying logical bounds for `computeNewStreak`, `daysSince`, `newlyEarnedBadge`, `buildSequenceForWeek`, and negative index clamping.

### Manual Verification:
1. **Completion & Resume Test**: Complete a workout, return to Home, verify "Resume" card is NOT displayed.
2. **Streak Test**: Verify streak increases by +1 on consecutive days and stays unchanged on same-day 2nd workout.
3. **Notch & Keyboard Test**: Open weekly sheet and completion sheet on mobile device; verify top title remains visible when keyboard appears.
