import { getProfile } from "./supabase.js";
import { renderOnboarding } from "./views/onboarding.js";
import { renderHome } from "./views/home.js";
import { renderPlayer } from "./views/player.js";
import { renderProgress } from "./views/progress.js";

const app = document.getElementById("app");
let unmountCurrent = null;
let renderToken = 0;

export function navigate(path) {
  if (location.hash === `#${path}`) {
    render();
  } else {
    location.hash = path;
  }
}

async function render() {
  const currentToken = ++renderToken;

  if (typeof unmountCurrent === "function") {
    try { await unmountCurrent(); } catch (e) { /* noop */ }
    unmountCurrent = null;
  }

  let profile;
  try {
    profile = await getProfile();
  } catch (err) {
    if (currentToken !== renderToken) return;
    app.innerHTML = `<div class="loading-screen"><p class="empty-note">Nu am putut încărca datele. Verifică conexiunea și reîncarcă pagina.</p></div>`;
    console.error(err);
    return;
  }

  if (currentToken !== renderToken) return;

  let route = location.hash.replace(/^#/, "") || "/home";
  if (!profile.hasCompletedOnboarding && route !== "/onboarding") {
    route = "/onboarding";
    location.hash = "/onboarding";
    return; // hashchange will re-trigger render()
  }

  const ctx = { profile, navigate };

  try {
    let unmount;
    if (route === "/onboarding") {
      unmount = await renderOnboarding(app, ctx);
    } else if (route === "/player") {
      unmount = await renderPlayer(app, ctx);
    } else if (route === "/progress") {
      unmount = await renderProgress(app, ctx);
    } else {
      unmount = await renderHome(app, ctx);
    }

    if (currentToken !== renderToken) {
      try { unmount?.(); } catch (e) { /* noop */ }
      return;
    }
    unmountCurrent = unmount;
  } catch (err) {
    if (currentToken !== renderToken) return;
    app.innerHTML = `<div class="loading-screen"><p class="empty-note">Nu am putut încărca ecranul. Verifică conexiunea și reîncarcă pagina.</p></div>`;
    console.error(err);
  }
}

window.addEventListener("hashchange", render);
render();
