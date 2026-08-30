// Local-only storage: no Supabase, no network, no shared project database.
// This app's data was previously living in the foundry core-counting app's
// Supabase project (lazybum_* tables) — moved here so it stays on this
// phone only. Same exported function names/shapes as the old supabase.js,
// so main.js and every view file needed zero changes beyond the import path.

const PROFILE_KEY = "lazybum_profile";
const SESSION_LOG_KEY = "lazybum_session_log";
const WEEKLY_CHECKIN_KEY = "lazybum_weekly_checkin";

// Seeded once from the last known state in Supabase, so the first load
// after this migration doesn't reset progress back to day one.
const DEFAULT_PROFILE = {
  id: "d713a53c-449a-4ce1-912d-566364863683",
  currentWeek: 1,
  currentDayInWeek: 0,
  streakCount: 0,
  hasCompletedOnboarding: true,
  inProgressExerciseIndex: 5,
  inProgressElapsedSeconds: 0,
  inProgressStartedAt: "2026-08-27T18:09:08.628Z",
  bestStreak: 0,
  lastCelebratedMilestone: 0,
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function getProfile() {
  let profile = readJson(PROFILE_KEY, null);
  if (!profile) {
    profile = { ...DEFAULT_PROFILE };
    writeJson(PROFILE_KEY, profile);
  }
  return profile;
}

export async function updateProfile(id, patch) {
  const profile = await getProfile();
  const updated = { ...profile, ...patch };
  writeJson(PROFILE_KEY, updated);
  return updated;
}

export async function listSessionLogs() {
  const logs = readJson(SESSION_LOG_KEY, []);
  return [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function createSessionLog(entry) {
  const logs = readJson(SESSION_LOG_KEY, []);
  logs.push({
    id: crypto.randomUUID(),
    date: entry.date ?? new Date().toISOString(),
    weekNumber: entry.weekNumber,
    completed: entry.completed ?? true,
    comfortRating: entry.comfortRating ?? null,
    sleepQuality: entry.sleepQuality ?? null,
    note: entry.note ?? null,
  });
  writeJson(SESSION_LOG_KEY, logs);
}

export async function getLatestWeeklyCheckin() {
  const checkins = readJson(WEEKLY_CHECKIN_KEY, []);
  if (!checkins.length) return null;
  return checkins.reduce((latest, c) => (new Date(c.date) > new Date(latest.date) ? c : latest)).date;
}

export async function listWeeklyCheckins() {
  const checkins = readJson(WEEKLY_CHECKIN_KEY, []);
  return [...checkins].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function createWeeklyCheckin(entry) {
  const checkins = readJson(WEEKLY_CHECKIN_KEY, []);
  checkins.push({
    date: new Date().toISOString(),
    mobility: entry.mobility ?? null,
    mood: entry.mood ?? null,
    stress: entry.stress ?? null,
    energy: entry.energy ?? null,
    discomfort: entry.discomfort ?? null,
    note: entry.note ?? null,
  });
  writeJson(WEEKLY_CHECKIN_KEY, checkins);
}

function toLocalMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isCompletedToday(sessionLogs) {
  const today = toLocalMidnight(new Date());
  return sessionLogs.some((s) => s.completed && toLocalMidnight(s.date).getTime() === today.getTime());
}

export function computeNewStreak(currentStreak, sessionLogs) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedDates = sessionLogs
    .filter((s) => s.completed)
    .map((s) => new Date(s.date))
    .filter((d) => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      return date.getTime() < today.getTime();
    })
    .sort((a, b) => b - a);
  if (completedDates.length === 0) return 1;
  const mostRecent = new Date(completedDates[0]);
  mostRecent.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((today - mostRecent) / (1000 * 60 * 60 * 24));
  if (dayDiff === 1) return (currentStreak || 0) + 1;
  return 1;
}
