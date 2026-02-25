# LocalBOT — Architecture & How It Works

This document explains the two core systems in LocalBOT: the **Electron ↔ Frontend connection** and the **RAG (Retrieval-Augmented Generation) pipeline**.

---

## 1. Electron ↔ Frontend Connection

Electron runs two separate processes that communicate via IPC (Inter-Process Communication):

```
┌──────────────────┐         ┌──────────────────────┐
│  Renderer Process │  IPC   │    Main Process       │
│  (React frontend) │◄─────►│  (Node.js backend)    │
│  Runs in browser  │        │  Has full OS access   │
│  sandbox          │        │  (files, DB, AI, etc) │
└──────────────────┘         └──────────────────────┘
```

The frontend **cannot** access the filesystem, databases, or AI models directly — it runs in a sandboxed browser environment for security. All communication goes through a controlled bridge.

### Step 1: Main Process Creates the Window

**File:** `main.js`

```js
mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,       // Frontend CAN'T access Node.js
    contextIsolation: true,       // Frontend runs in isolation
    preload: path.join(__dirname, "preload.js"),  // Safe bridge
  },
});

// In development → load Vite dev server
mainWindow.loadURL("http://localhost:5173");

// In production → load built React files
mainWindow.loadFile(path.join(__dirname, "frontend/dist/index.html"));
```

The main process also initializes all backend services on startup:

```js
await initDB();              // SQLite database
await initRedis();           // LRU cache
await initElasticsearch();   // Vectra vector store
await initAI();              // Embedding model + LLM
registerIpcHandlers();       // IPC route handlers
```

### Step 2: Preload Script Creates a Safe Bridge

**File:** `preload.js`

This script runs *before* the React app loads. It uses Electron's `contextBridge` to expose a limited, whitelisted API to the frontend:

```js
contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, data) => {
    const validChannels = [
      "documents:list",
      "documents:upload",
      "documents:delete",
      "chat:query",
      "chat:sessions",
      "chat:messages",
      "search:query",
      "system:health",
      "system:stats",
      "system:info",
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);  // Forward to main process
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },

  getPathForFile: (file) => webUtils.getPathForFile(file),
});
```

**Key security features:**
- Only pre-approved channels can be invoked (whitelist)
- The raw `ipcRenderer` is never exposed to the frontend
- `contextIsolation: true` prevents the frontend from tampering with the bridge

### Step 3: Frontend Calls the Bridge

**File:** `frontend/src/lib/api.ts`

The React app wraps `window.electron.invoke()` in a typed API client:

```ts
async function ipcCall<T>(channel: string, data?: any): Promise<T> {
  return await window.electron.invoke(channel, data);
}

export const api = {
  // Chat
  chat: (question, sessionId) =>
    ipcCall("chat:query", { question, session_id: sessionId }),

  // Documents
  listDocuments: () => ipcCall("documents:list"),
  uploadDocument: async (file) => {
    const filePath = window.electron.getPathForFile(file);
    return ipcCall("documents:upload", { filePath, filename: file.name, ... });
  },
  deleteDocument: (id) => ipcCall("documents:delete", id),

  // Search
  search: (query, limit) => ipcCall("search:query", { query, limit }),

  // System
  health: () => ipcCall("system:health"),
  stats:  () => ipcCall("system:stats"),
};
```

### Step 4: Main Process Handles the Request

**File:** `src/ipcHandlers.js`

Each IPC channel maps to a handler that runs in the Node.js main process:

```js
ipcMain.handle("chat:query", async (event, { question, session_id }) => {
  // Save user message to DB
  repo.createMessage({ sessionId, role: "user", content: question });

  // Run RAG pipeline (see Section 2 below)
  const { answer, hits } = await ragQuery(question);

  // Save assistant response to DB
  repo.createMessage({ sessionId, role: "assistant", content: answer, sources });

  return { answer, sources, session_id: sessionId };
});

ipcMain.handle("documents:upload", async (event, { filePath, filename, ... }) => {
  const doc = repo.createDocument({ filename, contentType, sizeBytes });

  // Background: parse → chunk → embed → index
  setImmediate(async () => {
    const content = await parseFile(filePath);
    const chunks = await processDocumentContent(doc.id, filename, content);
    repo.createChunks(dbChunks);
    repo.updateDocumentStatus(doc.id, "indexed");
  });

  return doc;  // Return immediately while indexing happens in background
});
```

