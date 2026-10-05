/**
 * jsPDF's built-in fonts (Helvetica etc.) only cover Latin-1 / cp1252.
 * Text outside that range is written as garbage bytes — a property called
 * "𝐏𝐑𝐈𝐌𝐄 𝐋𝐀𝐍𝐃 𝐅𝐎𝐑 𝐒𝐀𝐋𝐄 – 𝐊𝐀𝐁𝐄𝐒𝐀" used to come out of the PDF as
 * "Ø5Ü Ø5Ü Ø5Ü …". Everything written into a PDF must pass through pdfText()
 * first.
 */

/** Common punctuation that cp1252 can express, mapped to a safe equivalent. */
const REPLACEMENTS: Record<string, string> = {
  "\u2010": "-", // hyphen
  "\u2011": "-", // non-breaking hyphen
  "\u2012": "-", // figure dash
  "\u2013": "-", // en dash
  "\u2014": "-", // em dash
  "\u2212": "-", // minus sign
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": "'",
  "\u2032": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u2033": '"',
  "\u2022": "-", // bullet -> dash keeps table cells aligned
  "\u00B7": "-", // middle dot
  "\u2026": "...", // ellipsis
  "\u00A0": " ", // non-breaking space
  "\u2039": "<",
  "\u203A": ">",
};

/**
 * Normalise any string to something jsPDF can render:
 * - fancy punctuation -> ASCII equivalents
 * - styled/math letters (𝐀, 𝐁 …) decompose back to A, B …
 * - combining marks and everything else outside Latin-1 are dropped
 * - whitespace collapsed
 */
export function pdfText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const source = String(value);
  let out = "";

  for (const ch of source) {
    const mapped = REPLACEMENTS[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }

    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x20 && cp <= 0xff) {
      out += ch;
      continue;
    }

    // Decompose first: 𝐏 -> P, ﬁ -> fi, é -> e + ́ (mark then dropped)
    const decomposed = ch.normalize("NFKD");
    for (const d of decomposed) {
      const dcp = d.codePointAt(0) ?? 0;
      if (dcp >= 0x20 && dcp <= 0xff) out += d;
    }
  }

  return out.replace(/\s+/g, " ").trim();
}

/** Money with thousand separators for PDF tables: 17250000 -> "1,72,50,000.00". */
export function pdfMoney(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (isNaN(n)) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
