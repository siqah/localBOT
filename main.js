const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const isDev = !app.isPackaged;

// Backend integrations
const { initDB } = require("./src/db/database");
const { initRedis } = require("./src/cache/redis");
const { initElasticsearch } = require("./src/rag/elasticsearch");
const { initAI } = require("./src/rag/localai");
const { registerIpcHandlers } = require("./src/ipcHandlers");
const { logger } = require("./src/utils/logger");

// Global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  // Use .png at runtime (Electron nativeImage supports png/jpg/gif)
  // .icns and .ico are used automatically by electron-builder for production builds
  const iconPath = path.join(__dirname, "build", "icon.png");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    titleBarStyle: "hidden", // Mac-style hidden titlebar
    titleBarOverlay: true, // Windows controls
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Set macOS dock icon
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(iconPath);
  }

  // Load the React frontend
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built React files
    mainWindow.loadFile(path.join(__dirname, "frontend/dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    logger.info("🚀 Starting LocalBOT Desktop...");

    try {
      // 1. Initialize embedded infrastructure
      await initDB();
      await initRedis();
      await initElasticsearch();
      await initAI();

      // 2. Register IPC Handlers
      registerIpcHandlers();

      // 3. Create main window
      createWindow();
    } catch (err) {
      logger.error("Failed to initialize local services:", err);
      dialog.showErrorBox(
        "Initialization Error",
        `Failed to start local services: ${err.message}`,
      );
      app.quit();
    }

    app.on("activate", () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
