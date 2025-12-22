import { prisma } from "../../lib/prisma.js";
import { sha256Hex } from "./hash.js";

export const enqueueTextIngestionJob = async (args: {
  userId: string;
  chatbotId: string;
  title: string;
  content: string;
  sourceKey?: string;
  canonicalUrl?: string;
  originalUrl?: string;
  extractionMethod?: string;
  textQuality?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const stableKey = (args.sourceKey || args.title).trim();
    if (!stableKey) throw new Error("Text sourceKey/title darf nicht leer sein");
    const uri = `text:${sha256Hex([args.chatbotId, stableKey].join("\n"))}`;

    const existing = await tx.knowledgeSource.findFirst({
      where: { chatbotId: args.chatbotId, uri },
      select: { id: true },
    });

    const source = existing
      ? await tx.knowledgeSource.update({
          where: { id: existing.id },
          data: {
            label: args.title,
            type: "TEXT",
            status: "PENDING",
            uri,
            ...(args.canonicalUrl !== undefined ? { canonicalUrl: args.canonicalUrl } : {}),
            ...(args.originalUrl !== undefined ? { originalUrl: args.originalUrl } : {}),
            ...(args.extractionMethod !== undefined ? { extractionMethod: args.extractionMethod } : {}),
            ...(args.textQuality !== undefined ? { textQuality: args.textQuality } : {}),
            metadata: { addedBy: args.userId },
          },
          select: { id: true },
        })
      : await tx.knowledgeSource.create({
          data: {
            chatbotId: args.chatbotId,
            label: args.title,
            uri,
            canonicalUrl: args.canonicalUrl ?? null,
            originalUrl: args.originalUrl ?? null,
            extractionMethod: args.extractionMethod ?? null,
            textQuality: args.textQuality ?? null,
            type: "TEXT",
            status: "PENDING",
            metadata: { addedBy: args.userId },
          },
          select: { id: true },
        });

    const job = await tx.ingestionJob.create({
      data: {
        chatbotId: args.chatbotId,
        knowledgeSourceId: source.id,
        kind: "TEXT",
        status: "PENDING",
        payload: {
          title: args.title,
          content: args.content,
          uri,
          ...(args.canonicalUrl !== undefined ? { canonicalUrl: args.canonicalUrl } : {}),
          ...(args.originalUrl !== undefined ? { originalUrl: args.originalUrl } : {}),
          ...(args.extractionMethod !== undefined ? { extractionMethod: args.extractionMethod } : {}),
          ...(args.textQuality !== undefined ? { textQuality: args.textQuality } : {}),
          ...(args.sourceKey !== undefined ? { sourceKey: args.sourceKey } : {}),
        },
      },
      select: { id: true },
    });

    await tx.knowledgeSource.update({
      where: { id: source.id },
      data: { lastIngestionJobId: job.id },
    });

    return { jobId: job.id, knowledgeSourceId: source.id };
  });
};

export const enqueueScrapeIngestionJob = async (args: { chatbotId: string; options: any }) => {
  const job = await prisma.ingestionJob.create({
    data: {
      chatbotId: args.chatbotId,
      kind: "SCRAPE",
      status: "PENDING",
      payload: { options: args.options },
    },
    select: { id: true },
  });
  return { jobId: job.id };
};

export const enqueueDeleteSourceJob = async (args: { chatbotId: string; knowledgeSourceId: string }) => {
  const job = await prisma.ingestionJob.create({
    data: {
      chatbotId: args.chatbotId,
      knowledgeSourceId: args.knowledgeSourceId,
      kind: "DELETE_SOURCE",
      status: "PENDING",
      payload: { knowledgeSourceId: args.knowledgeSourceId },
    },
    select: { id: true },
  });

  await prisma.knowledgeSource.update({
    where: { id: args.knowledgeSourceId },
    data: { lastIngestionJobId: job.id, status: "PENDING" },
  });

  return { jobId: job.id };
};

export const getIngestionJob = async (jobId: string) =>
  prisma.ingestionJob.findUnique({
    where: { id: jobId },
  });
