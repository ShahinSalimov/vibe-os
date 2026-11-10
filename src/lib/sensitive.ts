// Guards against storing payment data. VIBE OS is record-only: card numbers
// and IBANs must never be saved. Any free-text field is checked before save.

export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function ibanValid(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const value = code >= 65 ? String(code - 55) : ch;
    for (const digit of value) {
      remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}

/** Card-number candidates: 13-19 digits, optionally separated by spaces or dashes. */
function cardCandidates(text: string): string[] {
  const matches = text.match(/\d(?:[ -]?\d){12,18}/g) ?? [];
  return matches.map((m) => m.replace(/[ -]/g, ''));
}

function ibanCandidates(text: string): string[] {
  const matches = text.toUpperCase().match(/[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}/g) ?? [];
  return matches;
}

export type SensitiveKind = 'card' | 'iban';

/** Returns the kind of payment data found in the text, or null if clean. */
export function detectSensitive(text: string): SensitiveKind | null {
  if (!text) return null;
  for (const c of cardCandidates(text)) {
    if (c.length >= 13 && c.length <= 19 && luhnValid(c)) return 'card';
  }
  for (const c of ibanCandidates(text)) {
    if (ibanValid(c)) return 'iban';
  }
  return null;
}

/** Checks several fields at once; returns the first problem found. */
export function detectSensitiveIn(fields: string[]): SensitiveKind | null {
  for (const f of fields) {
    const hit = detectSensitive(f);
    if (hit) return hit;
  }
  return null;
}

/** Phone: digits, spaces, + ( ) -, 5..15 digits (E.164 max). Empty is allowed. Mirrors SQL valid_phone(). */
export function validPhone(p: string): boolean {
  const s = p.trim();
  if (s === '') return true;
  if (!/^[+0-9 ()-]{3,20}$/.test(s)) return false;
  const digits = s.replace(/\D/g, '').length;
  return digits >= 5 && digits <= 15;
}
