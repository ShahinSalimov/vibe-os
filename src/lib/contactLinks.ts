// tel: / WhatsApp / mailto links from user-typed phone numbers.

/** Converts a typed phone into international digits (no '+'), or null if unusable. */
export function internationalDigits(phone: string): string | null {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  // Azerbaijan local mobile: 0XX XXX XX XX (10 digits)
  if (digits.length === 10 && digits.startsWith('0')) return `994${digits.slice(1)}`;
  // Russia/Kazakhstan local: 8 9XX XXX XX XX (11 digits)
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

export function telUrl(phone: string): string | null {
  const d = internationalDigits(phone);
  return d ? `tel:+${d}` : null;
}

export function whatsappUrl(phone: string, text?: string): string | null {
  const d = internationalDigits(phone);
  if (!d) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function mailtoUrl(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? `mailto:${email.trim()}` : null;
}
