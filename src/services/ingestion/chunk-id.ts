import { sha256Hex } from "./hash.js";
import type { AnchoredChunk } from "./chunking.js";

export const computeSourceRevision = (canonicalText: string): string => sha256Hex(canonicalText);

export const computePdfSourceRevision = (pages: Array<{ pageNo: number; canonicalText: string }>): string => {
  const payload = pages
    .slice()
    .sort((a, b) => a.pageNo - b.pageNo)
    .map((p) => `page:${p.pageNo}\n${p.canonicalText}`)
    .join("\n\n---\n\n");
  return sha256Hex(payload);
};

export const computeChunkId = (args: {
  sourceId: string;
  sourceRevision: string;
  pageNo?: number;
  chunk: AnchoredChunk;
}): string => {
  const base = [
    `source_id:${args.sourceId}`,
    `source_revision:${args.sourceRevision}`,
    `page_no:${args.pageNo ?? ""}`,
    `start_offset:${args.chunk.startOffset}`,
    `end_offset:${args.chunk.endOffset}`,
    "text:",
    args.chunk.text,
  ].join("\n");

  return sha256Hex(base);
};

