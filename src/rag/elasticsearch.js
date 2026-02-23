const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { LocalIndex } = require("vectra");
const { logger } = require("../utils/logger");

let index = null;

/**
 * Get the path for the local Vectra database
 */
function getVectorDbPath() {
  const userDataPath = app
    ? app.getPath("userData")
    : path.join(__dirname, "..", "..");
  const dbDir = path.join(userDataPath, "vector-data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return dbDir;
}

/**
 * Initialize Vectra index
 */
async function initElasticsearch() {
  const folderPath = getVectorDbPath();
  logger.info(
    `🔍 Initializing local Vector Database (Vectra) at: ${folderPath}`,
  );

  index = new LocalIndex(folderPath);

  if (!(await index.isIndexCreated())) {
    await index.createIndex();
    logger.info("✅ Vectra vector index created");
  }
}

/**
 * Index a document chunk with its embedding
 */
async function indexChunk({
  documentId,
  documentName,
  content,
  chunkIndex,
  embedding,
}) {
  if (!index) throw new Error("Vector DB not initialized");

  await index.insertItem({
    vector: embedding,
    metadata: {
      document_id: documentId,
      document_name: documentName,
      content,
      chunk_index: chunkIndex,
    },
  });
}

/**
 * Perform vector similarity search
 */
async function searchSimilar(queryEmbedding, k = 5) {
  if (!index) throw new Error("Vector DB not initialized");

  const results = await index.queryItems(queryEmbedding, k);

  return results.map((hit) => ({
    documentId: hit.item.metadata.document_id,
    documentName: hit.item.metadata.document_name,
    content: hit.item.metadata.content,
    chunkIndex: hit.item.metadata.chunk_index,
    score: hit.score,
  }));
}

/**
 * Delete all chunks belonging to a document
 */
async function deleteDocumentChunks(documentId) {
  if (!index) return;

  // We need to retrieve the items to delete them in Vectra
  // A bit slower than Elasticsearch, but fully local
  const items = await index.listItemsByMetadata({ document_id: documentId });
  for (const item of items) {
    await index.deleteItem(item.id);
  }
}

module.exports = {
  initElasticsearch,
  indexChunk,
  searchSimilar,
  deleteDocumentChunks,
};
