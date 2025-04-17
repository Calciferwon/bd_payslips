const fs = require("fs")
const path = require("path")

console.log("=== Environment Variables Check ===")

// Check .env file
const envPath = path.join(__dirname, ".env")
if (fs.existsSync(envPath)) {
  console.log("\n.env file exists at:", envPath)
  const envContent = fs.readFileSync(envPath, "utf8")

  // Mask sensitive values
  const maskedContent = envContent.replace(/(CLIENT_ID|SECRET|PASSWORD)=([^\n]+)/gi, "$1=[MASKED]")
  console.log("\nContent (sensitive values masked):")
  console.log(maskedContent)

  // Check for specific variables
  const hasGoogleClientId =
    envContent.includes("GOOGLE_CLIENT_ID=") &&
    !envContent.includes("GOOGLE_CLIENT_ID=\n") &&
    !envContent.includes("GOOGLE_CLIENT_ID=\r\n") &&
    !envContent.includes("GOOGLE_CLIENT_ID=")

  const hasGoogleClientSecret =
    envContent.includes("GOOGLE_CLIENT_SECRET=") &&
    !envContent.includes("GOOGLE_CLIENT_SECRET=\n") &&
    !envContent.includes("GOOGLE_CLIENT_SECRET=\r\n") &&
    !envContent.includes("GOOGLE_CLIENT_SECRET=")

  console.log("\nGoogle credentials check:")
  console.log("- GOOGLE_CLIENT_ID present and not empty:", hasGoogleClientId)
  console.log("- GOOGLE_CLIENT_SECRET present and not empty:", hasGoogleClientSecret)
} else {
  console.log("\n❌ .env file does not exist at:", envPath)
}

// Check resources/env.json file
const resourcesDir = path.join(__dirname, "resources")
const envJsonPath = path.join(resourcesDir, "env.json")

if (fs.existsSync(envJsonPath)) {
  console.log("\nenv.json file exists at:", envJsonPath)
  try {
    const envJson = JSON.parse(fs.readFileSync(envJsonPath, "utf8"))

    // Create a masked version for display
    const maskedJson = { ...envJson }
    if (maskedJson.GOOGLE_CLIENT_ID) maskedJson.GOOGLE_CLIENT_ID = "[MASKED]"
    if (maskedJson.GOOGLE_CLIENT_SECRET) maskedJson.GOOGLE_CLIENT_SECRET = "[MASKED]"
    if (maskedJson.SMTP_PASSWORD) maskedJson.SMTP_PASSWORD = "[MASKED]"

    console.log("\nContent (sensitive values masked):")
    console.log(JSON.stringify(maskedJson, null, 2))

    console.log("\nGoogle credentials check:")
    console.log("- GOOGLE_CLIENT_ID present and not empty:", !!envJson.GOOGLE_CLIENT_ID)
    console.log("- GOOGLE_CLIENT_SECRET present and not empty:", !!envJson.GOOGLE_CLIENT_SECRET)
  } catch (error) {
    console.log("\n❌ Error parsing env.json:", error.message)
  }
} else {
  console.log("\n❌ env.json file does not exist at:", envJsonPath)
}

// Check if create-env-config.js exists
const createEnvConfigPath = path.join(__dirname, "create-env-config.js")
if (fs.existsSync(createEnvConfigPath)) {
  console.log("\ncreate-env-config.js exists at:", createEnvConfigPath)
} else {
  console.log("\n❌ create-env-config.js does not exist at:", createEnvConfigPath)
}

console.log("\n=== End of Environment Check ===")
