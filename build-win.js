const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

console.log("Preparing Windows build...")

// Check if we're on macOS
const isMac = process.platform === "darwin"

if (isMac) {
  console.log("Building on macOS for Windows...")

  // Check if icon files exist
  const iconIco = path.join(__dirname, "build", "icon.ico")
  const iconPng = path.join(__dirname, "build", "icon.png")

  const hasIco = fs.existsSync(iconIco)
  const hasPng = fs.existsSync(iconPng)

  console.log(`Icon status: .ico exists: ${hasIco}, .png exists: ${hasPng}`)

  // Choose the appropriate build command
  let buildCommand

  if (hasIco || hasPng) {
    console.log("Using standard build with icon...")
    buildCommand = "NODE_ENV=production electron-builder --win --x64"
  } else {
    console.log("Using build without icon...")
    buildCommand = "NODE_ENV=production electron-builder --win --x64 --config.win.icon=false"
  }

  try {
    console.log(`Executing: ${buildCommand}`)
    execSync(buildCommand, { stdio: "inherit" })
    console.log("Build completed successfully!")
  } catch (error) {
    console.error("Build failed:", error.message)
    process.exit(1)
  }
} else {
  // On Windows, just run the normal build
  console.log("Building on Windows...")
  try {
    execSync("npm run build:win", { stdio: "inherit" })
    console.log("Build completed successfully!")
  } catch (error) {
    console.error("Build failed:", error.message)
    process.exit(1)
  }
}
