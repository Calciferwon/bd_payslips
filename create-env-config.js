const fs = require("fs")
const path = require("path")
const dotenv = require("dotenv")

console.log("Starting create-env-config.js...")

// Load environment variables from .env file
try {
  const envPath = path.join(__dirname, ".env")
  if (fs.existsSync(envPath)) {
    console.log("Loading environment variables from .env file:", envPath)
    const result = dotenv.config({ path: envPath })

    if (result.error) {
      console.error("Error loading .env file:", result.error)
    } else {
      console.log("Successfully loaded .env file")
    }

    // Debug: Print loaded environment variables (masked)
    const maskedEnv = {}
    Object.keys(process.env).forEach((key) => {
      if (key.includes("SECRET") || key.includes("PASSWORD") || key.includes("CLIENT_ID")) {
        maskedEnv[key] = "[MASKED]"
      } else {
        maskedEnv[key] = process.env[key]
      }
    })
    console.log("Loaded environment variables:", maskedEnv)
  } else {
    console.warn("No .env file found at:", envPath)
  }
} catch (error) {
  console.error("Error loading .env file:", error)
}

// Environment variables to include in the config
const envVars = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "USE_TEST_USER",
]

// Create config object from environment variables
const config = {}
envVars.forEach((key) => {
  if (process.env[key]) {
    config[key] = process.env[key]
    console.log(
      `Added ${key} to config (value ${key.includes("SECRET") || key.includes("PASSWORD") ? "[MASKED]" : process.env[key]})`,
    )
  } else {
    console.warn(`Environment variable ${key} not found`)
  }
})

// Check if Google credentials are missing and log a warning
if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
  console.warn("\x1b[33m%s\x1b[0m", "WARNING: Google credentials are missing or incomplete!")
  console.warn("\x1b[33m%s\x1b[0m", "To enable Google login, set these environment variables before building:")
  console.warn("\x1b[33m%s\x1b[0m", "- GOOGLE_CLIENT_ID")
  console.warn("\x1b[33m%s\x1b[0m", "- GOOGLE_CLIENT_SECRET")

  // Set USE_TEST_USER to true if Google credentials are missing
  config.USE_TEST_USER = "true"
  console.warn("\x1b[33m%s\x1b[0m", "Setting USE_TEST_USER=true to enable test account login")
}

// Create resources directory if it doesn't exist
const resourcesDir = path.join(__dirname, "resources")
if (!fs.existsSync(resourcesDir)) {
  console.log("Creating resources directory:", resourcesDir)
  fs.mkdirSync(resourcesDir, { recursive: true })
}

// Write config to file
const configPath = path.join(resourcesDir, "env.json")
fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

console.log(`Environment config written to ${configPath}`)
console.log("Included variables:", Object.keys(config).join(", "))
