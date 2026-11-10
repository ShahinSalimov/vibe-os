import { getClient } from './client';

export type AuthResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (e: string) => EMAIL_RE.test(e.trim());

/** Sends a 6-digit one-time code to the email. Creates the account on first use. */
export async function sendCode(email: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: 'not_configured' };
  const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function verifyCode(email: string, code: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: 'not_configured' };
  const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function currentUserEmail(): Promise<string | null> {
  const sb = getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.email ?? null;
}

export async function signOut(): Promise<void> {
  const sb = getClient();
  if (sb) await sb.auth.signOut();
}
