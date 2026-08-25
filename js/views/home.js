import { HABITS, DISCLAIMER, weekProgram } from "../data.js";
import { listSessionLogs, updateProfile } from "../supabase.js";

function streakMessage(streak, lastCompletedDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lastCompletedDate) {
    const last = new Date(lastCompletedDate);
    last.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) return "Bine ai revenit. Astăzi este un nou început blând.";
  }
  if (!streak) return "Încă nu am început — astăzi este un moment bun.";
  if (streak === 1) return "Prima ta zi. Corpul tău va simți diferența blând.";
  if (streak <= 3) return "Un început blând. Fiecare zi contează.";
  if (streak <= 6) return `Construiești un ritm frumos de ${streak} zile.`;
  if (streak <= 13) return `Ești într-o prezență constantă de ${streak} zile. Corpul observă.`;
  return `Ai făcut din asta o parte din tine — ${streak} zile.`;
}

export async function renderHome(app, { profile, navigate }) {
  const sessions = await listSessionLogs();
  const lastCompleted = sessions.find((s) => s.completed);
  const hasInProgress = profile.inProgressExerciseIndex !== null && profile.inProgressExerciseIndex !== undefined;
  const wp = weekProgram(profile.currentWeek);

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
        </div>
      ` : ""}

      <button class="cta-card" id="start-btn">
        <div class="pulse-wrap">
          <div class="pulse-ring"></div>
          <div class="play-glyph">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="#fff"/></svg>
          </div>
        </div>
        <h2>Rutina de 8 minute</h2>
        <p class="sub">Săptămâna ${wp.week}: ${wp.phaseName}</p>
        <p class="fine">Blând, scurt, fără grabă.</p>
      </button>

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
  `;

  document.getElementById("start-btn").addEventListener("click", () => navigate("/player"));
  document.getElementById("resume-btn")?.addEventListener("click", () => navigate("/player"));
  document.getElementById("discard-btn")?.addEventListener("click", async () => {
    await updateProfile(profile.id, {
      inProgressExerciseIndex: null,
      inProgressElapsedSeconds: null,
      inProgressStartedAt: null,
    });
    navigate("/home");
  });

  return () => {};
}
