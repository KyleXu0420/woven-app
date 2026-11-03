// "Since you were away" needs an away, and nothing in the data knows when the viewer was last here. The page
// keeps it itself: one writer (the shell, on leaving — components/seen-stamp.tsx) and any number of readers.
//
// "Away" is a session gap, not a page change: the shell stamps every leave, so a viewer who opens the Inbox
// and comes back, or switches tabs for two minutes, has a stamp from moments ago. The reader treats a stamp
// younger than SESSION_GAP as the same session and keeps the window it opened with (the end of the previous
// session); a stamp older than that starts a new session and becomes the window. Two keys, one rule.
const LAST_SEEN = "woven:lastSeenAt";
const SESSION_SINCE = "woven:sessionSince";
const SESSION_GAP = 30 * 60 * 1000;
const DAY = 24 * 60;

export type Store = { get(key: string): string | null; set(key: string, value: string): void };
const browserStore: Store = {
  get: (k) => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
};
const safe = (store: Store, fn: () => void) => {
  try {
    fn();
  } catch {
    // private mode or blocked storage: behaves as a first visit
  }
  void store;
};
const readDate = (store: Store, key: string): Date | null => {
  let d: Date | null = null;
  safe(store, () => {
    const raw = store.get(key);
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) d = parsed;
    }
  });
  return d;
};

export function markSeen(now = new Date(), store: Store = browserStore): void {
  safe(store, () => store.set(LAST_SEEN, now.toISOString()));
}

// the window the digest covers — the end of the previous session — or null on a first visit
export function readWindow(now = new Date(), store: Store = browserStore): Date | null {
  const lastSeen = readDate(store, LAST_SEEN);
  if (!lastSeen) return null;
  if (now.getTime() - lastSeen.getTime() > SESSION_GAP) {
    // a new session: the window is where the last one ended; remember it for this session's later reads
    safe(store, () => store.set(SESSION_SINCE, lastSeen.toISOString()));
    return lastSeen;
  }
  return readDate(store, SESSION_SINCE) ?? lastSeen;
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
