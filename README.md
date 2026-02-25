# LocalBOT — Private AI Desktop Assistant

> **Your private AI assistant that runs 100% offline — secure, fast, and works with all your local files.**

## 🔐 The Problem

Most AI assistants (ChatGPT, Copilot, Claude) require sending your data to cloud servers. This creates serious concerns when working with:

- **Sensitive documents** — contracts, financial records, legal files, medical data
- **Proprietary knowledge** — internal docs, trade secrets, research notes
- **Regulated environments** — industries with strict data residency requirements
- **Personal privacy** — users who simply don't want their data leaving their machine

## 💡 The Solution

LocalBOT is a standalone, cross-platform **Electron desktop app** that lets you chat with your documents using a fully local **RAG (Retrieval-Augmented Generation)** pipeline. No cloud, no API keys, no internet — just download and run.

Your documents are parsed, chunked, embedded, and indexed entirely on your machine. When you ask a question, the AI retrieves the most relevant passages from your knowledge base and generates an answer — all locally.

## ✨ Features

- 📄 **Document Management** — Upload and manage PDF, DOCX, TXT, Markdown, CSV, JSON, YAML, and HTML files
- 🧠 **Local AI Models** — Embeddings via Transformers.js + LLM inference via node-llama-cpp (no API keys needed)
- 🔍 **Semantic Search** — Find relevant information across all your documents using vector similarity (not just keyword matching)
- 💬 **Chat with Citations** — Ask questions and get AI-generated answers with source references pointing to exact document passages
- 🔒 **100% Offline** — All processing happens on your device. Zero data ever leaves your machine
- 🖥️ **Cross-Platform** — Runs on macOS, Windows, and Linux
- 🎨 **Modern UI** — Clean, responsive React interface with dark/light mode

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Electron Shell                    │
│                                                     │
│  ┌──────────────┐         ┌──────────────────────┐  │
│  │   Frontend    │  IPC   │     Main Process      │  │
│  │  React + TS   │◄─────►│                        │  │
│  │  Tailwind CSS │        │  ┌──────────────────┐ │  │
│  └──────────────┘         │  │   RAG Pipeline    │ │  │
│                           │  │  ┌─────────────┐  │ │  │
│                           │  │  │  Parser      │  │ │  │
│                           │  │  │  Chunker     │  │ │  │
│                           │  │  │  Embedder    │  │ │  │
│                           │  │  │  LLM         │  │ │  │
│                           │  │  └─────────────┘  │ │  │
│                           │  └──────────────────┘ │  │
│                           │                        │  │
│                           │  ┌─────┐ ┌─────────┐  │  │
│                           │  │SQLite│ │ Vectra  │  │  │
│                           │  └─────┘ └─────────┘  │  │
│                           └──────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Shell** | Electron | Cross-platform desktop runtime |
| **Frontend** | React + TypeScript + Tailwind CSS | User interface |
| **Database** | SQLite (`better-sqlite3`) | Document metadata, chat sessions, audit logs |
| **Cache** | In-memory LRU Cache (`lru-cache`) | Response caching |
| **Vector DB** | Vectra (local JSON-based) | Embedding storage & similarity search |
| **Embeddings** | `@xenova/transformers` (`all-MiniLM-L6-v2`) | Document & query embedding |
| **LLM** | `node-llama-cpp` (GGUF models) | Local text generation |
| **IPC** | Electron `ipcMain` / `ipcRenderer` | Secure frontend ↔ backend communication |

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 9+
- A GGUF model file (e.g., [TinyLlama 1.1B Chat](https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF))

### Install & Run

```bash
# 1. Clone the repository
git clone <repo-url>
cd localBOT

# 2. Install backend dependencies
npm install

# 3. Install frontend dependencies
cd frontend && npm install && cd ..

# 4. Download a GGUF model (example: TinyLlama)
#    Place the .gguf file in:
#    macOS:  ~/Library/Application Support/localbot/models/
#    Win:    %APPDATA%/localbot/models/
#    Linux:  ~/.config/localbot/models/

# 5. Start in development mode
npm run dev
```

The app will launch an Electron window with the React frontend. The Vite dev server runs on `http://localhost:5173`.

### Build for Distribution

```bash
# Build React bundle + package Electron app
npm run build
```

Distributable installers are generated in `dist/`:
- **macOS**: `.dmg`, `.zip`
- **Windows**: `.exe` (NSIS), `.zip`
- **Linux**: `.AppImage`, `.deb`

## 📁 Project Structure

```
localBOT/
├── main.js                  # Electron main process — app lifecycle & window
├── preload.js               # Secure IPC bridge (context isolation)
├── package.json             # Root config & electron-builder settings
├── migrations/
│   └── 001_init.sql         # SQLite schema (documents, chunks, sessions, etc.)
├── src/
│   ├── ipcHandlers.js       # All IPC route handlers (documents, chat, search, system)
│   ├── cache/
│   │   └── redis.js         # LRU in-memory cache (Redis API-compatible interface)
│   ├── db/
│   │   ├── database.js      # SQLite connection & migration runner
│   │   └── repository.js    # Data access layer (CRUD for documents, sessions, etc.)
│   ├── rag/
│   │   ├── parser.js        # File parser (PDF, DOCX, HTML, CSV, YAML, etc.)
│   │   ├── pipeline.js      # RAG orchestration (chunk → embed → index → query)
│   │   ├── elasticsearch.js # Vectra vector store (similarity search)
│   │   └── localai.js       # AI models (Transformers.js embeddings + Llama LLM)
│   └── utils/
│       └── logger.js        # Winston logger
└── frontend/                # React + Vite + Tailwind UI
    ├── src/
    │   ├── App.tsx           # Main layout with sidebar navigation
    │   ├── main.tsx          # React entry point
    │   ├── index.css         # Tailwind + custom design system
    │   ├── lib/
    │   │   └── api.ts        # IPC client — typed API for all backend calls
    │   └── pages/
    │       ├── ChatView.tsx       # Chat interface with source citations
    │       ├── DocumentsView.tsx  # Document upload, list & management
    │       ├── KnowledgeView.tsx  # Semantic search explorer
    │       └── SettingsView.tsx   # System health, stats & RAG config
    └── vite.config.ts        # Vite build configuration
```

## 🔄 How It Works

1. **Upload** — Drop a document (PDF, DOCX, etc.) into the app
2. **Parse** — The file is converted to plain text using format-specific parsers
3. **Chunk** — Text is split into overlapping chunks for better retrieval
4. **Embed** — Each chunk is embedded into a 384-dim vector using `all-MiniLM-L6-v2`
5. **Index** — Embeddings are stored in the local Vectra vector database
6. **Query** — When you ask a question, your query is embedded and the most similar chunks are retrieved
7. **Generate** — The retrieved context + your question are sent to the local LLM, which generates an answer with citations

## 🛡️ Privacy & Security

- **No network calls** — The app makes zero HTTP requests. Everything runs locally
- **Context isolation** — The Electron frontend runs in a sandboxed renderer with `contextIsolation: true`
- **Whitelisted IPC** — Only pre-approved IPC channels can be invoked from the frontend
- **Local storage** — All data (SQLite DB, vector index, models) is stored in the OS user data directory

## 📜 License

MIT
