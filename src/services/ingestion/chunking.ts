export interface AnchoredChunk {
  startOffset: number;
  endOffset: number;
  text: string;
}

export const chunkTextWithOffsets = (
  canonicalText: string,
  opts: { chunkSize: number; chunkOverlap: number },
): AnchoredChunk[] => {
  const text = canonicalText ?? "";
  const chunkSize = opts.chunkSize;
  const chunkOverlap = opts.chunkOverlap;

  if (!Number.isInteger(chunkSize) || chunkSize < 100) throw new Error("chunkSize invalid");
  if (!Number.isInteger(chunkOverlap) || chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error("chunkOverlap invalid");
  }
  if (!text.trim()) throw new Error("canonicalText empty");

  const chunks: AnchoredChunk[] = [];
  const len = text.length;

  let start = 0;
  while (start < len) {
    const hardEnd = Math.min(start + chunkSize, len);
    let end = hardEnd;

    // If we can, try to cut at a clean boundary (deterministically).
    if (hardEnd < len) {
      const minEnd = Math.min(len, start + Math.floor(chunkSize * 0.6));
      const window = text.slice(minEnd, hardEnd);
      const breakAt = findLastBoundary(window);
      if (breakAt !== null) {
        end = minEnd + breakAt;
      }
    }

    // Trim leading/trailing whitespace but keep anchors consistent by shifting offsets.
    let trimmedStart = start;
    let trimmedEnd = end;
    while (trimmedStart < trimmedEnd && isSkippable(text.charCodeAt(trimmedStart))) trimmedStart += 1;
    while (trimmedEnd > trimmedStart && isSkippable(text.charCodeAt(trimmedEnd - 1))) trimmedEnd -= 1;

    if (trimmedEnd > trimmedStart) {
      chunks.push({
        startOffset: trimmedStart,
        endOffset: trimmedEnd,
        text: text.slice(trimmedStart, trimmedEnd),
      });
    }

    if (end >= len) break;
    const nextStart = Math.max(0, end - chunkOverlap);
    start = nextStart > start ? nextStart : start + 1;
  }

  if (!chunks.length) throw new Error("No chunks produced");
  return chunks;
};

const isSkippable = (code: number): boolean =>
  code === 32 /* space */ || code === 10 /* \n */ || code === 13 /* \r */ || code === 9 /* \t */;

const findLastBoundary = (window: string): number | null => {
  // Return relative end index within window.
  const candidates: Array<[string, number]> = [
    ["\n\n", 2],
    ["\n", 1],
    [" ", 1],
  ];
  for (const [sep, sepLen] of candidates) {
    const idx = window.lastIndexOf(sep);
    if (idx !== -1) return idx + sepLen;
  }
  return null;
};

