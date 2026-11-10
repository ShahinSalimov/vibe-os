// Printable A4 HTML for contracts and riders (rendered to PDF by expo-print).
// Every user string is escaped: the document is built from user input.
import type { RiderSection } from '../lib/types';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111; font-size: 12pt; line-height: 1.5; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  .sub { color: #555; font-size: 10pt; margin-bottom: 14pt; }
  .body p { margin: 0 0 8pt; white-space: pre-wrap; }
  .body p.h { font-weight: 700; margin-top: 12pt; }
  h2 { font-size: 13pt; margin: 14pt 0 4pt; border-bottom: 1px solid #ddd; padding-bottom: 2pt; }
  ul { margin: 0; padding-left: 16pt; }
  li { margin: 2pt 0; }
  .notes { margin-top: 14pt; white-space: pre-wrap; }
  .foot { margin-top: 24pt; color: #888; font-size: 9pt; }
`;

function page(title: string, inner: string, lang: string): string {
  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body>${inner}</body></html>`;
}

/** Contract text -> paragraphs. Lines like "3. Fee" become bold headings. The first line is the title. */
export function contractHtml(body: string, lang: string): string {
  const blocks = body.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const [first, ...rest] = blocks;
  const title = (first ?? '').trim();
  const paras = rest
    .map((b) => {
      const lines = b.split('\n');
      const isHeading = /^\d+\.\s+\S/.test(lines[0] ?? '');
      if (isHeading) {
        const [h, ...more] = lines;
        return `<p class="h">${escapeHtml(h)}</p>${more.length ? `<p>${escapeHtml(more.join('\n'))}</p>` : ''}`;
      }
      return `<p>${escapeHtml(b)}</p>`;
    })
    .join('');
  return page(title, `<h1>${escapeHtml(title)}</h1><div class="body">${paras}</div>`, lang);
}

export function riderHtml(opts: {
  title: string;
  artist: string;
  sections: RiderSection[];
  notes: string;
  lang: string;
  contact?: string;
}): string {
  const secs = opts.sections
    .filter((s) => s.items.some((i) => i.trim()))
    .map(
      (s) =>
        `<h2>${escapeHtml(s.title)}</h2><ul>${s.items
          .filter((i) => i.trim())
          .map((i) => `<li>${escapeHtml(i)}</li>`)
          .join('')}</ul>`,
    )
    .join('');
  const notes = opts.notes.trim() ? `<div class="notes">${escapeHtml(opts.notes)}</div>` : '';
  const contact = opts.contact ? `<div class="foot">${escapeHtml(opts.contact)}</div>` : '';
  return page(
    `${opts.title} — ${opts.artist}`,
    `<h1>${escapeHtml(opts.title)}</h1><div class="sub">${escapeHtml(opts.artist)}</div>${secs}${notes}${contact}`,
    opts.lang,
  );
}
