import { listSessionLogs, listWeeklyCheckins } from "../supabase.js";
import { BADGES } from "../data.js";

const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function dotScale(label, value) {
  return `
    <div class="dot-scale">
      <span>${label}</span>
      <span class="dots-5">
        ${[1, 2, 3, 4, 5].map((n) => `<span class="${value && n <= value ? "is-filled" : ""}"></span>`).join("")}
      </span>
    </div>
  `;
}

export async function renderProgress(app, { profile, navigate }) {
  const sessions = await listSessionLogs();

  app.innerHTML = `
    <div class="screen">
      <a href="#/home" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Înapoi
      </a>

      <header class="progress-header">
        <p class="label">Reflecție</p>
        <h1>Parcursul tău blând</h1>
        ${profile.streakCount > 0
          ? `<p style="color:var(--ink-soft)">Ai construit un ritm frumos de ${profile.streakCount} ${profile.streakCount === 1 ? "zi" : "zile"}.</p>`
          : `<p style="color:var(--ink-soft)">Fiecare zi de aici înainte contează, exact așa cum e.</p>`}
      </header>

      <section>
        <h3 style="font-size:1.05rem; margin-bottom:12px;">Realizări</h3>
        <div class="badge-row">
          ${BADGES.map((b) => {
            const earned = (profile.bestStreak || 0) >= b.milestone;
            return `
              <div class="badge-item ${earned ? "is-earned" : ""}" title="${b.title}">
                <div class="badge-circle">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.6 6.2L21 9l-5 4.5L17.4 21 12 17.3 6.6 21 8 13.5 3 9l6.4-.8L12 2z" fill="currentColor"/></svg>
                </div>
                <span class="badge-label">${b.label}</span>
              </div>
            `;
          }).join("")}
        </div>
      </section>

      <div class="card" style="padding:6px 20px;">
        ${sessions.length === 0
          ? `<p class="empty-note">Încă nu ai o sesiune notată aici. Prima ta rutină va apărea în acest loc, blând, fără presiune.</p>`
          : sessions.map((s) => {
              const d = new Date(s.date);
              return `
                <div class="session-entry">
                  <div class="session-date-badge">
                    <span class="day">${d.getDate()}</span>
                    <span class="mon">${MONTHS[d.getMonth()]}</span>
                  </div>
                  <div class="session-detail">
                    <p style="font-weight:700;">Săptămâna ${s.weekNumber}</p>
                    ${dotScale("Confort", s.comfortRating)}
                    ${dotScale("Somn", s.sleepQuality)}
                    ${s.note ? `<p class="session-note">„${escapeHtml(s.note)}"</p>` : ""}
                  </div>
                </div>
              `;
            }).join("")}
      </div>

      <button class="btn btn-quiet" id="export-btn" style="align-self:center;">
        Descarcă o copie a datelor tale
      </button>
    </div>
  `;

  document.getElementById("export-btn").addEventListener("click", async () => {
    const checkins = await listWeeklyCheckins();
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        currentWeek: profile.currentWeek,
        streakCount: profile.streakCount,
        bestStreak: profile.bestStreak,
      },
      sessions,
      weeklyCheckins: checkins,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nesta-flow-date-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  return () => {};
}
