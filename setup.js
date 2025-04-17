const fs = require("fs")
const path = require("path")
const readline = require("readline")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Function to prompt for input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

// Main function
async function main() {
  console.log("\n=== Payslip Sender Environment Setup ===\n")
  console.log("This script will help you set up the environment variables needed for Google authentication.")
  console.log("The values will be saved to a .env file that will be used during the build process.\n")

  // Check if .env file exists
  const envPath = path.join(__dirname, ".env")
  const existingEnv = {}

  if (fs.existsSync(envPath)) {
    console.log("Found existing .env file. Current values will be shown as defaults.\n")
    const envContent = fs.readFileSync(envPath, "utf8")
    envContent.split("\n").forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        existingEnv[match[1]] = match[2]
      }
    })
  }

  console.log("\n=== Google OAuth Setup ===")
  console.log("To enable Google login, you need to set up OAuth credentials in the Google Cloud Console:")
  console.log("1. Go to https://console.cloud.google.com/apis/credentials")
  console.log("2. Create a new project or select an existing one")
  console.log("3. Click 'Create Credentials' > 'OAuth client ID'")
  console.log("4. Set Application Type to 'Desktop app'")
  console.log("5. Add 'http://localhost:8000/oauth2callback' as an authorized redirect URI")
  console.log("6. Copy the Client ID and Client Secret\n")

  // Prompt for Google credentials
  const googleClientId = await prompt(
    `Google Client ID ${existingEnv.GOOGLE_CLIENT_ID ? `[${existingEnv.GOOGLE_CLIENT_ID}]` : ""}: `,
  )
  const googleClientSecret = await prompt(
    `Google Client Secret ${existingEnv.GOOGLE_CLIENT_SECRET ? "[PRESENT]" : ""}: `,
  )

  // Prompt for SMTP settings
  console.log("\n=== SMTP Settings (optional, press Enter to skip) ===")
  const smtpHost = await prompt(`SMTP Host ${existingEnv.SMTP_HOST ? `[${existingEnv.SMTP_HOST}]` : ""}: `)
  const smtpPort = await prompt(`SMTP Port ${existingEnv.SMTP_PORT ? `[${existingEnv.SMTP_PORT}]` : "[587]"}: `)
  const smtpSecure = await prompt(
    `SMTP Secure (true/false) ${existingEnv.SMTP_SECURE ? `[${existingEnv.SMTP_SECURE}]` : "[false]"}: `,
  )
  const smtpUser = await prompt(`SMTP User ${existingEnv.SMTP_USER ? `[${existingEnv.SMTP_USER}]` : ""}: `)
  const smtpPassword = await prompt(`SMTP Password ${existingEnv.SMTP_PASSWORD ? "[PRESENT]" : ""}: `)

  // Prepare environment variables
  const env = {
    GOOGLE_CLIENT_ID: googleClientId || existingEnv.GOOGLE_CLIENT_ID || "",
    GOOGLE_CLIENT_SECRET: googleClientSecret || existingEnv.GOOGLE_CLIENT_SECRET || "",
    SMTP_HOST: smtpHost || existingEnv.SMTP_HOST || "",
    SMTP_PORT: smtpPort || existingEnv.SMTP_PORT || "587",
    SMTP_SECURE: smtpSecure || existingEnv.SMTP_SECURE || "false",
    SMTP_USER: smtpUser || existingEnv.SMTP_USER || "",
    SMTP_PASSWORD: smtpPassword || existingEnv.SMTP_PASSWORD || "",
    USE_TEST_USER: "false", // Default to not using test user
  }

  // Write to .env file
  const envContent = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")

  fs.writeFileSync(envPath, envContent)

  console.log("\nEnvironment variables saved to .env file.")

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.log("\n⚠️ WARNING: Google credentials are missing or incomplete!")
    console.log("Without valid Google credentials, users will not be able to log in with their Google accounts.")
    console.log("They will need to use the Test Account option instead.")
  } else {
    console.log("\n✅ Google credentials have been set up successfully!")
  }

  console.log("\nYou can now build the application with:")
  console.log("  npm run build:mac    # For macOS")
  console.log("  npm run build:win    # For Windows")

  rl.close()
}

main().catch(console.error)
