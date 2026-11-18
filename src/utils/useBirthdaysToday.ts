import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { BASE_HOST } from "../constants/config";

// Today's birthdays from the Celebrations API (GET /api/celebrations -> birthdaysToday).
// Shared by the once-a-day popup (App.tsx) and the Home card, with a small cache so both make one call.

export type BirthdayPerson = { empId: string; name: string; department?: string | null };
export type BirthdaysToday = { today: string; people: BirthdayPerson[] };

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; data: BirthdaysToday } | null = null;
let inflight: Promise<BirthdaysToday | null> | null = null;

function localYmd(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fresh(): boolean {
  return !!cache && Date.now() - cache.at < TTL_MS && cache.data.today === localYmd();
}

async function load(force = false): Promise<BirthdaysToday | null> {
  if (!force && fresh()) return cache!.data;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${BASE_HOST}/api/celebrations`, { cache: "no-store" });
      if (!res.ok) return cache?.data ?? null;
      const j: any = await res.json();
      const people: BirthdayPerson[] = (Array.isArray(j?.birthdaysToday) ? j.birthdaysToday : [])
        .filter((p: any) => p?.empId)
        .map((p: any) => ({ empId: String(p.empId), name: String(p.name || p.empId), department: p.department ?? null }));
      const data: BirthdaysToday = { today: String(j?.today || localYmd()), people };
      cache = { at: Date.now(), data };
      return data;
    } catch {
      return cache?.data ?? null; // offline: keep what we had
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** "Raju", "Raju and Priya", "Raju, Priya and Kumar", "Raju, Priya and 3 others" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

export function useBirthdaysToday(enabled = true) {
  const [data, setData] = useState<BirthdaysToday | null>(fresh() ? cache!.data : null);

  const refresh = useCallback(async (force = false) => {
    const d = await load(force);
    if (d) setData(d);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    // back in the app (maybe the next day): the cache decides whether to ask again
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [enabled, refresh]);

  return { data, refresh };
}