### Complete Data Flow: Chat Query

```
User types question
  └─► ChatView.tsx calls api.chat(question)
      └─► window.electron.invoke("chat:query", { question })
          └─► ipcRenderer sends message to main process
              └─► ipcMain.handle("chat:query") receives it
                  ├─► Saves user message to SQLite
                  ├─► ragQuery(question) → RAG pipeline (see below)
                  ├─► Saves assistant response to SQLite
                  └─► Returns { answer, sources, session_id }
              └─► ipcRenderer receives response
          └─► api.chat() resolves with data
      └─► ChatView.tsx renders answer with source citations
```

---

## 2. RAG Pipeline — How It Works

**RAG = Retrieval-Augmented Generation.** Instead of the LLM making things up from its training data, it first *retrieves* relevant passages from your uploaded documents, then generates an answer that's grounded in that context.

### Phase A: Document Ingestion (Upload Time)

When you upload a document, this processing chain runs:

```
File (PDF/DOCX/etc)
  │
  ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   PARSE      │────►│    CHUNK      │────►│    EMBED      │────►│    INDEX      │
│  parser.js   │     │  pipeline.js  │     │  localai.js   │     │elasticsearch │
│              │     │               │     │               │     │    .js       │
│ PDF → text   │     │ Split into    │     │ Text → 384-   │     │ Store in    │
│ DOCX → text  │     │ overlapping   │     │ dim vector    │     │ Vectra      │
│ HTML → text  │     │ ~500-word     │     │ (MiniLM)      │     │ vector DB   │
│ etc.         │     │ chunks        │     │               │     │             │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

#### Step 1: Parse (`src/rag/parser.js`)

Converts any supported file format into plain text:

| Extension | Parser | How |
|-----------|--------|-----|
| `.pdf` | `pdf-parse` | Extracts text layers from PDF |
| `.docx`, `.doc` | `mammoth` | Extracts raw text from Word |
| `.html`, `.htm` | `html-to-text` | Strips HTML tags, keeps content |
| `.csv` | Built-in | Reads as raw text |
| `.json` | Built-in | Pretty-prints JSON |
| `.yaml`, `.yml` | `js-yaml` | Parses and serializes |
| `.txt`, `.md`, `.xml` | Built-in | Reads as-is |

#### Step 2: Chunk (`src/rag/pipeline.js`)

Splits the extracted text into smaller, overlapping pieces:

```
Original text (2000 words)
├── Chunk 0: words 0–500
├── Chunk 1: words 450–950      ← 50-word overlap with previous
├── Chunk 2: words 900–1400     ← prevents losing context at boundaries
└── Chunk 3: words 1350–2000
```

**Why chunk?** LLMs have limited context windows. Chunking lets us retrieve only the most relevant parts instead of stuffing the entire document into the prompt.

**Why overlap?** Important information might span a chunk boundary. Overlap ensures nothing is lost.

#### Step 3: Embed (`src/rag/localai.js`)

Each chunk is converted into a **384-dimensional numerical vector** using the `all-MiniLM-L6-v2` model (via Transformers.js):

```
"Deploy your website by uploading        →  [0.023, -0.145, 0.891, ...]
 files via FTP to the hosting server"         (384 numbers)
