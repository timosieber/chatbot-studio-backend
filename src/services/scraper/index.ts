import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { apifyScraperRunner } from "./apify-runner.js";
import { idpaScraperRunner } from "./idpa-runner.js";
import { firecrawlRunner } from "./firecrawl-runner.js";
import type { DatasetItem, ScrapeOptions } from "./types.js";

type Runner = {
  run(options: ScrapeOptions): Promise<DatasetItem[]>;
};

function selectRunner(): Runner {
  // Priority: explicit SCRAPER_PROVIDER > legacy detection > local fallback
  const provider = env.SCRAPER_PROVIDER;

  if (provider === "firecrawl") {
    if (!env.FIRECRAWL_API_KEY) {
      logger.error("SCRAPER_PROVIDER=firecrawl but FIRECRAWL_API_KEY is not set");
      throw new Error("FIRECRAWL_API_KEY required when SCRAPER_PROVIDER=firecrawl");
    }
    logger.info("Firecrawl Scraper Runner aktiviert");
    return firecrawlRunner;
  }

  if (provider === "apify") {
    if (!env.SCRAPER_APIFY_ACTOR_ID || !env.SCRAPER_APIFY_API_TOKEN) {
      logger.error("SCRAPER_PROVIDER=apify but Apify credentials not set");
      throw new Error("SCRAPER_APIFY_ACTOR_ID and SCRAPER_APIFY_API_TOKEN required when SCRAPER_PROVIDER=apify");
    }
    logger.info({ actor: env.SCRAPER_APIFY_ACTOR_ID }, "Apify Scraper Runner aktiviert");
    return apifyScraperRunner;
  }

  // Legacy detection for backward compatibility
  if (env.FIRECRAWL_API_KEY) {
    logger.info("Firecrawl Scraper Runner aktiviert (auto-detected via API key)");
    return firecrawlRunner;
  }

  if (env.SCRAPER_APIFY_ACTOR_ID && env.SCRAPER_APIFY_API_TOKEN) {
    logger.info({ actor: env.SCRAPER_APIFY_ACTOR_ID }, "Apify Scraper Runner aktiviert (legacy detection)");
    return apifyScraperRunner;
  }

  // Default: local IDPA scraper
  logger.info({ scraperDir: env.SCRAPER_DIR }, "Lokaler IDPA Scraper Runner aktiviert");
  return idpaScraperRunner;
}

const runner: Runner = selectRunner();

export const scraperRunner = runner;
