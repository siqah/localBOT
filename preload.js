const { contextBridge, ipcRenderer, webUtils } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object to the browser window.
contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, data) => {
    // Whitelist channels to prevent arbitrary IPC execution
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
      // Provide system info
      "system:info",
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  // Get the absolute filesystem path for a File object from <input type="file">
  getPathForFile: (file) => webUtils.getPathForFile(file),
  // We can also add listener APIs if we want progress updates later
  onProgress: (callback) =>
    ipcRenderer.on("progress", (_event, data) => callback(data)),
  removeProgressListener: () => ipcRenderer.removeAllListeners("progress"),
});
