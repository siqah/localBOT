const { ipcMain, app } = require("electron");
const fs = require("fs");
const path = require("path");
const repo = require("./db/repository");
const {
  processDocumentContent,
  deleteDocumentChunks,
  ragQuery,
} = require("./rag/pipeline");
const { parseFile } = require("./rag/parser");
const { cacheGet, cacheSet, cacheDel } = require("./cache/redis");
const { generateEmbedding } = require("./rag/localai");
const { searchSimilar } = require("./rag/elasticsearch");
const { logger } = require("./utils/logger");

// ── IPC Handlers ─────────────────────────────────────

function registerIpcHandlers() {
  // ── Documents ──

  ipcMain.handle("documents:list", async () => {
    try {
      const cached = await cacheGet("documents:list");
      if (cached) return cached;

      const docs = repo.listDocuments();
      await cacheSet("documents:list", docs, 30);
      return docs;
    } catch (err) {
      logger.error("Error listing documents:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "documents:upload",
    async (event, { filePath, filename, sizeStr, mimetype }) => {
      try {
        if (!fs.existsSync(filePath)) throw new Error("File not found on disk");

        const stats = fs.statSync(filePath);
        const size = stats.size;

        // Create document record
        const doc = repo.createDocument({
          filename,
          contentType: mimetype || "text/plain",
          sizeBytes: size,
        });

        // Background process
        setImmediate(async () => {
          try {
            const content = await parseFile(filePath);
            const chunks = await processDocumentContent(
              doc.id,
              filename,
              content,
            );

            const dbChunks = chunks.map((c) => ({
              documentId: doc.id,
              content: c.content,
              chunkIndex: c.index,
              startChar: c.startChar,
              endChar: c.endChar,
            }));

            repo.createChunks(dbChunks);
            repo.updateDocumentStatus(doc.id, "indexed", null, chunks.length);

            repo.logAudit("document.uploaded", "document", doc.id, {
              filename,
              chunks: chunks.length,
            });

            await cacheDel("documents:list");
            logger.info(
              `✅ Document "${filename}" indexed (${chunks.length} chunks)`,
            );
          } catch (err) {
            logger.error(`❌ Failed to process "${filename}":`, err);
            repo.updateDocumentStatus(doc.id, "error", err.message);
          }
        });

        return doc;
      } catch (err) {
        logger.error("Upload error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle("documents:delete", async (event, docId) => {
    try {
      const doc = repo.getDocument(docId);
      if (!doc) throw new Error("Document not found");

      await deleteDocumentChunks(doc.id);
      repo.deleteDocument(doc.id);

      repo.logAudit("document.deleted", "document", doc.id, {
        filename: doc.filename,
      });

      await cacheDel("documents:list");
      return { success: true };
    } catch (err) {
      logger.error("Delete error:", err);
      throw err;
    }
  });

  // ── Chat (RAG) ──

  ipcMain.handle("chat:query", async (event, { question, session_id }) => {
    try {
      if (!question) throw new Error("Question is required");

      let sessionId = session_id;
      if (!sessionId) {
        const session = repo.createSession(question.slice(0, 100));
        sessionId = session.id;
      }

      repo.createMessage({
        sessionId,
        role: "user",
        content: question,
      });

      const startTime = Date.now();
      const { answer, hits } = await ragQuery(question);
      const duration = (Date.now() - startTime) / 1000;

      const sources = hits.map((hit) => ({
        document_id: hit.documentId,
        document_name: hit.documentName,
        chunk_content: hit.content,
        score: hit.score,
      }));

      repo.createMessage({
        sessionId,
        role: "assistant",
        content: answer,
        sources,
      });

      repo.logAudit("chat.query", "chat_session", sessionId, {
        question: question.slice(0, 200),
        sources_count: sources.length,
        duration_seconds: duration,
      });

      logger.info(
        `💬 RAG query answered in ${duration.toFixed(2)}s (${sources.length} sources)`,
      );

      return { answer, sources, session_id: sessionId };
    } catch (err) {
      logger.error("Chat error:", err);
      throw err;
    }
  });

  ipcMain.handle("chat:sessions", async () => {
    try {
      return repo.listSessions();
    } catch (err) {
      throw err;
    }
  });

  ipcMain.handle("chat:messages", async (event, sessionId) => {
    try {
      return repo.getMessagesBySession(sessionId);
    } catch (err) {
      throw err;
    }
  });

  // ── Search ──

  ipcMain.handle("search:query", async (event, { query, limit = 10 }) => {
    try {
      if (!query) throw new Error("Query string is required");
      const embedding = await generateEmbedding(query);
      const hits = await searchSimilar(embedding, Math.min(limit, 50));
      return hits.map((hit) => ({
        document_id: hit.documentId,
        document_name: hit.documentName,
        chunk_content: hit.content,
        score: hit.score,
        chunk_index: hit.chunkIndex,
      }));
    } catch (err) {
      logger.error("Search error:", err);
      throw err;
    }
  });

  // ── System Health / Info ──

  ipcMain.handle("system:health", async () => {
    return {
      status: "healthy",
      services: {
        database: "up",
        redis: "up", // Stubbed by LRU
        elasticsearch: "up", // Stubbed by Vectra
        localai: "up", // Stubbed by node-llama-cpp
        opa: "up", // Stubbed/offline-first
      },
      timestamp: new Date().toISOString(),
    };
  });

  ipcMain.handle("system:stats", async () => {
    try {
      return repo.getStats();
    } catch (err) {
      logger.error("Stats error:", err);
      throw err;
    }
  });

  ipcMain.handle("system:info", () => {
    return {
      appData: app.getPath("userData"),
      platform: process.platform,
      version: app.getVersion(),
    };
  });

  logger.info("🔌 Electron IPC Handlers registered");
}

module.exports = { registerIpcHandlers };
