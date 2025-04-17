const { app } = require("electron")
const path = require("path")

// Import the main application file
require("./main.js")

// Handle Squirrel events for Windows - make this more robust
if (process.platform === "win32") {
  try {
    const squirrelStartup = require("electron-squirrel-startup")
    if (squirrelStartup) app.quit()
  } catch (error) {
    console.log("electron-squirrel-startup not found, continuing anyway")
    // Continue without the module - it's only needed during installation
  }
}

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// Keep a global reference of the window object to prevent garbage collection
global.mainWindow = null

// Log startup
console.log(`Application starting: ${app.getName()} ${app.getVersion()}`)
console.log(`Running in ${app.isPackaged ? "production" : "development"} mode`)
console.log(`User data path: ${app.getPath("userData")}`)
