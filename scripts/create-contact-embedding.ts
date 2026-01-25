import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const CHATBOT_ID = 'cmku3lyc50003t3015w6l8fzp';
const CHUNK_ID = 'chunk_contact_1769371016606';

async function main() {
  // Hole den Chunk
  const chunk = await prisma.knowledgeChunk.findUnique({ where: { chunkId: CHUNK_ID } });
  if (!chunk) throw new Error('Chunk nicht gefunden');

  console.log('Chunk gefunden:', chunk.title);

  // Erstelle Embedding mit 1024 Dimensionen (Pinecone Index Dimension)
  console.log('Erstelle Embedding...');
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunk.canonicalText,
    dimensions: 1024,
  });
  const vector = embeddingResponse.data[0].embedding;
  console.log('Embedding erstellt, Dimension:', vector.length);

  // Speichere in Pinecone
  console.log('Speichere in Pinecone...');
  const index = pinecone.index('idpa');

  await index.upsert([{
    id: CHUNK_ID,
    values: vector,
    metadata: {
      chatbotId: CHATBOT_ID,
      knowledgeSourceId: chunk.knowledgeSourceId,
      title: chunk.title,
      sourceType: chunk.sourceType,
    }
  }]);

  console.log('Erfolgreich in Pinecone gespeichert!');
  console.log('\nDer Chatbot kann jetzt Kontaktfragen beantworten.');
}

main().finally(() => prisma.$disconnect());
