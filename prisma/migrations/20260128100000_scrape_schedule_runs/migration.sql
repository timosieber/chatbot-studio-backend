-- Create scrape schedule runs for monthly scheduling (idempotent per chatbot+period)
CREATE TABLE "ScrapeScheduleRun" (
  "id" TEXT NOT NULL,
  "chatbotId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "options" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScrapeScheduleRun_pkey" PRIMARY KEY ("id")
);

-- Foreign key to Chatbot
ALTER TABLE "ScrapeScheduleRun"
ADD CONSTRAINT "ScrapeScheduleRun_chatbotId_fkey"
FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique per chatbot + month
CREATE UNIQUE INDEX "ScrapeScheduleRun_chatbotId_periodKey_key"
ON "ScrapeScheduleRun"("chatbotId", "periodKey");

CREATE INDEX "ScrapeScheduleRun_periodKey_idx" ON "ScrapeScheduleRun"("periodKey");
CREATE INDEX "ScrapeScheduleRun_chatbotId_idx" ON "ScrapeScheduleRun"("chatbotId");
