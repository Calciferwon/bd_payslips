const { contextBridge, ipcRenderer } = require("electron")

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  login: () => ipcRenderer.invoke("google-login"),
  onLoginError: (callback) => {
    ipcRenderer.on("login-error", (event, message) => callback(message))
    return () => {
      ipcRenderer.removeAllListeners("login-error")
    }
  },
})
