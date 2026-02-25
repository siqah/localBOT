const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { pipeline, env } = require("@xenova/transformers");
const { logger } = require("../utils/logger");

// Configure Transformers.js
env.allowLocalModels = true;
env.useBrowserCache = false;

// Determine model storage path
const modelsDir = app
  ? path.join(app.getPath("userData"), "models")
  : path.join(__dirname, "..", "..", "models");
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}
env.localModelPath = modelsDir;
env.cacheDir = modelsDir;

let embedder = null;

// node-llama-cpp v3 objects
let llama = null;
let llamaModel = null;
let llamaContext = null;

/**
 * Initialize the locally embedded AI models
 */
async function initAI() {
  logger.info("🧠 Initializing local AI models...");

  // Initialize Embeddings (all-MiniLM-L6-v2)
  try {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true,
    });
    logger.info("✅ Transformers.js embedding model loaded");
  } catch (err) {
    logger.error("Failed to load embedding model:", err);
  }

  // Initialize LLM (node-llama-cpp v3)
  try {
    const { getLlama } = await import("node-llama-cpp");

    // Look for any .gguf file in the models directory
    const files = fs.readdirSync(modelsDir);
    const ggufFile = files.find((f) => f.endsWith(".gguf"));

    if (ggufFile) {
      const modelPath = path.join(modelsDir, ggufFile);

      // node-llama-cpp v3 uses async factory pattern
      llama = await getLlama();
      llamaModel = await llama.loadModel({ modelPath });
      llamaContext = await llamaModel.createContext({
        contextSize: 1024, // Smaller = faster on CPU-only
        batchSize: 512, // Process more tokens per step
      });

      logger.info(`✅ Llama-CPP loaded model: ${ggufFile}`);
    } else {
      logger.warn(
        "⚠️ No .gguf model found in models directory. LLM features will be disabled until downloaded.",
      );
      logger.warn(`   Model directory: ${modelsDir}`);
      logger.warn(
        "   Download a GGUF model (e.g. tinyllama-1.1b-chat) and place it in the models directory.",
      );
    }
  } catch (err) {
    logger.error("Failed to initialize node-llama-cpp:", err.message);
  }
}

/**
 * Generate an embedding for a single text using Transformers.js
 */
async function generateEmbedding(text) {
  if (!embedder) throw new Error("Embedding model not initialized");

  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Generate embeddings for multiple texts
 */
async function generateEmbeddings(texts) {
  if (!embedder) throw new Error("Embedding model not initialized");
  const embeddings = [];
  for (const text of texts) {
    const emb = await generateEmbedding(text);
    embeddings.push(emb);
  }
  return embeddings;
}

/**
 * Chat completions using node-llama-cpp v3
 */
async function chatCompletion(systemPrompt, userMessage, contextStr = "") {
  if (!llamaContext) {
    throw new Error(
      "LLM not initialized — no .gguf model found. " +
        `Place a GGUF model file in: ${modelsDir}`,
    );
  }

  const { LlamaChatSession } = await import("node-llama-cpp");

  const sequence = llamaContext.getSequence();
  const session = new LlamaChatSession({
    contextSequence: sequence,
    systemPrompt: systemPrompt,
  });

  let fullPrompt = userMessage;
  if (contextStr) {
    fullPrompt = `Use the following context to answer the question. Cite the source documents.\n\nContext:\n${contextStr}\n\nQuestion: ${userMessage}\n\nAnswer:`;
  }

  try {
    const response = await session.prompt(fullPrompt, {
      temperature: 0.1,
      maxTokens: 512, // Most answers fit in 200-400 tokens; was 2048
    });

    return response;
  } finally {
    session.dispose();
    sequence.dispose();
  }
}

/**
 * Streaming chat completions — calls onToken for each generated chunk
 */
async function chatCompletionStream(
  systemPrompt,
  userMessage,
  contextStr = "",
  onToken = () => {},
) {
  if (!llamaContext) {
    throw new Error(
      "LLM not initialized — no .gguf model found. " +
        `Place a GGUF model file in: ${modelsDir}`,
    );
  }

  const { LlamaChatSession } = await import("node-llama-cpp");

  const sequence = llamaContext.getSequence();
  const session = new LlamaChatSession({
    contextSequence: sequence,
    systemPrompt: systemPrompt,
  });

  let fullPrompt = userMessage;
  if (contextStr) {
    fullPrompt = `Use the following context to answer the question. Cite the source documents.\n\nContext:\n${contextStr}\n\nQuestion: ${userMessage}\n\nAnswer:`;
  }

  try {
    const response = await session.prompt(fullPrompt, {
      temperature: 0.1,
      maxTokens: 512,
      onTextChunk(chunk) {
        onToken(chunk);
      },
    });

    return response;
  } finally {
    session.dispose();
    sequence.dispose();
  }
}

/**
 * Check AI status
 */
async function localAIPing() {
  if (!embedder && !llamaContext) throw new Error("No AI models loaded");
}

module.exports = {
  initAI,
  generateEmbedding,
  generateEmbeddings,
  chatCompletion,
  chatCompletionStream,
  localAIPing,
};
