const fs = require("fs");
const path = require("path");
const { logger } = require("../utils/logger");

/**
 * Parse a file's content to plain text based on its extension.
 * Supports: .txt, .md, .json, .yaml, .yml, .csv, .html, .htm, .xml, .pdf, .docx, .doc
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} Extracted text content
 */
async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  logger.info(`📄 Parsing file: ${path.basename(filePath)} (${ext})`);

  switch (ext) {
    // ── Plain Text ──
    case ".txt":
    case ".md":
    case ".xml":
      return fs.readFileSync(filePath, "utf8");

    // ── JSON ──
    case ".json": {
      const raw = fs.readFileSync(filePath, "utf8");
      try {
        const obj = JSON.parse(raw);
        return JSON.stringify(obj, null, 2);
      } catch {
        return raw;
      }
    }

    // ── YAML ──
    case ".yaml":
    case ".yml": {
      const yaml = require("js-yaml");
      const raw = fs.readFileSync(filePath, "utf8");
      try {
        const obj = yaml.load(raw);
        return typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
      } catch {
        return raw;
      }
    }

    // ── CSV ──
    case ".csv": {
      // Read CSV as text; users can also use csv-parser for structured access
      const raw = fs.readFileSync(filePath, "utf8");
      return raw;
    }

    // ── HTML ──
    case ".html":
    case ".htm": {
      const { convert } = require("html-to-text");
      const raw = fs.readFileSync(filePath, "utf8");
      return convert(raw, {
        wordwrap: false,
        selectors: [
          { selector: "a", options: { ignoreHref: true } },
          { selector: "img", format: "skip" },
        ],
      });
    }

    // ── PDF ──
    case ".pdf": {
      const pdfParse = require("pdf-parse");
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      if (!data.text || data.text.trim().length === 0) {
        throw new Error(
          "PDF contains no extractable text (may be scanned/image-only)",
        );
      }
      return data.text;
    }

    // ── DOCX (Word) ──
    case ".docx":
    case ".doc": {
      const mammoth = require("mammoth");
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value || result.value.trim().length === 0) {
        throw new Error("Word document contains no extractable text");
      }
      return result.value;
    }

    default:
      // Fall back to plain text
      logger.warn(
        `⚠️ Unknown file extension ${ext}, attempting to read as plaintext`,
      );
      return fs.readFileSync(filePath, "utf8");
  }
}

module.exports = { parseFile };
