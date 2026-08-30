import { HABITS, DISCLAIMER, weekProgram, BADGES, newlyEarnedBadge, WEEKLY_QUESTIONS } from "../data.js";
import { listSessionLogs, updateProfile, getLatestWeeklyCheckin, createWeeklyCheckin } from "../storage.js";

function streakMessage(streak, lastCompletedDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lastCompletedDate) {
    const last = new Date(lastCompletedDate);
    last.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) return "Bine ai revenit. Astăzi este un nou început blând.";
  }
  if (!streak) return "Încă nu am început — astăzi este un moment bun.";
  if (streak === 1) return "Prima ta zi. Corpul tău va simți diferența blând.";
  if (streak <= 3) return "Un început blând. Fiecare zi contează.";
  if (streak <= 6) return `Construiești un ritm frumos de ${streak} zile.`;
  if (streak <= 13) return `Ești într-o prezență constantă de ${streak} zile. Corpul observă.`;
  return `Ai făcut din asta o parte din tine — ${streak} zile.`;
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const then = new Date(dateStr);
  then.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today - then) / (1000 * 60 * 60 * 24));
}

export async function renderHome(app, { profile, navigate }) {
  const sessions = await listSessionLogs();
  const lastCompleted = sessions.find((s) => s.completed);
  const hasInProgress = profile.inProgressExerciseIndex !== null && profile.inProgressExerciseIndex !== undefined;
  const wp = weekProgram(profile.currentWeek);
  const lastCheckinDate = await getLatestWeeklyCheckin();
  const showWeeklyCard = daysSince(lastCheckinDate) >= 7;
  const badgeToCelebrate = newlyEarnedBadge(profile.bestStreak || 0, profile.lastCelebratedMilestone || 0);

  let showWeeklySheet = false;
  let showCelebration = !!badgeToCelebrate;
  let weeklyCardDismissed = false;
  let weeklyError = "";
  let resumeError = "";
  const answers = {};

  function dial(key) {
    return `<div class="dial" data-key="${key}" role="radiogroup" aria-label="${key}">
      ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${answers[key] === n}" aria-label="${n}" data-value="${n}" class="${answers[key] === n ? "is-selected" : ""}">${n}</button>`).join("")}
    </div>`;
  }

  function draw() {
    app.innerHTML = `
      <div class="screen">
        <header class="home-header">
          <p class="label">Sanctuarul tău</p>
          <h1>Bun venit înapoi.</h1>
          <p style="color:var(--ink-soft)">${streakMessage(profile.streakCount, lastCompleted?.date)}</p>
          ${profile.streakCount > 0 ? `<span class="streak-chip">✦ ${profile.streakCount} ${profile.streakCount === 1 ? "zi" : "zile"} consecutive</span>` : ""}
        </header>

        ${hasInProgress ? `
          <div class="resume-card">
            <div>
              <p style="font-weight:700; margin-bottom:4px;">Ai o sesiune în desfășurare</p>
              <p style="opacity:.9">Vrei să continui de unde ai rămas?</p>
            </div>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-ghost" id="resume-btn" style="flex:1;">Continuă</button>
              <button class="btn btn-quiet" id="discard-btn">Începe una nouă</button>
            </div>
            ${resumeError ? `<p style="color:var(--clay-deep); margin-top:8px;">${resumeError}</p>` : ""}
          </div>
        ` : ""}

        <button class="cta-card" id="start-btn">
          <div class="pulse-wrap">
            <div class="pulse-ring"></div>
            <div class="play-glyph">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="#fff"/></svg>
            </div>
          </div>
          <span class="cta-title">Rutina de 8 minute</span>
          <p class="sub">Săptămâna ${wp.week}: ${wp.phaseName}</p>
          <p class="fine">Blând, scurt, fără grabă.</p>
        </button>

        ${showWeeklyCard && !weeklyCardDismissed ? `
          <div class="card" style="border-color:var(--sage); background:var(--sage-pale);">
            <p class="eyebrow" style="display:block; margin-bottom:6px;">o pauză de reflecție</p>
            <p style="font-weight:700; margin-bottom:4px;">Un mic bilanț săptămânal</p>
            <p style="color:var(--ink-soft); margin-bottom:14px;">Câteva întrebări scurte, ca să vezi cum evoluezi în timp.</p>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-primary" id="weekly-start-btn" style="flex:1;">Completează</button>
              <button class="btn btn-quiet" id="weekly-skip-btn">Poate mai târziu</button>
            </div>
          </div>
        ` : ""}

        <a href="#/progress" class="card list-link">
          <div>
            <p class="title">Reflecție</p>
            <p class="sub">Vezi parcursul tău blând</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>

        <section>
          <div class="habits-row">
            <h3 style="font-size:1.05rem;">Obiceiuri blânde</h3>
            <span class="eyebrow">opțional</span>
          </div>
          <div class="habit-strip" style="margin-top:12px;">
            ${HABITS.map((h) => `
              <div class="habit-tile">
                <p class="title">${h.title}</p>
                <p class="body">${h.body}</p>
              </div>
            `).join("")}
          </div>
        </section>

        <p class="disclaimer">${DISCLAIMER}</p>
      </div>

      ${showWeeklySheet ? `
        <div class="sheet-backdrop">
          <div class="sheet">
            <h3>Bilanțul tău săptămânal</h3>
            ${WEEKLY_QUESTIONS.map((q) => `
              <div class="rating-row">
                <p class="label">${q.label}</p>
                ${dial(q.key)}
              </div>
            `).join("")}
            ${weeklyError ? `<p style="color:var(--clay-deep);">${weeklyError}</p>` : ""}
            <div class="sheet-actions">
              <button class="btn btn-quiet" id="weekly-cancel-btn">Închide</button>
              <button class="btn btn-primary" id="weekly-save-btn">Salvează</button>
            </div>
          </div>
        </div>
      ` : ""}

      ${showCelebration && badgeToCelebrate ? `
        <div class="sheet-backdrop">
          <div class="sheet" style="align-items:center; text-align:center;">
            <div class="pulse-wrap" style="width:88px; height:88px; margin:0 auto;">
              <div class="pulse-ring" style="width:88px; height:88px;"></div>
              <div style="position:relative; z-index:1; width:88px; height:88px; border-radius:50%; background:var(--sage-deep); display:grid; place-items:center;">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.6 6.2L21 9l-5 4.5L17.4 21 12 17.3 6.6 21 8 13.5 3 9l6.4-.8L12 2z" fill="white"/></svg>
              </div>
            </div>
            <p class="eyebrow">${badgeToCelebrate.label}</p>
            <h3>${badgeToCelebrate.title}</h3>
            <p style="color:var(--ink-soft);">${badgeToCelebrate.body}</p>
            <button class="btn btn-primary" id="celebration-close-btn" style="width:100%;">Mulțumesc</button>
          </div>
        </div>
      ` : ""}
    `;

    document.getElementById("start-btn").addEventListener("click", () => navigate("/player"));
    document.getElementById("resume-btn")?.addEventListener("click", () => navigate("/player"));
    document.getElementById("discard-btn")?.addEventListener("click", async () => {
      try {
        await updateProfile(profile.id, {
          inProgressExerciseIndex: null,
          inProgressElapsedSeconds: null,
          inProgressStartedAt: null,
        });
        navigate("/home");
      } catch (e) {
        resumeError = "Nu am putut salva. Încearcă din nou.";
        draw();
      }
    });

    document.getElementById("weekly-start-btn")?.addEventListener("click", () => { showWeeklySheet = true; draw(); });
    document.getElementById("weekly-skip-btn")?.addEventListener("click", () => { weeklyCardDismissed = true; draw(); });
    document.getElementById("weekly-cancel-btn")?.addEventListener("click", () => { showWeeklySheet = false; draw(); });
    document.getElementById("weekly-save-btn")?.addEventListener("click", async () => {
      try {
        await createWeeklyCheckin(answers);
        navigate("/home");
      } catch (e) {
        weeklyError = "Nu am putut salva. Verifică internetul și încearcă din nou.";
        draw();
      }
    });
    document.querySelectorAll(".sheet .dial").forEach((el) => {
      el.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          answers[el.dataset.key] = Number(btn.dataset.value);
          draw();
        });
      });
    });

    document.getElementById("celebration-close-btn")?.addEventListener("click", async () => {
      showCelebration = false;
      await updateProfile(profile.id, { lastCelebratedMilestone: badgeToCelebrate.milestone });
      draw();
    });
  }

  draw();
  return () => {};
}
