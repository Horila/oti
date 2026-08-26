import { buildSequenceForWeek, weekProgram, exerciseImageSrc, exerciseAudioSrc, exerciseById } from "../data.js";
import { updateProfile, createSessionLog, listSessionLogs, computeNewStreak } from "../supabase.js";

function computeDuration(exercise, volumeMultiplier) {
  const base = Math.round(exercise.durationSeconds * volumeMultiplier);
  return exercise.unilateral ? base * 2 : base;
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m === 0 ? `${r}s` : `${m}:${String(r).padStart(2, "0")}`;
}

const RING_RADIUS = 96;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export async function renderPlayer(app, { profile, navigate }) {
  const wp = weekProgram(profile.currentWeek);
  const sequence = buildSequenceForWeek(profile.currentWeek);

  let index = 0;
  let elapsed = 0;
  let paused = true;
  let completed = false;
  let voiceEnabled = true;
  let tickHandle = null;
  let saveHandle = null;
  let lastSpokenId = null;
  let halfSpoken = false;
  const audioEl = new Audio();

  const hasInProgress = profile.inProgressExerciseIndex !== null && profile.inProgressExerciseIndex !== undefined;
  let showResumeSheet = hasInProgress && sequence.length > 0;
  let showCompletionSheet = false;

  function stopVoice() {
    audioEl.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function speakText(text) {
    if (!voiceEnabled || !text || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ro-RO";
      u.rate = 0.92;
      const voices = window.speechSynthesis.getVoices();
      const ro = voices.find((v) => v.lang?.toLowerCase().startsWith("ro"));
      if (ro) u.voice = ro;
      window.speechSynthesis.speak(u);
    } catch (e) { /* noop */ }
  }

  function playAudioOrSpeak(src, fallbackText) {
    if (!voiceEnabled) return;
    stopVoice();
    audioEl.src = src;
    audioEl.onerror = () => speakText(fallbackText);
    audioEl.play().catch(() => speakText(fallbackText));
  }

  function playCue(exercise) {
    playAudioOrSpeak(exerciseAudioSrc(exercise.id), exercise.voiceoverCue);
  }

  function playSideCue() {
    playAudioOrSpeak(exerciseAudioSrc("0021"), "Acum partea dreaptă.");
  }

  async function saveProgress() {
    try {
      await updateProfile(profile.id, {
        inProgressExerciseIndex: index,
        inProgressElapsedSeconds: elapsed,
        inProgressStartedAt: new Date().toISOString(),
      });
    } catch (e) { /* noop */ }
  }

  function clearTimers() {
    if (tickHandle) clearInterval(tickHandle);
    if (saveHandle) clearInterval(saveHandle);
    tickHandle = null;
    saveHandle = null;
  }

  function startTimers() {
    clearTimers();
    tickHandle = setInterval(() => {
      if (paused || completed || showResumeSheet) return;
      elapsed += 1;
      tick();
    }, 1000);
    saveHandle = setInterval(() => {
      if (!paused && !completed && !showResumeSheet) saveProgress();
    }, 4000);
  }

  function currentExercise() { return sequence[index]; }
  function totalDuration() { return computeDuration(currentExercise(), wp.volumeMultiplier); }

  function tick() {
    const exercise = currentExercise();
    const total = totalDuration();
    const half = Math.floor(total / 2);

    if (exercise.unilateral && !halfSpoken && elapsed > half && elapsed < half + 2) {
      halfSpoken = true;
      playSideCue();
    }

    if (elapsed >= total) {
      if (index < sequence.length - 1) {
        index += 1;
        elapsed = 0;
        paused = true;
        draw();
        setTimeout(() => { paused = false; draw(); }, 500);
      } else {
        completed = true;
        paused = true;
        stopVoice();
        showCompletionSheet = true;
        draw();
      }
      return;
    }
    updateTimerOnly();
  }

  function updateTimerOnly() {
    const timeEl = document.querySelector("[data-time]");
    const circleEl = document.querySelector("[data-progress-circle]");
    const sideEl = document.querySelector("[data-side-note]");
    if (!timeEl || !circleEl) return;
    const total = totalDuration();
    const remaining = Math.max(0, total - elapsed);
    timeEl.textContent = formatTime(remaining);
    const progress = total > 0 ? elapsed / total : 0;
    circleEl.setAttribute("stroke-dashoffset", String(RING_CIRCUMFERENCE * (1 - progress)));
    if (sideEl) {
      const exercise = currentExercise();
      const half = Math.floor(total / 2);
      if (exercise.unilateral) {
        sideEl.textContent = elapsed >= half ? "partea dreaptă, apoi gata" : "partea stângă, apoi partea dreaptă";
      }
    }
  }

  function handleSpeakOnEnter() {
    const exercise = currentExercise();
    if (!exercise || lastSpokenId === `${exercise.id}-${index}`) return;
    lastSpokenId = `${exercise.id}-${index}`;
    halfSpoken = false;
    setTimeout(() => playCue(exercise), 250);
  }

  async function handleResume() {
    index = Math.min(profile.inProgressExerciseIndex || 0, Math.max(0, sequence.length - 1));
    elapsed = profile.inProgressElapsedSeconds || 0;
    showResumeSheet = false;
    paused = true;
    lastSpokenId = null;
    draw();
  }

  async function handleStartFresh() {
    await updateProfile(profile.id, { inProgressExerciseIndex: null, inProgressElapsedSeconds: null, inProgressStartedAt: null });
    index = 0;
    elapsed = 0;
    showResumeSheet = false;
    paused = true;
    lastSpokenId = null;
    draw();
  }

  function handlePlayPause() {
    if (completed) return;
    paused = !paused;
    if (!paused) handleSpeakOnEnter();
    draw();
  }

  function handleNext() {
    if (index >= sequence.length - 1) return;
    stopVoice();
    index += 1;
    elapsed = 0;
    paused = true;
    lastSpokenId = null;
    draw();
  }

  function handlePrev() {
    if (index <= 0) return;
    stopVoice();
    index -= 1;
    elapsed = 0;
    paused = true;
    lastSpokenId = null;
    draw();
  }

  function handleReplace() {
    const exercise = currentExercise();
    const alts = exercise.alternateExerciseIds || [];
    if (!alts.length) return;
    const altId = alts[Math.floor(Math.random() * alts.length)];
    const altExercise = exerciseById(altId);
    if (!altExercise) return;
    stopVoice();
    sequence[index] = altExercise;
    elapsed = 0;
    lastSpokenId = null;
    draw();
  }

  async function handleExit() {
    stopVoice();
    clearTimers();
    await saveProgress();
    navigate("/home");
  }

  let selectedComfort = null;
  let selectedSleep = null;

  async function handleCompletionSave(skip) {
    const noteInput = document.getElementById("session-note");
    const note = skip ? "" : (noteInput?.value || "").slice(0, 500);
    try {
      await createSessionLog({
        date: new Date().toISOString(),
        weekNumber: profile.currentWeek,
        completed: true,
        comfortRating: skip ? null : selectedComfort,
        sleepQuality: skip ? null : selectedSleep,
        note,
      });
      const sessions = await listSessionLogs();
      const newStreak = computeNewStreak(profile.streakCount || 0, sessions);

      let newDayInWeek = (profile.currentDayInWeek || 0) + 1;
      let newWeek = profile.currentWeek || 1;
      if (newDayInWeek >= 7) {
        newWeek = Math.min(4, newWeek + 1);
        newDayInWeek = 0;
      }

      await updateProfile(profile.id, {
        streakCount: newStreak,
        bestStreak: Math.max(profile.bestStreak || 0, newStreak),
        currentWeek: newWeek,
        currentDayInWeek: newDayInWeek,
        inProgressExerciseIndex: null,
        inProgressElapsedSeconds: null,
        inProgressStartedAt: null,
      });
    } catch (e) { /* noop */ }
    navigate("/home");
  }

  function ratingDial(name, selected, onPick) {
    return `<div class="dial" data-dial="${name}">
      ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-value="${n}" class="${selected === n ? "is-selected" : ""}">${n}</button>`).join("")}
    </div>`;
  }

  function draw() {
    if (!sequence.length) {
      app.innerHTML = `<div class="loading-screen"><p class="empty-note">Nu am găsit exercițiile pentru această săptămână.</p></div>`;
      return;
    }
    const exercise = currentExercise();
    const total = totalDuration();
    const remaining = Math.max(0, total - elapsed);
    const progress = total > 0 ? elapsed / total : 0;

    app.innerHTML = `
      <div class="screen player">
        <div class="player-top">
          <button class="btn-icon" id="exit-btn" aria-label="Închide sesiunea">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <div style="text-align:center;">
            <p class="label">Sesiune</p>
            <p style="font-weight:700;">${index + 1} / ${sequence.length}</p>
          </div>
          <button class="btn-icon ${voiceEnabled ? "is-active" : ""}" id="voice-btn" aria-label="Comută vocea">
            ${voiceEnabled
              ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 9v6h4l5 4V5L9 9H5z" fill="currentColor"/></svg>'
              : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 9v6h4l5 4V5L9 9H5z" fill="currentColor"/><path d="M18 9l4 6M22 9l-4 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'}
          </button>
        </div>

        <div class="player-progress">
          ${sequence.map((_, i) => `<div class="seg ${i < index ? "is-done" : i === index ? "is-current" : ""}"></div>`).join("")}
        </div>

        <div class="player-illustration" id="illustration-wrap">
          <img src="${exerciseImageSrc(exercise.id)}" alt="" onerror="this.parentElement.style.display='none'" />
        </div>

        <div class="player-main">
          <div class="timer-ring">
            <div class="pulse-ring"></div>
            <svg width="220" height="220" viewBox="0 0 220 220">
              <circle cx="110" cy="110" r="${RING_RADIUS}" fill="none" stroke="var(--linen-line)" stroke-width="10" />
              <circle data-progress-circle cx="110" cy="110" r="${RING_RADIUS}" fill="none" stroke="var(--sage-deep)" stroke-width="10"
                stroke-linecap="round" stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${RING_CIRCUMFERENCE * (1 - progress)}" />
            </svg>
            <div class="center">
              <p class="label" data-side-note>${exercise.unilateral ? (elapsed >= Math.floor(total / 2) ? "partea dreaptă, apoi gata" : "partea stângă, apoi partea dreaptă") : "Timp rămas"}</p>
              <p class="time" data-time>${formatTime(remaining)}</p>
            </div>
          </div>

          <h2 class="exercise-name">${exercise.name}</h2>
          <p class="exercise-muscle">${exercise.targetMuscleGroup} <span class="place">· ${exercise.category === "pat" ? "din pat" : "de pe canapea"}</span></p>

          <div class="cue-note">
            <span class="eyebrow">o notă pentru tine</span>
            <p>„${exercise.voiceoverCue}"</p>
          </div>

          <div class="safety-note">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" stroke="currentColor" stroke-width="1.6"/></svg>
            <p>${exercise.safetyNote}</p>
          </div>
        </div>

        <div class="player-controls">
          <div class="transport">
            <button class="btn-icon" id="prev-btn" ${index === 0 ? "disabled" : ""} aria-label="Exercițiul anterior">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn-icon play-pause" id="play-btn" ${completed ? "disabled" : ""} aria-label="${paused ? "Pornește" : "Pauză"}">
              ${paused
                ? '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="currentColor"/></svg>'
                : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>'}
            </button>
            <button class="btn-icon" id="next-btn" ${index >= sequence.length - 1 ? "disabled" : ""} aria-label="Exercițiul următor">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          ${exercise.alternateExerciseIds?.length ? `
            <button class="btn btn-ghost" id="replace-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Înlocuire Sigură
            </button>
          ` : ""}
        </div>
      </div>

      ${showResumeSheet ? `
        <div class="sheet-backdrop">
          <div class="sheet">
            <h3>Sesiune în desfășurare</h3>
            <p style="color:var(--ink-soft)">Vrei să continui de unde ai rămas?</p>
            <div class="sheet-actions">
              <button class="btn btn-ghost" id="fresh-btn">Începe nou</button>
              <button class="btn btn-primary" id="resume-btn">Continuă</button>
            </div>
          </div>
        </div>
      ` : ""}

      ${showCompletionSheet ? `
        <div class="sheet-backdrop">
          <div class="sheet">
            <h3>Ai terminat. Frumos lucru.</h3>
            <div class="rating-row">
              <p class="label">Cât de confortabil s-a simțit corpul?</p>
              ${ratingDial("comfort", selectedComfort)}
            </div>
            <div class="rating-row">
              <p class="label">Cum a fost somnul azi-noapte?</p>
              ${ratingDial("sleep", selectedSleep)}
            </div>
            <textarea id="session-note" placeholder="O observație, opțional…" rows="2"
              style="width:100%; border-radius:12px; border:1px solid var(--linen-line); background:var(--linen-card); color:var(--ink); padding:10px 12px; font:inherit; resize:none;"></textarea>
            <div class="sheet-actions">
              <button class="btn btn-quiet" id="skip-save-btn">Sari peste</button>
              <button class="btn btn-primary" id="confirm-save-btn">Salvează</button>
            </div>
          </div>
        </div>
      ` : ""}
    `;

    document.getElementById("exit-btn").addEventListener("click", handleExit);
    document.getElementById("voice-btn").addEventListener("click", () => {
      voiceEnabled = !voiceEnabled;
      if (voiceEnabled) playCue(currentExercise()); else stopVoice();
      draw();
    });
    document.getElementById("prev-btn")?.addEventListener("click", handlePrev);
    document.getElementById("next-btn")?.addEventListener("click", handleNext);
    document.getElementById("play-btn")?.addEventListener("click", handlePlayPause);
    document.getElementById("replace-btn")?.addEventListener("click", handleReplace);
    document.getElementById("resume-btn")?.addEventListener("click", handleResume);
    document.getElementById("fresh-btn")?.addEventListener("click", handleStartFresh);

    document.querySelectorAll('[data-dial="comfort"] button').forEach((btn) => {
      btn.addEventListener("click", () => { selectedComfort = Number(btn.dataset.value); draw(); });
    });
    document.querySelectorAll('[data-dial="sleep"] button').forEach((btn) => {
      btn.addEventListener("click", () => { selectedSleep = Number(btn.dataset.value); draw(); });
    });
    document.getElementById("skip-save-btn")?.addEventListener("click", () => handleCompletionSave(true));
    document.getElementById("confirm-save-btn")?.addEventListener("click", () => handleCompletionSave(false));

    if (!showResumeSheet && !paused) handleSpeakOnEnter();
  }

  draw();
  startTimers();

  return () => {
    clearTimers();
    stopVoice();
  };
}
