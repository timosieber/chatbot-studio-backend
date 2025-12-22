import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { VectorMatch, VectorMetadata, VectorStore } from "./types.js";

export class PineconeVectorStore implements VectorStore {
  private readonly index;

  constructor() {
    if (!env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
      throw new Error("Pinecone nicht vollständig konfiguriert");
    }
    const client = new Pinecone({ apiKey: env.PINECONE_API_KEY });
    this.index = client.Index(env.PINECONE_INDEX);
  }

  async upsertEmbedding({
    vectorId,
    vector,
    metadata,
  }: {
    vectorId: string;
    vector: number[];
    metadata: VectorMetadata;
  }) {
    const ns = metadata.chatbotId ?? "global";
    await this.index.namespace(ns).upsert([
      {
        id: vectorId,
        values: vector,
        metadata,
      },
    ]);
    return vectorId;
  }

  async similaritySearch({ chatbotId, vector, topK }: { chatbotId: string; vector: number[]; topK: number }) {
    const ns = chatbotId || "global";
    const response = await this.index.namespace(ns).query({
      vector,
      topK,
      includeMetadata: true,
    });

    return (
      response.matches?.map((match) => ({
        id: match.id,
        score: match.score ?? 0,
        metadata: (match.metadata as Record<string, any>) ?? { chatbotId: ns },
        content: "",
      })) ?? []
    );
  }

  async deleteByIds({ chatbotId, vectorIds }: { chatbotId: string; vectorIds: string[] }) {
    const ns = chatbotId || "global";
    if (!vectorIds.length) return;
    const chunkSize = 1000;
    for (let i = 0; i < vectorIds.length; i += chunkSize) {
      const chunk = vectorIds.slice(i, i + chunkSize);
      await this.index.namespace(ns).deleteMany(chunk);
    }
    logger.info({ ns, count: vectorIds.length }, "Pinecone vectors deleted by IDs");
  }

  async deleteByChatbot({ chatbotId }: { chatbotId: string }) {
    const ns = chatbotId || "global";
    // Prefer deleteAll if available
    const nspace: any = (this.index as any).namespace(ns);
    if (typeof nspace.deleteAll === "function") {
      await nspace.deleteAll();
      return;
    }
    if (typeof nspace.deleteMany === "function") {
      await nspace.deleteMany({});
      return;
    }
    logger.warn({ ns }, "Pinecone namespace delete not supported in this client version");
    throw new Error("Pinecone namespace delete not supported");
  }
}
