-- CreateEnum (only if not exists)
DO $$ BEGIN
 CREATE TYPE "IngestionJobKind" AS ENUM ('TEXT', 'SCRAPE', 'DELETE_SOURCE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
 CREATE TYPE "IngestionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'PARTIAL_FAILED', 'SUCCEEDED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
 CREATE TYPE "ChunkSourceType" AS ENUM ('WEB', 'PDF', 'TEXT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
 CREATE TYPE "VectorOutboxOperation" AS ENUM ('UPSERT', 'DELETE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
 CREATE TYPE "VectorOutboxStatus" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'SUCCEEDED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Extend KnowledgeSource for deterministic ingestion tracking
ALTER TABLE "KnowledgeSource"
  ADD COLUMN IF NOT EXISTS "currentRevision" TEXT,
  ADD COLUMN IF NOT EXISTS "lastIngestionJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastIngestedAt" TIMESTAMP(3);

-- IngestionJob
CREATE TABLE IF NOT EXISTS "IngestionJob" (
  "id" TEXT NOT NULL,
  "chatbotId" TEXT NOT NULL,
  "knowledgeSourceId" TEXT,
  "kind" "IngestionJobKind" NOT NULL,
  "status" "IngestionJobStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "totalChunks" INTEGER NOT NULL DEFAULT 0,
  "succeededVectors" INTEGER NOT NULL DEFAULT 0,
  "failedVectors" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- KnowledgeChunk (chunk manifest)
CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "chunkId" TEXT NOT NULL,
  "chatbotId" TEXT NOT NULL,
  "knowledgeSourceId" TEXT NOT NULL,
  "createdByIngestionJobId" TEXT,
  "updatedByIngestionJobId" TEXT,
  "sourceType" "ChunkSourceType" NOT NULL,
  "uri" TEXT,
  "title" TEXT NOT NULL,
  "sourceRevision" TEXT NOT NULL,
  "pageNo" INTEGER,
  "startOffset" INTEGER NOT NULL,
  "endOffset" INTEGER NOT NULL,
  "canonicalText" TEXT NOT NULL,
  "canonicalTextHash" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "embeddingDimensions" INTEGER NOT NULL,
  "tokenCount" INTEGER NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("chunkId")
);

-- VectorOutbox
CREATE TABLE IF NOT EXISTS "VectorOutbox" (
  "id" TEXT NOT NULL,
  "ingestionJobId" TEXT NOT NULL,
  "chatbotId" TEXT NOT NULL,
  "operation" "VectorOutboxOperation" NOT NULL,
  "chunkId" TEXT NOT NULL,
  "status" "VectorOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VectorOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VectorOutbox_ingestionJobId_operation_chunkId_key" UNIQUE ("ingestionJobId", "operation", "chunkId")
);

-- Foreign keys (add only if not already present)
DO $$ BEGIN
  ALTER TABLE "IngestionJob"
    ADD CONSTRAINT "IngestionJob_chatbotId_fkey"
    FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IngestionJob"
    ADD CONSTRAINT "IngestionJob_knowledgeSourceId_fkey"
    FOREIGN KEY ("knowledgeSourceId") REFERENCES "KnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_knowledgeSourceId_fkey"
    FOREIGN KEY ("knowledgeSourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VectorOutbox"
    ADD CONSTRAINT "VectorOutbox_ingestionJobId_fkey"
    FOREIGN KEY ("ingestionJobId") REFERENCES "IngestionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "IngestionJob_chatbotId_status_createdAt_idx" ON "IngestionJob"("chatbotId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "IngestionJob_knowledgeSourceId_idx" ON "IngestionJob"("knowledgeSourceId");

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_knowledgeSourceId_deletedAt_idx" ON "KnowledgeChunk"("knowledgeSourceId", "deletedAt");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_chatbotId_deletedAt_idx" ON "KnowledgeChunk"("chatbotId", "deletedAt");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_knowledgeSourceId_sourceRevision_idx" ON "KnowledgeChunk"("knowledgeSourceId", "sourceRevision");

CREATE INDEX IF NOT EXISTS "VectorOutbox_status_nextAttemptAt_idx" ON "VectorOutbox"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "VectorOutbox_chatbotId_status_idx" ON "VectorOutbox"("chatbotId", "status");
