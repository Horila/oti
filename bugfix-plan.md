# LazyBum Comprehensive Bugfix Plan (`bugfix-plan.md`)

This document outlines all **18 bugs** discovered during the workflow subagent diagnostic audit of the **LazyBum** codebase (`oti/oti/`), along with detailed root cause analyses, exact file locations, and proposed code fixes.

---

## Table of Contents
1. [Business Logic & State Management Bugs](#1-business-logic--state-management-bugs)
2. [Async Router, Navigation & View Lifecycle Bugs](#2-async-router-navigation--view-lifecycle-bugs)
3. [Media APIs & Audio/Speech Synthesis Bugs](#3-media-apis--audiospeech-synthesis-bugs)
4. [Service Worker, PWA & Network Resilience Bugs](#4-service-worker-pwa--network-resilience-bugs)
5. [Data Export & User Input Bugs](#5-data-export--user-input-bugs)
6. [Accessibility (A11y) & HTML Semantics Bugs](#6-accessibility-a11y--html-semantics-bugs)
7. [Verification & Testing Plan](#7-verification--testing-plan)

---

## 1. Business Logic & State Management Bugs

### 🔴 Bug B-01: Frozen Streak Calculation (`computeNewStreak`)
- **File Location**: [`js/supabase.js:L132-L146`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/supabase.js#L132-L146) & [`js/views/player.js:L238-L248`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/player.js#L238-L248)
- **Severity**: Critical
- **Root Cause**:
  In `player.js`, `handleCompletionSave()` calls `createSessionLog()` *before* fetching session logs and calling `computeNewStreak()`.
  Because today's session has already been inserted into Supabase, `sessions[0]` is today's date.
  `computeNewStreak()` calculates `dayDiff = Math.round((today - mostRecent) / 86400000)`. Because `mostRecent` is today, `dayDiff` evaluates to `0`. When `dayDiff === 0`, it executes `if (dayDiff === 0) return Math.max(1, currentStreak);`, which returns `currentStreak` without incrementing it!
- **Proposed Fix**:
  Calculate `newStreak` based on `sessions` *prior* to inserting today's session, or filter out today's date from `sessionLogs` when calculating the date delta:
  ```js
  // js/supabase.js
  export function computeNewStreak(currentStreak, sessionLogs) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Exclude sessions recorded today to evaluate previous activity streak
    const pastCompletedDates = sessionLogs
      .filter((s) => s.completed)
      .map((s) => new Date(s.date))
      .filter((d) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date.getTime() < today.getTime();
      })
      .sort((a, b) => b - a);

    if (pastCompletedDates.length === 0) return 1;

    const mostRecent = pastCompletedDates[0];
    mostRecent.setHours(0, 0, 0, 0);
    const dayDiff = Math.round((today - mostRecent) / (1000 * 60 * 60 * 24));

    if (dayDiff === 1) return (currentStreak || 0) + 1;
    return 1;
  }
  ```

---

### 🔴 Bug B-02: Infinite Program Loop on Week 4 Completion
- **File Location**: [`js/views/player.js:L249-L264`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/player.js#L249-L264)
- **Severity**: Critical
- **Root Cause**:
  When completing Day 6 of Week 4 (`currentDayInWeek = 6`), completing the session increments `newDayInWeek` to `7`. The condition `if (newDayInWeek >= 7)` resets `newDayInWeek = 0` and sets `newWeek = Math.min(4, newWeek + 1)`.
  `Math.min(4, 5)` evaluates to `4`. Consequently, `currentWeek` remains `4` and `currentDayInWeek` becomes `0`, trapping users in an infinite loop repeating Week 4.
- **Proposed Fix**:
  Track program completion gracefully (e.g. `currentWeek = 4`, `currentDayInWeek = 6` / completed status) or allow `newWeek` to reflect 4 as max completed without resetting days back to 0 indefinitely:
  ```js
  // js/views/player.js
  let newDayInWeek = (profile.currentDayInWeek || 0) + 1;
  let newWeek = profile.currentWeek || 1;

  if (newDayInWeek >= 7) {
    if (newWeek < 4) {
      newWeek += 1;
      newDayInWeek = 0;
    } else {
      // Completed all 4 weeks! Keep at Week 4 Day 6
      newWeek = 4;
      newDayInWeek = 6;
    }
  }
  ```

---

### 🟠 Bug B-06: Swapped Exercise Reverts on Session Resume
- **File Location**: [`js/views/player.js:L207-L219`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/player.js#L207-L219)
- **Severity**: High
- **Root Cause**:
  When a user uses "Înlocuire Sigură", `handleReplace()` swaps `sequence[index]` in memory, but `saveProgress()` only persists `inProgressExerciseIndex` to Supabase. When resuming later, `buildSequenceForWeek()` reconstructs the default exercise array, losing the user's selected replacement.
- **Proposed Fix**:
  Store replacement exercise mapping in state or save custom sequence IDs array in profile / local state.

---

### 🟡 Bug B-12: Unmapped DB Properties in `toSnakeProfilePatch`
- **File Location**: [`js/supabase.js:L26-L43`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/supabase.js#L26-L43)
- **Severity**: Medium
- **Root Cause**:
  `toSnakeProfilePatch` unconditionally adds `updated_at: new Date().toISOString()`. If the Supabase database table `lazybum_profile` does not have an `updated_at` column, queries fail. Unmapped camelCase properties are also passed as-is.
- **Proposed Fix**:
  Only include valid mapped columns and omit `updated_at` unless column exists in schema.

---

### 🟡 Bug B-13: DST Transition & Date Math Discrepancy
- **File Location**: [`js/views/home.js:L22-L29`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/home.js#L22-L29)
- **Severity**: Medium
- **Root Cause**:
  `daysSince` uses `Math.floor((today - then) / 86400000)`. On 23-hour DST spring transitions, `82,800,000 / 86,400,000 = 0.958`, and `Math.floor(0.958)` evaluates to `0` instead of `1`.
- **Proposed Fix**:
  Use `Math.round` consistently for day difference calculations:
  ```js
  function daysSince(dateStr) {
    if (!dateStr) return Infinity;
    const then = new Date(dateStr);
    then.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((today - then) / (1000 * 60 * 60 * 24));
  }
  ```

---

## 2. Async Router, Navigation & View Lifecycle Bugs

### 🔴 Bug B-04: View Lifecycle Cleanup Overwritten on Rapid Routing
- **File Location**: [`js/main.js:L8-L56`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/main.js#L8-L56)
- **Severity**: Critical
- **Root Cause**:
  `main.js` `render()` is an `async` function. When `location.hash` changes quickly:
  1. Call 1 executes `unmountCurrent()` and awaits `getProfile()`.
  2. Call 2 fires on new hash, sees `unmountCurrent` is `null`, and awaits `getProfile()`.
  3. Call 1 finishes and sets `unmountCurrent = unmountPlayer`.
  4. Call 2 finishes and overwrites `unmountCurrent = unmountHome`.
  `unmountPlayer()` is never called, leaving background timers (`tickHandle`, `saveHandle`) and voice audio active.
- **Proposed Fix**:
  Introduce a route sequence token (`renderToken`) to ensure stale async renders are aborted and unmounted immediately:
  ```js
  // js/main.js
  let renderToken = 0;

  async function render() {
    const currentToken = ++renderToken;

    if (typeof unmountCurrent === "function") {
      try { unmountCurrent(); } catch (e) { /* noop */ }
      unmountCurrent = null;
    }

    let profile;
    try {
      profile = await getProfile();
    } catch (err) {
      if (currentToken !== renderToken) return;
      app.innerHTML = `<div class="loading-screen"><p class="empty-note">Nu am putut încărca datele. Verifică conexiunea și reîncarcă pagina.</p></div>`;
      return;
    }

    if (currentToken !== renderToken) return; // Abandon stale navigation
    ...
  }
  ```

---

### 🟠 Bug B-05: Unsaved Progress on Direct Back Button Navigation
- **File Location**: [`js/views/player.js:L221-L226`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/player.js#L221-L226) & [`L429-L432`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/player.js#L429-L432)
- **Severity**: High
- **Root Cause**:
  Progress is saved (`await saveProgress()`) inside `handleExit()`. Navigating via browser back button triggers `unmount()` directly, which only clears timers without saving elapsed state.
- **Proposed Fix**:
  Add `saveProgress()` call inside the returned `unmount()` function:
  ```js
  return () => {
    clearTimers();
    stopVoice();
    saveProgress();
  };
  ```

---

## 3. Media APIs & Audio/Speech Synthesis Bugs

### 🔴 Bug B-03 / Data Bug: `#session-note` Text Erased on Rating Click
- **File Location**: [`js/views/player.js:L383-L418`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/player.js#L383-L418)
- **Severity**: Critical
- **Root Cause**:
  `<textarea id="session-note">${noteDraft}</textarea>` renders with `${noteDraft}` (initially `""`).
  `noteDraft` is only saved when clicking "Salvează". Clicking a rating button calls `selectedComfort = value; draw();`. `draw()` replaces DOM innerHTML, rendering `${noteDraft}` (`""`) and wiping out the user's typed text.
- **Proposed Fix**:
  Capture live text input in `#session-note` or read input value before re-rendering:
  ```js
  // js/views/player.js
  document.querySelectorAll('[data-dial="comfort"] button, [data-dial="sleep"] button').forEach((btn) => {
    btn.addEventListener("click", () => {
      const noteInput = document.getElementById("session-note");
      if (noteInput) noteDraft = noteInput.value;
      ...
      draw();
    });
  });
  ```

---

### 🟡 Bug B-09: Double Speech Synthesis Trigger on Audio Failure
- **File Location**: [`js/views/player.js:L57-L63`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/player.js#L57-L63)
- **Severity**: Medium
- **Root Cause**:
  `audioEl.onerror = () => speakText(fallbackText);`
  `audioEl.play().catch(() => speakText(fallbackText));`
  When an audio file fails to load, `onerror` fires AND `.play()` rejects, calling `speakText()` twice in rapid succession.
- **Proposed Fix**:
  Use a single fallback flag or wrapper to prevent double invocation:
  ```js
  function playAudioOrSpeak(src, fallbackText) {
    if (!voiceEnabled) return;
    stopVoice();
    let spoke = false;
    const fallback = () => {
      if (!spoke) { spoke = true; speakText(fallbackText); }
    };
    audioEl.onerror = fallback;
    audioEl.src = src;
    audioEl.play().catch(fallback);
  }
  ```

---

### 🟡 Bug B-10: Untracked `setTimeout` in `handleSpeakOnEnter`
- **File Location**: [`js/views/player.js:L153-L160`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/player.js#L153-L160)
- **Severity**: Medium
- **Root Cause**:
  `setTimeout(() => playCue(exercise), 250)` is untracked. If user pauses or exits within 250ms, audio still plays.
- **Proposed Fix**:
  Track `speakTimeout` handle and clear it in `stopVoice()` and `clearTimers()`.

---

## 4. Service Worker, PWA & Network Resilience Bugs

### 🟠 Bug B-07: Service Worker TypeError on Offline Fetch
- **File Location**: [`sw.js:L43-L53`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/sw.js#L43-L53)
- **Severity**: High
- **Root Cause**:
  ```js
  caches.match(req).then((cached) => {
    if (cached) return cached;
    return fetch(req).then(...).catch(() => cached);
  })
  ```
  When offline and asset is not in cache, `cached` is `undefined`. `.catch(() => cached)` returns `undefined`, causing `event.respondWith()` to throw browser `TypeError`.
- **Proposed Fix**:
  Return a proper fallback response or standard 503 Response:
  ```js
  // sw.js
  caches.match(req).then((cached) => {
    if (cached) return cached;
    return fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => cached || new Response("Offline", { status: 503, statusText: "Service Unavailable" }));
  })
  ```

---

### 🟠 Bug B-08: Cross-Origin ESM SDK Offline White-Screen Crash
- **File Location**: [`js/supabase.js:L1`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/supabase.js#L1) & [`sw.js:L40`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/sw.js#L40)
- **Severity**: High
- **Root Cause**:
  `supabase.js` imports `@supabase/supabase-js` directly from `https://esm.sh/@supabase/supabase-js@2`. `sw.js` ignores cross-origin requests (`url.origin !== self.location.origin`). When offline without browser HTTP cache, script resolution throws fatal loading error.
- **Proposed Fix**:
  Allow service worker runtime caching for `esm.sh` or vendor Supabase library locally.

---

### 🟡 Bug B-11: Precache Omission of Exercise Images & Audio
- **File Location**: [`sw.js:L3-L17`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/sw.js#L3-L17)
- **Severity**: Medium
- **Root Cause**:
  `SHELL_URLS` excludes all 20 exercise images (`assets/exercises/*.png`) and 21 audio MP3 files (`assets/audio/*.mp3`), leaving offline workouts without assets unless previously loaded.
- **Proposed Fix**:
  Add assets dynamically to cache during install or runtime caching.

---

## 5. Data Export & User Input Bugs

### 🟡 Bug B-14: Premature `revokeObjectURL` on iOS Safari
- **File Location**: [`js/views/progress.js:L99-L107`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/progress.js#L99-L107)
- **Severity**: Medium
- **Root Cause**:
  `URL.revokeObjectURL(url)` is called synchronously right after `a.click()`. On iOS WebKit, download is scheduled asynchronously, breaking download execution.
- **Proposed Fix**:
  Wrap `revokeObjectURL` in a `setTimeout(..., 1000)`:
  ```js
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ```

---

### 🟡 Bug B-15: Incomplete Export Data Payload
- **File Location**: [`js/views/progress.js:L88-L97`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/progress.js#L88-L97)
- **Severity**: Medium
- **Root Cause**:
  `payload.profile` omits `id`, `currentDayInWeek`, `hasCompletedOnboarding`, `lastCelebratedMilestone`, and in-progress session data.
- **Proposed Fix**:
  Include full `profile` object in export payload.

---

## 6. Accessibility (A11y) & HTML Semantics Bugs

### 🔵 Bug B-16: Heading Tag `<h2>` Nested Inside `<button>`
- **File Location**: [`js/views/home.js:L77-L87`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/home.js#L77-L87)
- **Severity**: Low / A11y
- **Root Cause**: `#start-btn` is a `<button>` containing an `<h2>` block element, violating HTML semantics and breaking screen reader navigation.
- **Proposed Fix**: Replace `<h2>` with `<span class="cta-title">`.

---

### 🔵 Bug B-17: Unaccessible Rating Dial Controls
- **File Location**: [`js/views/home.js:L48`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/home.js#L48) & [`js/views/player.js:L272`](file:///C:/Users/horat/OneDrive/Documents/oti/oti/js/views/player.js#L272)
- **Severity**: Low / A11y
- **Root Cause**: Rating buttons lack `role="radiogroup"`, `role="radio"`, `aria-checked`, and `aria-label`.
- **Proposed Fix**: Add ARIA roles and states to rating dials.

---

## 7. Verification & Testing Plan

### Automated Verification:
- **Node Unit Tests**: Run dedicated test script for `computeNewStreak`, `daysSince`, `newlyEarnedBadge`, and `buildSequenceForWeek`.
- **JS Syntax Verification**: Parse modified JS files via Node/ESLint.

### Manual Verification:
1. **Streak Test**: Complete a workout and verify streak increments from 1 to 2 on consecutive days.
2. **Week 4 Transition Test**: Complete Week 4 Day 6 and verify UI handles program completion cleanly.
3. **Session Note Test**: Type text into completion sheet note, click rating dials (1-5), verify typed text is retained.
4. **Fast Routing Test**: Rapidly click between Home, Player, and Progress links and verify no lingering background timers or audio play.
5. **Offline Test**: Disconnect network in DevTools, start workout, verify PWA assets load smoothly.
