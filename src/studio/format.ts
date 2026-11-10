import type { Setlist, Song } from '../lib/types';

/** 215 -> "3:35", 3725 -> "1:02:05" */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** "3:35" -> 215, "215" -> 215 (seconds), "" -> null, invalid -> undefined */
export function parseDuration(input: string): number | null | undefined {
  const t = input.trim();
  if (!t) return null;
  if (/^\d{1,4}$/.test(t)) return Number(t);
  const m = t.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Total length of a setlist; songs without a duration are counted separately. */
export function setlistTotals(list: Setlist, songs: Song[]): { seconds: number; unknown: number; count: number } {
  const byId = new Map(songs.map((s) => [s.id, s]));
  let seconds = 0;
  let unknown = 0;
  let count = 0;
  for (const id of list.songIds) {
    const s = byId.get(id);
    if (!s) continue;
    count++;
    if (s.durationSec) seconds += s.durationSec;
    else unknown++;
  }
  return { seconds, unknown, count };
}

/** Moves an item in an array; returns a new array (out-of-range moves are no-ops). */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return arr;
  const out = arr.slice();
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}
