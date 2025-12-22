import crypto from "node:crypto";
import { OpenAIEmbeddings } from "@langchain/openai";
import { env } from "../../config/env.js";

export interface EmbeddingsProvider {
  model: string;
  dimensions: number;
  embed(text: string): Promise<number[]>;
}

// Pinecone supports specific dimensions (384, 512, 768, 1024, 2048)
export const EMBEDDING_DIMENSIONS = 1024;

const normalizeVector = (vec: number[]): number[] => {
  if (vec.length === EMBEDDING_DIMENSIONS) return vec;
  if (vec.length > EMBEDDING_DIMENSIONS) return vec.slice(0, EMBEDDING_DIMENSIONS);
  const padded = new Array(EMBEDDING_DIMENSIONS).fill(0);
  vec.forEach((v, i) => {
    padded[i] = v;
  });
  return padded;
};

class OpenAiEmbeddingsProvider implements EmbeddingsProvider {
  model = env.OPENAI_EMBEDDINGS_MODEL;
  dimensions = EMBEDDING_DIMENSIONS;
  private readonly client = new OpenAIEmbeddings({
    model: env.OPENAI_EMBEDDINGS_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  async embed(text: string): Promise<number[]> {
    const vec = await this.client.embedQuery(text);
    return normalizeVector(vec);
  }
}

class DeterministicTestEmbeddingsProvider implements EmbeddingsProvider {
  model = "deterministic_test_v1";
  dimensions = EMBEDDING_DIMENSIONS;

  async embed(text: string): Promise<number[]> {
    const hash = crypto.createHash("sha256").update(text, "utf8").digest();
    const base = Array.from(hash).map((byte) => (byte / 255) * 2 - 1);
    return normalizeVector(base);
  }
}

let instance: EmbeddingsProvider | null = null;

export const getEmbeddingsProvider = (): EmbeddingsProvider => {
  if (instance) return instance;

  if (env.EMBEDDINGS_PROVIDER === "deterministic_test") {
    if (env.NODE_ENV === "production") {
      throw new Error("deterministic_test embeddings not allowed in production");
    }
    instance = new DeterministicTestEmbeddingsProvider();
    return instance;
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }

  instance = new OpenAiEmbeddingsProvider();
  return instance;
};

