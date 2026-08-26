import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dcaeetbbufwsbpdhsnhy.supabase.co";
const SUPABASE_KEY = "sb_publishable_WufbIxfaujFYDbxcQgov4A_UWAHcgKn";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function toCamelProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    currentWeek: row.current_week,
    currentDayInWeek: row.current_day_in_week,
    streakCount: row.streak_count,
    hasCompletedOnboarding: row.has_completed_onboarding,
    inProgressExerciseIndex: row.in_progress_exercise_index,
    inProgressElapsedSeconds: row.in_progress_elapsed_seconds,
    inProgressStartedAt: row.in_progress_started_at,
    bestStreak: row.best_streak,
    lastCelebratedMilestone: row.last_celebrated_milestone,
  };
}

function toSnakeProfilePatch(patch) {
  const map = {
    currentWeek: "current_week",
    currentDayInWeek: "current_day_in_week",
    streakCount: "streak_count",
    hasCompletedOnboarding: "has_completed_onboarding",
    inProgressExerciseIndex: "in_progress_exercise_index",
    inProgressElapsedSeconds: "in_progress_elapsed_seconds",
    inProgressStartedAt: "in_progress_started_at",
    bestStreak: "best_streak",
    lastCelebratedMilestone: "last_celebrated_milestone",
  };
  const out = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) {
    out[map[k] ?? k] = v;
  }
  return out;
}

export async function getProfile() {
  const { data, error } = await supabase.from("nesta_profile").select("*").limit(1).single();
  if (error) throw error;
  return toCamelProfile(data);
}

export async function updateProfile(id, patch) {
  const { data, error } = await supabase
    .from("nesta_profile")
    .update(toSnakeProfilePatch(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toCamelProfile(data);
}

export async function listSessionLogs() {
  const { data, error } = await supabase
    .from("nesta_session_log")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    date: row.date,
    weekNumber: row.week_number,
    completed: row.completed,
    comfortRating: row.comfort_rating,
    sleepQuality: row.sleep_quality,
    note: row.note,
  }));
}

export async function createSessionLog(entry) {
  const { error } = await supabase.from("nesta_session_log").insert({
    date: entry.date ?? new Date().toISOString(),
    week_number: entry.weekNumber,
    completed: entry.completed ?? true,
    comfort_rating: entry.comfortRating ?? null,
    sleep_quality: entry.sleepQuality ?? null,
    note: entry.note ?? null,
  });
  if (error) throw error;
}

export async function getLatestWeeklyCheckin() {
  const { data, error } = await supabase
    .from("nesta_weekly_checkin")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? data.date : null;
}

export async function createWeeklyCheckin(entry) {
  const { error } = await supabase.from("nesta_weekly_checkin").insert({
    date: new Date().toISOString(),
    mobility: entry.mobility ?? null,
    mood: entry.mood ?? null,
    stress: entry.stress ?? null,
    energy: entry.energy ?? null,
    discomfort: entry.discomfort ?? null,
    note: entry.note ?? null,
  });
  if (error) throw error;
}

export function computeNewStreak(currentStreak, sessionLogs) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedDates = sessionLogs
    .filter((s) => s.completed)
    .map((s) => new Date(s.date))
    .sort((a, b) => b - a);
  if (completedDates.length === 0) return 1;
  const mostRecent = new Date(completedDates[0]);
  mostRecent.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((today - mostRecent) / (1000 * 60 * 60 * 24));
  if (dayDiff === 0) return Math.max(1, currentStreak);
  if (dayDiff === 1) return (currentStreak || 0) + 1;
  return 1;
}
