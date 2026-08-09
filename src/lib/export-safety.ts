// BNDR. — Output safety (server-only)
// ----------------------------------------------------------------------------
// One shared module for:
// 1. HTML escaping (& < > " ') — prevents injection in print documents.
// 2. CSV formula neutralization — prevents spreadsheet formula injection
//    when the first meaningful character is = + - @.
// 3. RFC-4180 compliant CSV quoting.
// 4. A controlled print-document builder that never interpolates raw values
//    as HTML markup.

// ---- HTML escaping ----------------------------------------------------------
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

export function escapeHtmlAttribute(input: string | null | undefined): string {
  // Attributes need quote + amp + lt + gt escaped (apostrophes fine in double-quoted attrs).
  if (input == null) return "";
  return String(input).replace(/[&<>"]/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

// ---- CSV formula neutralization --------------------------------------------
/**
 * If the first meaningful character of a CSV cell is = + - @, prefix it with a
 * single quote so spreadsheet applications do not interpret it as a formula.
 * Also neutralizes TAB/CR/LF at the start. Returns the cell value to quote.
 */
export function neutralizeCsvFormula(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  // Find the first non-whitespace character.
  const firstMeaningful = s.length > 0 ? s.trimStart()[0] : "";
  if (firstMeaningful && /[=+\-@]/.test(firstMeaningful)) {
    return "'" + s;
  }
  return s;
}

// ---- RFC-4180 CSV quoting ---------------------------------------------------
/**
 * Quote a CSV cell per RFC-4180: wrap in double quotes if the value contains
 * a comma, double-quote, newline, or carriage return. Escape embedded
 * double-quotes by doubling them. Formula injection is neutralized first.
 */
export function csvCell(value: string | null | undefined): string {
  const neutralized = neutralizeCsvFormula(value);
  if (/[",\r\n]/.test(neutralized)) {
    return '"' + neutralized.replace(/"/g, '""') + '"';
  }
  return neutralized;
}

/**
 * Build a CSV row from an array of cell values.
 */
export function csvRow(cells: (string | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * Build a complete CSV document (header + rows) from a uniform record array.
 */
export function buildCsv(
  headers: string[],
  rows: (string | null | undefined)[][],
): string {
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  return lines.join("\r\n") + "\r\n";
}

// ---- Controlled print-document builder -------------------------------------
/**
 * Build a safe print HTML document. Every resource field is HTML-escaped
 * before insertion. No resource field, source note, user note, or contact
 * log can become HTML markup.
 *
 * The template is intentionally minimal and uses a allowlist of section
 * renderers rather than interpolating arbitrary HTML.
 */
export interface PrintResource {
  name: string;
  acronym?: string | null;
  category?: string | null;
  description?: string | null;
  phoneRaw?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  tags?: string | null;
  sourceNote?: string | null;
  notes?: string | null;
  contactLog?: string | null;
}

function printField(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return (
    `<div class="field"><span class="label">` +
    escapeHtml(label) +
    `:</span> <span class="value">` +
    escapeHtml(value) +
    `</span></div>`
  );
}

export function buildPrintDocument(
  title: string,
  resources: PrintResource[],
): string {
  const safeTitle = escapeHtml(title);
  const cards = resources
    .map((r, i) => {
      const parts: string[] = [];
      parts.push(`<section class="card">`);
      parts.push(`<h2 class="card-title">${i + 1}. ${escapeHtml(r.name)}</h2>`);
      if (r.acronym) {
        parts.push(`<div class="acronym">(${escapeHtml(r.acronym)})</div>`);
      }
      parts.push(printField("Category", r.category));
      parts.push(printField("Phone", r.phoneRaw));
      parts.push(printField("Email", r.email));
      parts.push(printField("Address", r.address));
      parts.push(printField("Website", r.website));
      parts.push(printField("Tags", r.tags));
      if (r.description) {
        parts.push(
          `<div class="description">${escapeHtml(r.description)}</div>`,
        );
      }
      parts.push(printField("Source Note", r.sourceNote));
      parts.push(printField("Your Notes", r.notes));
      parts.push(printField("Contact Log", r.contactLog));
      parts.push(`</section>`);
      return parts.join("");
    })
    .join("");
  return (
    `<!DOCTYPE html>` +
    `<html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${safeTitle}</title>` +
    `<style>` +
    `body{font-family:Georgia,'Times New Roman',serif;max-width:800px;margin:24px auto;padding:0 16px;color:#111;background:#fff;}` +
    `h1{font-size:22px;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:16px;}` +
    `.card{border:1px solid #ccc;border-radius:6px;padding:14px 16px;margin:12px 0;page-break-inside:avoid;}` +
    `.card-title{font-size:17px;margin:0 0 6px 0;}` +
    `.acronym{color:#555;font-size:13px;margin-bottom:6px;}` +
    `.field{font-size:13px;margin:2px 0;}` +
    `.label{font-weight:700;color:#333;}` +
    `.value{color:#111;word-break:break-word;}` +
    `.description{font-size:13px;margin:8px 0;color:#222;line-height:1.45;white-space:pre-wrap;}` +
    `@media print{body{margin:0;}.card{break-inside:avoid;}}` +
    `</style></head><body>` +
    `<h1>${safeTitle}</h1>` +
    cards +
    `<script>window.onload=function(){window.print();}</script>` +
    `</body></html>`
  );
}
