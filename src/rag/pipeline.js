const { generateEmbedding, chatCompletion } = require("./localai");
const {
  indexChunk,
  searchSimilar,
  deleteDocumentChunks,
} = require("./elasticsearch");
const { logger } = require("../utils/logger");

// Default chunking parameters (previously in config.js)
const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 50;

const RAG_SYSTEM_PROMPT = `You are a helpful, private AI assistant named LocalBOT. You answer questions based ONLY on the provided context from the user's local knowledge base. If the context doesn't contain enough information to answer the question, say so honestly. Always cite which documents your answer comes from. Be concise and accurate.`;

// ── Text Chunking ───────────────────────────────

/**
 * Split text into overlapping chunks by word count
 * @param {string} text - Input text
 * @param {number} chunkSize - Words per chunk
 * @param {number} overlap - Overlap words between chunks
 * @returns {Array<{content: string, index: number, startChar: number, endChar: number}>}
 */
function chunkText(
  text,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks = [];
  let i = 0;
  let idx = 0;
  let charPos = 0;

  while (i < words.length) {
    const end = Math.min(i + chunkSize, words.length);
    const chunkWords = words.slice(i, end);
    const content = chunkWords.join(" ");
    const endChar = charPos + content.length;

    chunks.push({
      content,
      index: idx,
      startChar: charPos,
      endChar,
    });

    idx++;
    const step = Math.max(chunkSize - overlap, 1);
    i += step;
    charPos = endChar;
  }

  return chunks;
}

// ── RAG Query Pipeline ──────────────────────────

/**
 * Full RAG pipeline: embed query → search → generate answer
 * @param {string} question - User's question
 * @returns {{ answer: string, hits: Array }}
 */
async function ragQuery(question) {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(question);

  // 2. Search for relevant chunks
  const hits = await searchSimilar(queryEmbedding, 5);

  // 3. Build context from hits
  const contextParts = hits.map(
    (hit, i) =>
      `[Source ${i + 1}: ${hit.documentName} (chunk ${hit.chunkIndex + 1})]\n${hit.content}`,
  );
  const contextStr = contextParts.join("\n\n---\n\n");

  // 4. Generate answer using LLM
  const answer = await chatCompletion(RAG_SYSTEM_PROMPT, question, contextStr);

  return { answer, hits };
}

// ── Document Processing ─────────────────────────

/**
 * Process a document: chunk → embed → index
 * @param {string} docId - Document UUID
 * @param {string} docName - Original filename
 * @param {string} content - Raw text content
 * @returns {number} Number of chunks processed
 */
async function processDocumentContent(docId, docName, content) {
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    throw new Error("No text content found in document");
  }

  let indexed = 0;

  for (const chunk of chunks) {
    try {
      // Generate embedding
      const embedding = await generateEmbedding(chunk.content);

      // Index in Elasticsearch
      await indexChunk({
        documentId: docId,
        documentName: docName,
        content: chunk.content,
        chunkIndex: chunk.index,
        embedding,
      });

      indexed++;
    } catch (err) {
      logger.warn(`Failed to process chunk ${chunk.index}: ${err.message}`);
    }
  }

  logger.info(
    `📝 Processed ${indexed}/${chunks.length} chunks for "${docName}"`,
  );
  return chunks;
}

module.exports = {
  chunkText,
  ragQuery,
  processDocumentContent,
  deleteDocumentChunks,
};
