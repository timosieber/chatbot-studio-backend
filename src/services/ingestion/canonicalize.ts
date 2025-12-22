const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const NBSP = /\u00A0/g;
const MULTI_SPACES = /[ \t]+/g;
const TRAILING_SPACE_PER_LINE = /[ \t]+$/gm;
const MULTI_BLANK_LINES = /\n{3,}/g;
const LIGATURES: Array<[RegExp, string]> = [
  [/ﬀ/g, "ff"],
  [/ﬁ/g, "fi"],
  [/ﬂ/g, "fl"],
  [/ﬃ/g, "ffi"],
  [/ﬄ/g, "ffl"],
];

/**
 * Canonicalizes text as the single source of truth for chunking + hashing.
 * Deterministic by construction (pure function).
 */
export const canonicalizeText = (raw: string): string => {
  let text = raw ?? "";

  // Line breaks
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Replace tabs/NBSP, remove control chars
  text = text.replace(NBSP, " ").replace(/\t/g, " ").replace(CONTROL_CHARS, "");

  // Common OCR ligatures
  for (const [re, repl] of LIGATURES) {
    text = text.replace(re, repl);
  }

  // De-hyphenate line-wrapped words: "exam-\nple" -> "example"
  text = text.replace(/(\p{L})-\n(\p{L})/gu, "$1$2");

  // Whitespace normalization (preserve newlines)
  text = text.replace(MULTI_SPACES, " ");
  text = text.replace(TRAILING_SPACE_PER_LINE, "");
  text = text.replace(MULTI_BLANK_LINES, "\n\n");

  return text.trim();
};

