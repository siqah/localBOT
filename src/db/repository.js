const { v4: uuidv4 } = require("uuid");
const { getDB } = require("./database");
const { logger } = require("../utils/logger");

// ── Document Operations ─────────────────────────

function createDocument({ filename, contentType, sizeBytes }) {
  const db = getDB();
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO documents (id, filename, content_type, size_bytes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'processing', datetime('now'), datetime('now'))
    RETURNING *
  `);
  return stmt.get(id, filename, contentType, sizeBytes);
}

function getDocument(id) {
  const db = getDB();
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(id) || null;
}

function listDocuments() {
  const db = getDB();
  return db.prepare("SELECT * FROM documents ORDER BY created_at DESC").all();
}

function updateDocumentStatus(id, status, errorMsg = null, chunkCount = 0) {
  const db = getDB();
  db.prepare(
    `
    UPDATE documents SET status = ?, error_msg = ?, chunk_count = ?, updated_at = datetime('now') WHERE id = ?
  `,
  ).run(status, errorMsg, chunkCount, id);
}

function deleteDocument(id) {
  const db = getDB();
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
}

// ── Chunk Operations ────────────────────────────

function createChunks(chunks) {
  const db = getDB();
  const insert = db.prepare(`
    INSERT INTO chunks (id, document_id, content, chunk_index, start_char, end_char, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertMany = db.transaction((rows) => {
    for (const chunk of rows) {
      insert.run(
        uuidv4(),
        chunk.documentId,
        chunk.content,
        chunk.chunkIndex,
        chunk.startChar,
        chunk.endChar,
        chunk.metadata || "{}",
      );
    }
  });

  insertMany(chunks);
}

function getChunksByDocument(docId) {
  const db = getDB();
  return db
    .prepare("SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index")
    .all(docId);
}

// ── Chat Session Operations ─────────────────────

function createSession(title = "New Chat") {
  const db = getDB();
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO chat_sessions (id, title, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now')) RETURNING *
  `);
  return stmt.get(id, title);
}

function listSessions() {
  const db = getDB();
  return db
    .prepare("SELECT * FROM chat_sessions ORDER BY updated_at DESC")
    .all();
}

function deleteSession(id) {
  const db = getDB();
  db.transaction(() => {
    db.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(id);
  })();
}

// ── Chat Message Operations ─────────────────────

function createMessage({ sessionId, role, content, sources = [] }) {
  const db = getDB();
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO chat_messages (id, session_id, role, content, sources, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now')) RETURNING *
  `);
  return stmt.get(id, sessionId, role, content, JSON.stringify(sources));
}

function getMessagesBySession(sessionId) {
  const db = getDB();
  return db
    .prepare(
      "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at",
    )
    .all(sessionId);
}

// ── Statistics ──────────────────────────────────

function getStats() {
  const db = getDB();
  const docs = db
    .prepare("SELECT COALESCE(COUNT(*), 0) as count FROM documents")
    .get();
  const chunks = db
    .prepare("SELECT COALESCE(COUNT(*), 0) as count FROM chunks")
    .get();
  const sessions = db
    .prepare("SELECT COALESCE(COUNT(*), 0) as count FROM chat_sessions")
    .get();
  const storage = db
    .prepare("SELECT COALESCE(SUM(size_bytes), 0) as total FROM documents")
    .get();

  return {
    total_documents: parseInt(docs.count),
    total_chunks: parseInt(chunks.count),
    total_sessions: parseInt(sessions.count),
    storage_bytes: parseInt(storage.total),
  };
}

// ── Audit Log ───────────────────────────────────

function logAudit(action, entity, entityId, details = {}) {
  try {
    const db = getDB();
    db.prepare(
      `
      INSERT INTO audit_log (id, action, entity, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `,
    ).run(uuidv4(), action, entity, entityId, JSON.stringify(details));
  } catch (err) {
    logger.error(`Failed to write audit log: ${err.message}`);
  }
}

module.exports = {
  createDocument,
  getDocument,
  listDocuments,
  updateDocumentStatus,
  deleteDocument,
  createChunks,
  getChunksByDocument,
  createSession,
  listSessions,
  deleteSession,
  createMessage,
  getMessagesBySession,
  getStats,
  logAudit,
};
