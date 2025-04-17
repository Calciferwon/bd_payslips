const fs = require("fs")
const path = require("path")

// Check if all required files exist
const requiredFiles = [
  "index.js",
  "main.js",
  "login.html",
  "index.html",
  "styles.css",
  "build/icon.icns",
  "build/icon.ico",
]

console.log("Verifying build requirements...")

let allFilesExist = true
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file)
  const exists = fs.existsSync(filePath)
  console.log(`${exists ? "✓" : "✗"} ${file}`)

  if (!exists) {
    allFilesExist = false
  }
}

if (!allFilesExist) {
  console.error("Some required files are missing. Please create them before building.")
  process.exit(1)
}

// Check package.json configuration
const packageJson = require("./package.json")
if (!packageJson.main) {
  console.error('Missing "main" field in package.json')
  process.exit(1)
}

if (!packageJson.build || !packageJson.build.appId) {
  console.error('Missing or incomplete "build" configuration in package.json')
  process.exit(1)
}

console.log("Build verification completed successfully!")
