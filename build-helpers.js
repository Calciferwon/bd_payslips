const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

// Ensure build directory exists
const buildDir = path.join(__dirname, "build")
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir)
}

// Log build environment
console.log("Build environment:")
console.log("- Node version:", process.version)
console.log("- Platform:", process.platform)
console.log("- Architecture:", process.arch)

// Check if we're on macOS building for Windows
if (process.platform === "darwin" && process.argv.includes("--win")) {
  console.log("Building for Windows from macOS...")
  console.log("Installing wine if needed...")

  try {
    // Check if wine is installed
    execSync("which wine")
    console.log("Wine is already installed.")
  } catch (error) {
    console.log("Wine is not installed. Installing wine via Homebrew...")
    console.log("This may take a while...")

    try {
      execSync("brew install wine", { stdio: "inherit" })
      console.log("Wine installed successfully.")
    } catch (error) {
      console.error("Failed to install wine:", error.message)
      console.error("Please install wine manually and try again.")
      process.exit(1)
    }
  }
}

console.log("Build preparation complete.")
require("./verify-build")
