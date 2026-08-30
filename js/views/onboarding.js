import { ONBOARDING_SLIDES } from "../data.js";
import { updateProfile } from "../storage.js";

export async function renderOnboarding(app, { profile, navigate }) {
  let index = 0;
  let errorMsg = "";

  function draw() {
    const slide = ONBOARDING_SLIDES[index];
    const isLast = index === ONBOARDING_SLIDES.length - 1;

    app.innerHTML = `
      <div class="screen onboarding">
        <div class="dots">
          ${ONBOARDING_SLIDES.map((_, i) => `<span class="dot ${i === index ? "is-active" : ""}"></span>`).join("")}
        </div>
        <div class="onboarding-slide" key="${slide.order}">
          <h1>${slide.title}</h1>
          <p class="body">${slide.body}</p>
          ${slide.bullets.length ? `<ul>${slide.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
        </div>
        ${errorMsg ? `<p style="color:var(--clay-deep); text-align:center;">${errorMsg}</p>` : ""}
        <div class="onboarding-nav">
          <button class="btn btn-quiet" id="skip-btn" ${index === 0 ? "style=\"visibility:hidden\"" : ""}>Înapoi</button>
          <button class="btn btn-primary" id="next-btn">${isLast ? "Începe" : "Continuă"}</button>
        </div>
      </div>
    `;

    document.getElementById("skip-btn").addEventListener("click", () => {
      if (index > 0) { index -= 1; draw(); }
    });
    document.getElementById("next-btn").addEventListener("click", async () => {
      if (isLast) {
        try {
          await updateProfile(profile.id, { hasCompletedOnboarding: true });
          navigate("/home");
        } catch (e) {
          errorMsg = "Nu am putut salva. Verifică internetul și încearcă din nou.";
          draw();
        }
      } else {
        index += 1;
        draw();
      }
    });
  }

  draw();
  return () => {};
}
