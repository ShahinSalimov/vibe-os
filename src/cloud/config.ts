// Cloud settings come from public Expo env vars (.env). The anon key is public by design:
// all protection is enforced by Row Level Security in supabase/migrations.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const BOOKING_PAGE_URL = process.env.EXPO_PUBLIC_BOOKING_PAGE_URL ?? '';

export const isCloudConfigured = () => SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;

export function bookingLink(slug: string | null): string | null {
  if (!slug || !BOOKING_PAGE_URL) return null;
  const sep = BOOKING_PAGE_URL.includes('?') ? '&' : '?';
  return `${BOOKING_PAGE_URL}${sep}a=${encodeURIComponent(slug)}`;
}
