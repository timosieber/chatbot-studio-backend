import { prisma } from "../lib/prisma.js";
import { getVectorStore } from "./vector-store/index.js";
import { enqueueDeleteSourceJob, enqueueScrapeIngestionJob, enqueueTextIngestionJob, getIngestionJob } from "./ingestion/ingestion-queue.js";

export class KnowledgeService {
  private readonly vectorStore = getVectorStore();

  async listSources(_userId?: string, chatbotId?: string) {
    if (!chatbotId) return [];
    return prisma.knowledgeSource.findMany({
      where: { chatbotId },
      orderBy: { createdAt: "desc" },
      include: {
        chunks: { where: { deletedAt: null }, select: { chunkId: true } },
      },
    });
  }

  async startTextIngestion(
    userId: string,
    chatbotId: string,
    title: string,
    content: string,
    opts?: {
      sourceKey?: string;
      canonicalUrl?: string;
      originalUrl?: string;
      extractionMethod?: string;
      textQuality?: string;
    },
  ) {
    if (!chatbotId || !title || !content) throw new Error("chatbotId, title und content sind erforderlich");
    return enqueueTextIngestionJob({ userId, chatbotId, title, content, ...opts });
  }

  async startScrapeIngestion(chatbotId: string, options: any) {
    if (!chatbotId) throw new Error("chatbotId ist erforderlich");
    if (!options?.startUrls?.length) throw new Error("startUrls ist erforderlich");
    return enqueueScrapeIngestionJob({ chatbotId, options });
  }

  async startDeleteSource(chatbotId: string, sourceId: string) {
    if (!sourceId) throw new Error("sourceId ist erforderlich");
    return enqueueDeleteSourceJob({ chatbotId, knowledgeSourceId: sourceId });
  }

  async getJob(jobId: string) {
    if (!jobId) throw new Error("jobId ist erforderlich");
    return getIngestionJob(jobId);
  }

  async purgeChatbotVectors(chatbotId: string) {
    if (!chatbotId) throw new Error("chatbotId ist erforderlich");
    await this.vectorStore.deleteByChatbot({ chatbotId });
  }
}

export const knowledgeService = new KnowledgeService();
