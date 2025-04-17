// Configuration file for environment-specific settings

// Determine if we're in development mode
const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV

// For packaged apps, we need to handle environment variables differently
const getEnv = (key, defaultValue) => {
  // In development, use process.env
  if (isDev) {
    // Try to load from .env file directly if not already in process.env
    if (!process.env[key]) {
      try {
        const fs = require("fs")
        const path = require("path")
        const dotenv = require("dotenv")

        const envPath = path.join(__dirname, ".env")
        if (fs.existsSync(envPath)) {
          console.log(`Loading .env file for key: ${key}`)
          const result = dotenv.config({ path: envPath })
          if (result.error) {
            console.error("Error loading .env file:", result.error)
          }
        }
      } catch (error) {
        console.error("Error loading .env file:", error)
      }
    }

    return process.env[key] || defaultValue
  }

  // In production, try to load from a config file
  try {
    const fs = require("fs")
    const path = require("path")
    const electron = require("electron")
    const app = electron.app || (electron.remote && electron.remote.app)

    // First, try to get the path from the app resources
    let configPath

    if (app) {
      // For packaged app
      configPath = path.join(app.getAppPath(), "resources", "env.json")
      console.log(`Looking for config at app path: ${configPath}`)

      if (!fs.existsSync(configPath)) {
        // Try resources path
        configPath = path.join(process.resourcesPath || app.getAppPath(), "env.json")
        console.log(`Looking for config at resources path: ${configPath}`)
      }
    } else {
      // Fallback
      configPath = path.join(__dirname, "resources", "env.json")
      console.log(`Looking for config at fallback path: ${configPath}`)
    }

    if (fs.existsSync(configPath)) {
      console.log(`Found config file at: ${configPath}`)
      const envConfig = JSON.parse(fs.readFileSync(configPath, "utf8"))
      if (envConfig[key]) {
        console.log(`Found value for ${key} in config file`)
        return envConfig[key]
      }
    } else {
      console.log(`Config file not found at: ${configPath}`)
    }
  } catch (error) {
    console.error("Error loading environment variables:", error)
  }

  return defaultValue
}

// Configuration object
const config = {
  // Application settings
  app: {
    name: "Payslip Sender",
    version: "1.0.0",
  },

  // Authentication settings
  auth: {
    // Only use test user if explicitly configured or if Google credentials are missing
    useTestUser: getEnv("USE_TEST_USER", "false") === "true",

    // Google OAuth settings
    google: {
      clientId: getEnv("GOOGLE_CLIENT_ID", ""),
      clientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
      allowedDomain: "bdcf.org",
    },

    // Custom protocol for OAuth callback
    protocol: "payslip-sender",
    callbackUrl: "http://localhost:8000/oauth2callback",
  },

  // SMTP settings
  smtp: {
    host: getEnv("SMTP_HOST", ""),
    port: Number.parseInt(getEnv("SMTP_PORT", "587")),
    secure: getEnv("SMTP_SECURE", "false") === "true",
    user: getEnv("SMTP_USER", ""),
    password: getEnv("SMTP_PASSWORD", ""),
  },

  // Development settings
  dev: {
    openDevTools: isDev,
    logLevel: isDev ? "debug" : "info",
  },
}

// Check if Google credentials are missing and update useTestUser accordingly
if (!config.auth.google.clientId || !config.auth.google.clientSecret) {
  console.warn("Google credentials are missing, enabling test user mode")
  config.auth.useTestUser = true
}

// Log the loaded configuration (without sensitive values)
console.log("Loaded configuration:", {
  ...config,
  auth: {
    ...config.auth,
    google: {
      ...config.auth.google,
      clientId: config.auth.google.clientId ? "PRESENT" : "MISSING",
      clientSecret: config.auth.google.clientSecret ? "PRESENT" : "MISSING",
    },
  },
  smtp: {
    ...config.smtp,
    password: config.smtp.password ? "PRESENT" : "MISSING",
  },
})

module.exports = config
