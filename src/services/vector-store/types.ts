export type VectorMetadata = Record<string, any> & {
  chatbotId?: string;
  knowledgeSourceId?: string;
  chunkIndex?: number;
  label?: string;
};

export interface VectorMatch {
  id: string;
  score: number;
  metadata: VectorMetadata;
  content: string;
}

export interface VectorStore {
  upsertEmbedding(args: {
    vectorId: string;
    vector: number[];
    metadata: VectorMetadata;
  }): Promise<string>;

  similaritySearch(args: { chatbotId: string; vector: number[]; topK: number }): Promise<VectorMatch[]>;

  deleteByIds(args: { chatbotId: string; vectorIds: string[] }): Promise<void>;

    // Delete all vectors for a chatbot/namespace
  deleteByChatbot(args: { chatbotId: string }): Promise<void>;
}
