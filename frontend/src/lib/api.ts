// ── Type Definitions ─────────────────────────────

export interface Document {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  chunk_count: number;
  status: "pending" | "processing" | "indexed" | "error";
  error_msg?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SourceRef {
  document_id: string;
  document_name: string;
  chunk_content: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: SourceRef[];
  created_at: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceRef[];
  session_id: string;
}

export interface SearchResult {
  document_id: string;
  document_name: string;
  chunk_content: string;
  score: number;
  chunk_index: number;
}

export interface HealthStatus {
  status: string;
  services: Record<string, string>;
  timestamp: string;
}

export interface SystemStats {
  total_documents: number;
  total_chunks: number;
  total_sessions: number;
  storage_bytes: number;
}

export interface SystemInfo {
  appData: string;
  platform: string;
  version: string;
}

// ── IPC API Client ───────────────────────────────
// We replace the traditional fetch() HTTP client with Electron's IPC bridge.

// Declare the window.electron type exposed by preload.js
declare global {
  interface Window {
    electron: {
      invoke: (channel: string, data?: any) => Promise<any>;
      getPathForFile: (file: File) => string;
      onChatToken: (callback: (token: string) => void) => void;
      onChatTokenDone: (callback: () => void) => void;
      removeChatTokenListeners: () => void;
    };
  }
}

/**
 * Safely call the Electron IPC main process.
 */
async function ipcCall<T>(channel: string, data?: any): Promise<T> {
  if (!window.electron || !window.electron.invoke) {
    throw new Error(
      "Electron IPC bridge not found! Ensure the app is running in Electron, not a web browser.",
    );
  }

  try {
    return await window.electron.invoke(channel, data);
  } catch (err: any) {
    throw new Error(err.message || "Unknown IPC Error");
  }
}

export const api = {
  // System Health / Info
  health: () => ipcCall<HealthStatus>("system:health"),
  stats: () => ipcCall<SystemStats>("system:stats"),
  info: () => ipcCall<SystemInfo>("system:info"),

  // Documents
  uploadDocument: async (file: File): Promise<Document> => {
    // In Electron, use webUtils.getPathForFile to get the absolute path
    if (!window.electron?.getPathForFile) {
      throw new Error(
        "File upload requires the Electron desktop app. The browser cannot access file paths.",
      );
    }

    const filePath = window.electron.getPathForFile(file);

    return ipcCall<Document>("documents:upload", {
      filePath,
      filename: file.name,
      sizeStr: file.size.toString(),
      mimetype: file.type,
    });
  },
  listDocuments: () => ipcCall<Document[]>("documents:list"),
  // getDocument is not strictly needed for the UI, but can be added if required
  deleteDocument: (id: string) =>
    ipcCall<{ success: boolean }>("documents:delete", id),

  // Chat
  chat: (question: string, sessionId?: string) =>
    ipcCall<ChatResponse>("chat:query", { question, session_id: sessionId }),
  listSessions: () => ipcCall<ChatSession[]>("chat:sessions"),
  getSessionMessages: (sessionId: string) =>
    ipcCall<ChatMessage[]>("chat:messages", sessionId),

  // Search
  search: (query: string, limit = 10) =>
    ipcCall<SearchResult[]>("search:query", { query, limit }),
};
