import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeText } from "./canonicalize.js";
import { chunkTextWithOffsets } from "./chunking.js";
import { computeChunkId, computePdfSourceRevision, computeSourceRevision } from "./chunk-id.js";

test("canonicalizeText is deterministic and normalizes line breaks", () => {
  const raw = "A\r\nB\rC\t\u0000\u0007\u00A0D\n\n\nE";
  const a = canonicalizeText(raw);
  const b = canonicalizeText(raw);
  assert.equal(a, b);
  assert.equal(a.includes("\r"), false);
  assert.equal(a.includes("\u0000"), false);
  assert.equal(a.includes("\u0007"), false);
  assert.equal(a.includes("\u00A0"), false);
  assert.ok(a.includes("\n"));
});

test("chunkTextWithOffsets is deterministic and offsets match text slices", () => {
  const text = canonicalizeText("Line 1\nLine 2\n\nLine 3\nLine 4\n".repeat(50));
  const chunksA = chunkTextWithOffsets(text, { chunkSize: 1200, chunkOverlap: 200 });
  const chunksB = chunkTextWithOffsets(text, { chunkSize: 1200, chunkOverlap: 200 });
  assert.deepEqual(chunksA, chunksB);

  for (const c of chunksA) {
    assert.ok(c.startOffset >= 0);
    assert.ok(c.endOffset > c.startOffset);
    assert.equal(c.text, text.slice(c.startOffset, c.endOffset));
  }
});

test("chunk IDs are stable across re-ingestion with identical canonical input", () => {
  const canonical = canonicalizeText("Hello world.\n\nThis is a deterministic test.");
  const revision = computeSourceRevision(canonical);
  const chunks = chunkTextWithOffsets(canonical, { chunkSize: 1200, chunkOverlap: 200 });
  assert.ok(chunks.length >= 1);

  const id1 = computeChunkId({ sourceId: "source-123", sourceRevision: revision, chunk: chunks[0]! });
  const id2 = computeChunkId({ sourceId: "source-123", sourceRevision: revision, chunk: chunks[0]! });
  assert.equal(id1, id2);
});

test("pdf source revision is stable regardless of input page ordering", () => {
  const pagesA = [
    { pageNo: 2, canonicalText: "B" },
    { pageNo: 1, canonicalText: "A" },
  ];
  const pagesB = [
    { pageNo: 1, canonicalText: "A" },
    { pageNo: 2, canonicalText: "B" },
  ];
  assert.equal(computePdfSourceRevision(pagesA), computePdfSourceRevision(pagesB));
});

