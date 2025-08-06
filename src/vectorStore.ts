import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';
dotenv.config();

// Configuration
const DOCUMENTS_DIR = './documents';
const CHUNK_SIZE = 500;
const INDEX_NAME = 'document-chunks';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;

if (!PINECONE_API_KEY) {
  throw new Error('Pinecone API key and environment must be set in environment variables');
}

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY
});

interface DocumentChunk {
  content: string;
  source: string;
}

// Local embedding function using Transformers.js
let localEmbedder: any;
const initializeLocalEmbedder = async () => {
  if (!localEmbedder) {
    localEmbedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return localEmbedder;
};

const getLocalEmbeddings = async (texts: string[]): Promise<number[][]> => {
  const embedder = await initializeLocalEmbedder();
  const embeddings = [];

  for (const text of texts) {
    const output = await embedder(text, {
      pooling: 'mean',
      normalize: true
    });
    embeddings.push(Array.from(output.data) as number[]);
  }

  return embeddings;
};

// Text chunking function
const chunkText = (text: string, chunkSize: number): string[] => {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
};

// Document loading function
const loadDocuments = async (): Promise<DocumentChunk[]> => {
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    console.log(`Documents directory ${DOCUMENTS_DIR} not found. Continuing without documents.`);
    return [];
  }

  const files = fs.readdirSync(DOCUMENTS_DIR)
    .filter(f => f.endsWith('.md') || f.endsWith('.txt'));
  const allChunks: DocumentChunk[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(DOCUMENTS_DIR, file), 'utf-8');
    const chunks = chunkText(content, CHUNK_SIZE);
    chunks.forEach(chunk => {
      allChunks.push({ content: chunk, source: file });
    });
  }

  return allChunks;
};

// Initialize vector store
export const initializeVectorStore = async (): Promise<void> => {
  try {
    const documents = await loadDocuments();
    if (documents.length === 0) {
      console.log('No documents to process');
      return;
    }

    // Check if index exists, create if not
    const indexList = await pinecone.listIndexes();
    if (!indexList.indexes?.some(i => i.name === INDEX_NAME)) {
      await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: 384, // all-MiniLM-L6-v2 uses 384 dimensions
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      console.log(`Created index "${INDEX_NAME}"`);
      
      // Wait for index to be ready
      await new Promise(resolve => setTimeout(resolve, 60000)); // Increased wait time for serverless
    }

    const index = pinecone.index(INDEX_NAME);

    // Process documents in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map(d => d.content);
      const embeddings = await getLocalEmbeddings(batchTexts);

      const vectors = batch.map((doc, idx) => ({
        id: `doc-${i + idx}`,
        values: embeddings[idx],
        metadata: {
          content: doc.content,
          source: doc.source
        }
      }));

      await index.upsert(vectors);
      console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }

    console.log(`Successfully initialized vector store with ${documents.length} chunks`);
  } catch (error) {
    console.error('Vector store initialization failed:', error);
    throw error;
  }
};

// Query function
export const getRelevantChunks = async (
  query: string,
  topK: number = 3
): Promise<Array<{ content: string; source: string; score: number }>> => {
  try {
    const index = pinecone.index(INDEX_NAME);
    const queryEmbedding = await getLocalEmbeddings([query]);
    
    const results = await index.query({
      vector: queryEmbedding[0],
      topK,
      includeMetadata: true
    });

    if (!results.matches || results.matches.length === 0) {
      return [];
    }

    return results.matches.map(match => ({
      content: match.metadata?.content as string || '',
      source: match.metadata?.source as string || 'unknown',
      score: match.score || 0
    }));
  } catch (error) {
    console.error('Error querying vector store:', error);
    throw error;
  }
};