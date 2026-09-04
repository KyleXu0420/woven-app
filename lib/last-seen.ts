// "Since you were away" needs an away, and nothing in the data knows when the viewer was last here. The page
// keeps it itself: one writer (the shell, on leaving — see components/seen-stamp.tsx) and any number of
// readers. A reader that also wrote would hand the next reader a zero-length window.
const KEY = "woven:lastSeenAt";
const DAY = 24 * 60;

export function readLastSeen(): Date | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null; // private mode or blocked storage: a first visit
  }
}

export function markSeen(now = new Date()): void {
  try {
    localStorage.setItem(KEY, now.toISOString());
  } catch {
    // nothing to do: the next visit reads as a first visit
  }
}

// the window in minutes; a first visit covers the last day and says so
export function windowMinutes(since: Date | null, now = new Date()): number {
  return since ? Math.max(1, Math.round((now.getTime() - since.getTime()) / 60000)) : DAY;
}

// "yesterday" is a calendar day, not a 24-hour block: 18:40 last night is yesterday at 10:00 this morning
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function windowLabel(since: Date | null, now = new Date()): string {
  if (!since) return "the last 24 hours";
  const days = Math.round((dayStart(now) - dayStart(since)) / 86400000);
  const time = since.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  if (days === 0) return `since ${time} today`;
  if (days === 1) return `since ${time} yesterday`;
  return `since ${since.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, ${days} days away`;
}
