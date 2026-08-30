const CACHE_NAME = "lazybum-v5";

const EXERCISE_COUNT = 20;
const AUDIO_COUNT = 21;

function pad4(n) { return String(n).padStart(4, "0"); }

const SHELL_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/main.js",
  "./js/data.js",
  "./js/storage.js",
  "./js/views/home.js",
  "./js/views/onboarding.js",
  "./js/views/player.js",
  "./js/views/progress.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-512-maskable.png",
  ...Array.from({ length: EXERCISE_COUNT }, (_, i) => `./assets/exercises/${pad4(i + 1)}.png`),
  ...Array.from({ length: AUDIO_COUNT }, (_, i) => `./assets/audio/${pad4(i + 1)}.mp3`),
];

const RUNTIME_CACHE_ORIGINS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for our own static files (app shell + exercise images/audio),
// so the workout still plays smoothly on flaky wifi once assets are seen once.
// Profile/session data is all localStorage now — no network dependency at all.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !RUNTIME_CACHE_ORIGINS.includes(url.hostname)) return;

  event.respondWith(
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
  );
});
