-- Add websiteUrl to persist initial website for monthly re-scrape
ALTER TABLE "Chatbot" ADD COLUMN "websiteUrl" TEXT;
