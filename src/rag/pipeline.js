const {
  generateEmbedding,
  chatCompletion,
  chatCompletionStream,
} = require("./localai");
const {
  indexChunk,
  searchSimilar,
  deleteDocumentChunks,
} = require("./elasticsearch");
const { logger } = require("../utils/logger");

// Default chunking parameters
const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 50;

const RAG_SYSTEM_PROMPT = `You are LocalBOT, a helpful AI assistant. Answer the user's question using the provided context. Always reference which source documents you used. Keep answers clear and concise.`;

// ── Text Chunking ───────────────────────────────

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
 * Full RAG pipeline (non-streaming)
 */
async function ragQuery(question) {
  const queryEmbedding = await generateEmbedding(question);
  const hits = await searchSimilar(queryEmbedding, 3);

  const contextParts = hits.map(
    (hit, i) =>
      `[Source ${i + 1}: ${hit.documentName} (chunk ${hit.chunkIndex + 1})]\n${hit.content}`,
  );
  const contextStr = contextParts.join("\n\n");
  const answer = await chatCompletion(RAG_SYSTEM_PROMPT, question, contextStr);

  return { answer, hits };
}

/**
 * Streaming RAG pipeline — calls onToken for each generated token
 */
async function ragQueryStream(question, onToken) {
  const queryEmbedding = await generateEmbedding(question);
  const hits = await searchSimilar(queryEmbedding, 3);

  const contextParts = hits.map(
    (hit, i) =>
      `[Source ${i + 1}: ${hit.documentName} (chunk ${hit.chunkIndex + 1})]\n${hit.content}`,
  );
  const contextStr = contextParts.join("\n\n");

  const answer = await chatCompletionStream(
    RAG_SYSTEM_PROMPT,
    question,
    contextStr,
    onToken,
  );

  return { answer, hits };
}

// ── Document Processing ─────────────────────────

async function processDocumentContent(docId, docName, content) {
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    throw new Error("No text content found in document");
  }

  let indexed = 0;

  for (const chunk of chunks) {
    try {
      const embedding = await generateEmbedding(chunk.content);

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
  ragQueryStream,
  processDocumentContent,
  deleteDocumentChunks,
};
