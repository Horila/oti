import { getProfile } from "./supabase.js";
import { renderOnboarding } from "./views/onboarding.js";
import { renderHome } from "./views/home.js";
import { renderPlayer } from "./views/player.js";
import { renderProgress } from "./views/progress.js";

const app = document.getElementById("app");
let unmountCurrent = null;

export function navigate(path) {
  if (location.hash === `#${path}`) {
    render();
  } else {
    location.hash = path;
  }
}

async function render() {
  if (typeof unmountCurrent === "function") {
    try { unmountCurrent(); } catch (e) { /* noop */ }
    unmountCurrent = null;
  }

  let profile;
  try {
    profile = await getProfile();
  } catch (err) {
    app.innerHTML = `<div class="loading-screen"><p class="empty-note">Nu am putut încărca datele. Verifică conexiunea și reîncarcă pagina.</p></div>`;
    console.error(err);
    return;
  }

  let route = location.hash.replace(/^#/, "") || "/home";
  if (!profile.hasCompletedOnboarding && route !== "/onboarding") {
    route = "/onboarding";
    location.hash = "/onboarding";
    return; // hashchange will re-trigger render()
  }

  const ctx = { profile, navigate };

  try {
    if (route === "/onboarding") {
      unmountCurrent = await renderOnboarding(app, ctx);
    } else if (route === "/player") {
      unmountCurrent = await renderPlayer(app, ctx);
    } else if (route === "/progress") {
      unmountCurrent = await renderProgress(app, ctx);
    } else {
      unmountCurrent = await renderHome(app, ctx);
    }
  } catch (err) {
    app.innerHTML = `<div class="loading-screen"><p class="empty-note">Nu am putut încărca ecranul. Verifică conexiunea și reîncarcă pagina.</p></div>`;
    console.error(err);
  }
}

window.addEventListener("hashchange", render);
render();
