# LocalBOT — Private AI Desktop Assistant

> **Your private AI assistant that runs 100% offline — secure, fast, and works with all your local files.**

LocalBOT is a standalone, cross-platform Electron desktop application that lets you chat with your documents using a fully local RAG (Retrieval Augmented Generation) pipeline. No cloud, no Docker — just download and run.

## ✨ Features

- 📄 **Document Management** — Upload PDF, DOCX, TXT, Markdown, CSV, JSON, YAML, and HTML files
- 🧠 **Local AI** — Embeddings via Transformers.js (`all-MiniLM-L6-v2`) + LLM inference via node-llama-cpp
- 🔍 **Semantic Search** — Find relevant information across all your documents using Vectra vector search
- 💬 **Chat Interface** — Ask questions and get AI-powered answers with source citations
- 🔒 **100% Offline** — All data stays on your machine. No cloud services required
- 🖥️ **Cross-Platform** — Runs on Windows, macOS, and Linux

## 🏗️ Architecture

| Component | Technology |
|---|---|
| **Shell** | Electron |
| **Frontend** | React + TypeScript + Tailwind CSS |
| **Database** | SQLite (better-sqlite3) |
| **Cache** | In-memory LRU Cache |
| **Vector DB** | Vectra (local JSON-based) |
| **Embeddings** | @xenova/transformers (all-MiniLM-L6-v2) |
| **LLM** | node-llama-cpp (.gguf models) |
| **IPC** | Electron ipcMain / ipcRenderer |

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 9+

### Install & Run (Development)

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Start in development mode
npm run dev
```

### Build for Distribution

```bash
# Build the production React bundle and package the Electron app
npm run build
```

Distributable installers will be generated in the `dist/` folder:
- **macOS**: `.dmg`, `.zip`
- **Windows**: `.exe` (NSIS), `.zip`
- **Linux**: `.AppImage`, `.deb`

## 📁 Project Structure

```
localBOT/
├── main.js              # Electron main process
├── preload.js           # Secure IPC bridge
├── package.json         # Root config & electron-builder settings
├── migrations/          # SQLite schema migrations
├── models/              # AI models (downloaded at runtime)
├── src/
│   ├── cache/redis.js   # LRU in-memory cache
│   ├── db/
│   │   ├── database.js  # SQLite connection & migrations
│   │   └── repository.js# Data access layer
│   ├── rag/
│   │   ├── chunker.js   # Document chunking
│   │   ├── elasticsearch.js  # Vectra vector store
│   │   └── localai.js   # Transformers.js + node-llama-cpp
│   ├── utils/logger.js  # Winston logging
│   └── ipcHandlers.js   # IPC route handlers
└── frontend/            # React + Vite + Tailwind UI
```

## 📜 License

MIT
