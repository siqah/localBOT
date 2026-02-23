const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { logger } = require("../utils/logger");

let db = null;

/**
 * Get the path for the local SQLite database
 */
function getDbPath() {
  // Use appData in production context (so .exe/.dmg store data safely)
  // Fall back to local folder if app is not available (e.g. CLI testing)
  const userDataPath = app
    ? app.getPath("userData")
    : path.join(__dirname, "..", "..");
  const dbDir = path.join(userDataPath, "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, "localbot.db");
}

/**
 * Initialize SQLite database connection
 */
async function initDB() {
  const dbPath = getDbPath();
  logger.info(`📖 Initializing SQLite database at: ${dbPath}`);

  db = new Database(dbPath, {
    // verbose: logger.debug
  });

  // Enforce foreign keys and WAL mode for better concurrency
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");

  // Run migrations
  await runMigrations();
  return db;
}

/**
 * Run SQLite schema migrations manually
 */
async function runMigrations() {
  const migrationsPath = path.join(__dirname, "..", "..", "migrations");

  // Create a minimal table to track applied migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (!fs.existsSync(migrationsPath)) {
    logger.info("No migrations folder found.");
    return;
  }

  const files = fs.readdirSync(migrationsPath).sort();
  for (const file of files) {
    if (!file.endsWith(".sql")) continue;

    // Check if applied
    const row = db
      .prepare("SELECT id FROM migrations WHERE name = ?")
      .get(file);
    if (!row) {
      logger.info(`Applying migration: ${file}`);
      const sqlText = fs.readFileSync(path.join(migrationsPath, file), "utf8");

      // better-sqlite3 handles multi-statement execution cleanly via .exec()
      db.exec(sqlText);

      db.prepare("INSERT INTO migrations (name) VALUES (?)").run(file);
    }
  }
}

/**
 * Get the SQLite database connection
 */
function getDB() {
  if (!db) throw new Error("Database not initialized. Call initDB() first.");
  return db;
}

module.exports = { initDB, getDB, getDbPath };
