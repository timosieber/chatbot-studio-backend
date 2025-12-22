-- Extend KnowledgeSource with Phase-1 contract fields
ALTER TABLE "KnowledgeSource"
  ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "originalUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "extractionMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "textQuality" TEXT;

-- Extend KnowledgeChunk manifest with Phase-1 contract fields and pass-through anchor JSON
ALTER TABLE "KnowledgeChunk"
  ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "originalUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "extractionMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "textQuality" TEXT,
  ADD COLUMN IF NOT EXISTS "phase1Anchor" JSONB;

