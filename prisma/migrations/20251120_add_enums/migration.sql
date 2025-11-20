-- CreateEnum (only if not exists)
DO $$ BEGIN
 CREATE TYPE "ChatbotStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
 CREATE TYPE "MessageRole" AS ENUM ('system', 'user', 'assistant');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
 CREATE TYPE "KnowledgeSourceType" AS ENUM ('URL', 'TEXT', 'FILE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
 CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- AlterTable Chatbot - Change status column from TEXT to ChatbotStatus
ALTER TABLE "Chatbot" ALTER COLUMN "status" TYPE "ChatbotStatus" USING ("status"::text::"ChatbotStatus");

-- AlterTable Message - Change role column from TEXT to MessageRole
ALTER TABLE "Message" ALTER COLUMN "role" TYPE "MessageRole" USING ("role"::text::"MessageRole");

-- AlterTable KnowledgeSource - Change type and status columns
ALTER TABLE "KnowledgeSource" ALTER COLUMN "type" TYPE "KnowledgeSourceType" USING ("type"::text::"KnowledgeSourceType");
ALTER TABLE "KnowledgeSource" ALTER COLUMN "status" TYPE "KnowledgeSourceStatus" USING ("status"::text::"KnowledgeSourceStatus");
