import { listSessionLogs } from "../supabase.js";

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
    </div>
  `;

  return () => {};
}
