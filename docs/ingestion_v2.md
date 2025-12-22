# Ingestion v2 (Deterministic + Job-Based)

This backend implements a deterministic, lossless (DB as source of truth) ingestion pipeline for RAG.

## Guarantees

- No silent fallbacks (production hard-fails without Pinecone + OpenAI embeddings).
- Deterministic chunking + stable chunk IDs (`chunk_id` = vector ID).
- Mandatory citation anchors per chunk (WEB: `uri + offsets`, PDF: `uri + page_no + offsets`, TEXT: offsets).
- Idempotent upserts and deletes via `chunk_id`.
- No dual-writes without recovery: Prisma writes first, vector writes happen via outbox processing.

## Strategy (Option A)

Prisma is the source of truth:

1) Canonicalization
2) Chunking (+ anchors)
3) Chunk manifest persistence (`KnowledgeChunk`)
4) Vector outbox entries (`VectorOutbox`)
5) Worker embeds + upserts/deletes in Pinecone
6) Job finalized (`IngestionJob`)

## Data model

- `IngestionJob`: persistent ingestion job (`PENDING|RUNNING|FAILED|PARTIAL_FAILED|SUCCEEDED`)
- `KnowledgeChunk`: chunk manifest (PK = `chunkId`)
- `VectorOutbox`: outbox operations (`UPSERT|DELETE`) for `chunkId`

## API behavior

- Requests start a job and return `jobId` (`202 Accepted`).
- Job execution happens asynchronously via the in-process worker.

Endpoints:

- `POST /api/knowledge/sources/text` → `{ jobId, knowledgeSourceId }`
- `POST /api/knowledge/sources/scrape` → `{ jobId }`
- `DELETE /api/knowledge/sources/:id` → `{ jobId }` (deletes vectors via chunk IDs, then removes the source)
- `GET /api/knowledge/jobs/:id` → job state

## Operational notes

- Production requires:
  - `VECTOR_DB_PROVIDER=pinecone`, `PINECONE_API_KEY`, `PINECONE_INDEX`
  - `EMBEDDINGS_PROVIDER=openai`, `OPENAI_API_KEY`

## Migration plan (legacy index)

The previous system stored random `vectorId`s and/or LLM-mutated chunk text. This is not losslessly convertible into v2 without the original canonical source text + anchors.

Recommended migration:

1) Deploy schema migration.
2) Re-ingest sources from the canonical Phase-1 output (or re-scrape / re-upload PDFs with page boundaries).
3) After cutover, delete legacy vectors by namespace if needed.