```

This vector captures the **semantic meaning** of the text — not just keywords. Texts with similar meanings will have vectors that are close together, even if they use different words.

#### Step 4: Index (`src/rag/elasticsearch.js`)

The embedding vector + metadata is stored in **Vectra**, a local JSON-based vector database:

```js
await index.insertItem({
  vector: embedding,          // The 384-dim vector
  metadata: {
    document_id: "abc-123",
    document_name: "deployment-guide.pdf",
    content: "Deploy your website by uploading files via FTP...",
    chunk_index: 0,
  },
});
```

The data is saved to: `~/Library/Application Support/localbot/vector-data/`

### Phase B: Query Time (When You Ask a Question)

When you type a question in the chat, the RAG query pipeline runs:

```
"How do I deploy my website?"
  │
  ▼
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐     ┌──────────────┐
│  EMBED QUERY  │────►│ SEARCH VECTRA  │────►│ BUILD CONTEXT     │────►│ LLM GENERATE  │
│  localai.js   │     │elasticsearch.js│     │   pipeline.js     │     │  localai.js   │
│               │     │                │     │                   │     │               │
│ Question →    │     │ Find top-K     │     │ Assemble retrieved│     │ TinyLlama     │
│ 384-dim       │     │ most similar   │     │ chunks into a     │     │ generates     │
│ vector        │     │ chunks         │     │ context string    │     │ answer        │
└──────────────┘     └───────────────┘     └──────────────────┘     └──────────────┘
```

#### Step 1: Embed the Question

Your question gets the same embedding treatment as the documents:

```
"How do I deploy my website?"  →  [0.018, -0.132, 0.877, ...]
```

#### Step 2: Similarity Search

Vectra compares your question's vector against all stored chunk vectors using **cosine similarity**. Chunks with the most similar meaning score highest:

```
Query: "How do I deploy my website?"

Results (ranked by cosine similarity):
  0.92 — deployment-guide.pdf, chunk 0: "Deploy your website by uploading..."
  0.87 — deployment-guide.pdf, chunk 1: "Configure your domain DNS settings..."
  0.41 — contract.pdf, chunk 3: "Payment terms are net 30..."  (irrelevant)
```

#### Step 3: Build Context

The top-K results are assembled into a context string for the LLM.

#### Step 4: LLM Generation

The context + question are formatted into a prompt and sent to TinyLlama (via node-llama-cpp):

```
System: You are a helpful, private AI assistant. Answer questions
        based on the provided context from the knowledge base.

User:   Context information is below.
        ---------------------
        [Chunk 1]: Deploy your website by uploading files via FTP
        to the hosting server. Ensure your index.html is in the
        root directory...

        [Chunk 2]: Configure your domain DNS settings by adding
        an A record pointing to the server IP address...
        ---------------------
        Given the context information and not prior knowledge,
        answer the query.
        Query: How do I deploy my website?
```

The LLM reads the context and generates a grounded answer with references to the source documents.

#### Step 5: Return Response

The answer + source citations are returned to the frontend:

```json
{
  "answer": "To deploy your website, upload your files via FTP to the hosting server...",
  "sources": [
    {
      "document_name": "deployment-guide.pdf",
      "chunk_content": "Deploy your website by uploading files via FTP...",
      "score": 0.92
    }
  ],
  "session_id": "abc-123"
}
```

The chat UI displays the answer and lets you expand the sources to see exactly which documents were used.

---

## Why RAG Instead of Just Asking the LLM?

| Without RAG | With RAG |
|---|---|
| LLM only knows its training data | LLM answers from *your* documents |
| Often hallucninates/invents facts | Answers grounded in actual retrieved text |
| No way to verify claims | Shows source citations with relevance scores |
| Can't learn new information | Upload a new doc → instantly queryable |
| Needs massive models for knowledge | Small models work well when given the right context |

---

## Data Flow Diagram (Complete)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UPLOAD FLOW                                 │
│                                                                     │
│  User drops file ──► preload.js ──► ipcHandlers.js                  │
│                        (IPC)          │                              │
│                                       ├── parser.js (file → text)   │
│                                       ├── pipeline.js (text → chunks)│
│                                       ├── localai.js (chunks → vectors)│
│                                       ├── elasticsearch.js (store)  │
│                                       └── repository.js (save to DB)│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         QUERY FLOW                                  │
│                                                                     │
│  User asks question ──► preload.js ──► ipcHandlers.js               │
│                           (IPC)          │                           │
│                                          ├── localai.js (embed query)│
│                                          ├── elasticsearch.js (search)│
│                                          ├── pipeline.js (build ctx) │
│                                          ├── localai.js (LLM answer) │
│                                          └── repository.js (log)    │
│                                          │                           │
│  ChatView renders ◄── preload.js ◄───────┘                          │
│  answer + sources       (IPC)                                       │
└─────────────────────────────────────────────────────────────────────┘
```
