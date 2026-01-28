import { Router } from "express";
import { z } from "zod";
import { knowledgeService } from "../services/knowledge.service.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

const addTextSchema = z.object({
  chatbotId: z.string().min(8),
  label: z.string().min(3),
  content: z.string().min(20),
  sourceKey: z.string().min(1).max(200).optional(),
  canonicalUrl: z.string().url().optional(),
  originalUrl: z.string().url().optional(),
  extractionMethod: z.string().min(1).max(50).optional(),
  textQuality: z.string().min(1).max(50).optional(),
});

const scrapeSchema = z.object({
  chatbotId: z.string().min(8),
  startUrls: z.array(z.string().url()).min(1).max(10),
  maxDepth: z.number().min(0).max(5).optional(),
  maxPages: z.number().min(1).max(50).optional(),
  respectRobotsTxt: z.boolean().optional(),
  includeGlobs: z.array(z.string().min(2)).max(20).optional(),
  excludeGlobs: z.array(z.string().min(2)).max(20).optional(),
  maxConcurrency: z.number().min(1).max(20).optional(),
  rateLimitPerHost: z.number().min(1).max(20).optional(),
  allowFullDownload: z.boolean().optional(),
});

router.get("/sources", async (req, res, next) => {
  try {
    const schema = z.object({ chatbotId: z.string().min(8) });
    const payload = schema.parse(req.query);
    const sources = await knowledgeService.listSources(req.user!.id, payload.chatbotId);
    res.json(sources);
  } catch (error) {
    next(error);
  }
});

router.post("/sources/text", async (req, res, next) => {
  try {
    const payload = addTextSchema.parse(req.body);
    const { jobId, knowledgeSourceId } = await knowledgeService.startTextIngestion(
      req.user!.id,
      payload.chatbotId,
      payload.label,
      payload.content,
      {
        ...(payload.sourceKey ? { sourceKey: payload.sourceKey } : {}),
        ...(payload.canonicalUrl ? { canonicalUrl: payload.canonicalUrl } : {}),
        ...(payload.originalUrl ? { originalUrl: payload.originalUrl } : {}),
        ...(payload.extractionMethod ? { extractionMethod: payload.extractionMethod } : {}),
        ...(payload.textQuality ? { textQuality: payload.textQuality } : {}),
      },
    );
    res.status(202).json({ status: "PENDING", jobId, knowledgeSourceId });
  } catch (error) {
    next(error);
  }
});

router.post("/sources/scrape", async (req, res, next) => {
  try {
    const payload = scrapeSchema.parse(req.body);
    const scrapeOptions = {
      startUrls: payload.startUrls,
      ...(payload.maxDepth !== undefined ? { maxDepth: payload.maxDepth } : {}),
      ...(payload.maxPages !== undefined ? { maxPages: payload.maxPages } : {}),
      ...(payload.respectRobotsTxt !== undefined ? { respectRobotsTxt: payload.respectRobotsTxt } : {}),
      ...(payload.includeGlobs?.length ? { includeGlobs: payload.includeGlobs } : {}),
      ...(payload.excludeGlobs?.length ? { excludeGlobs: payload.excludeGlobs } : {}),
      ...(payload.maxConcurrency !== undefined ? { maxConcurrency: payload.maxConcurrency } : {}),
      ...(payload.rateLimitPerHost !== undefined ? { rateLimitPerHost: payload.rateLimitPerHost } : {}),
      ...(payload.allowFullDownload !== undefined ? { allowFullDownload: payload.allowFullDownload } : {}),
    };
    const primaryUrl = payload.startUrls[0];
    if (primaryUrl) {
      await prisma.chatbot.update({
        where: { id: payload.chatbotId },
        data: { websiteUrl: primaryUrl },
      });
    }
    const { jobId } = await knowledgeService.startScrapeIngestion(payload.chatbotId, scrapeOptions);
    res.status(202).json({ status: "PENDING", jobId });
  } catch (error) {
    next(error);
  }
});

router.delete("/sources/:id", async (req, res, next) => {
  try {
    const source = await prisma.knowledgeSource.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: "Source nicht gefunden" });
    const { jobId } = await knowledgeService.startDeleteSource(source.chatbotId, source.id);
    res.status(202).json({ status: "PENDING", jobId });
  } catch (error) {
    next(error);
  }
});

export default router;
