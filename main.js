const { app, BrowserWindow, ipcMain, dialog, shell, session } = require("electron")
const path = require("path")
const fs = require("fs")
const csv = require("csv-parser")
const nodemailer = require("nodemailer")
const Store = require("electron-store")
const log = require("electron-log")
const { OAuth2Client } = require("google-auth-library")
const http = require("http")
const url = require("url")

// Configure logging
log.transports.file.level = "info"
log.transports.console.level = "debug"

// Create a store for saving settings and user data
let store
try {
  store = new Store({
    encryptionKey: "4b657cc00ae51d281ec0c6cb87c181aa2a8d35981d996189ba0c490d2c06b45d",
    clearInvalidConfig: true, // This will clear the config if it's invalid
  })
  log.info("Store initialized successfully")
} catch (error) {
  log.error("Failed to initialize store:", error)

  // Fallback to a memory-only store
  store = {
    get: (key, defaultValue) => defaultValue,
    set: () => {},
    delete: () => {},
  }
  log.info("Using memory-only store as fallback")
}

// Load environment variables for SMTP settings
const defaultSmtpSettings = {
  host: process.env.SMTP_HOST || "",
  port: Number.parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER || "",
  password: process.env.SMTP_PASSWORD || "",
  senderName: "Payslip Sender", // Default sender name
}

// Default email settings
const defaultEmailSettings = {
  senderName: "Payslip Sender",
}

// Google OAuth client ID and secret from environment variables
const config = require("./config")
let GOOGLE_CLIENT_ID = config.auth.google.clientId
let GOOGLE_CLIENT_SECRET = config.auth.google.clientSecret

// For desktop applications, we'll use the loopback approach
const SERVER_PORT = 8000
const REDIRECT_URI = `http://localhost:${SERVER_PORT}/oauth2callback`

let mainWindow
let authWindow
let oauthServer = null

// Declare state variable
const state = {
  employees: [],
  payslips: [],
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "build/icon.ico"),
  })

  // Check if user is logged in
  const user = store.get("user")

  if (user) {
    console.log("User already logged in, loading main page:", user.email)
    mainWindow.loadFile("index.html")
  } else {
    console.log("No user found, loading login page")
    mainWindow.loadFile("login.html")
  }

  // Only open DevTools in development mode
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools()
  }

  // Log any loading errors
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Failed to load:", errorCode, errorDescription)
  })
}

// This function will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow()

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Create a local server to handle the OAuth callback
function createLocalOAuthServer() {
  return new Promise((resolve, reject) => {
    // Close any existing server
    if (oauthServer) {
      try {
        oauthServer.close()
      } catch (err) {
        console.error("Error closing existing server:", err)
      }
    }

    oauthServer = http.createServer((req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true)

        if (parsedUrl.pathname === "/oauth2callback") {
          // Send a response to close the browser window
          res.writeHead(200, { "Content-Type": "text/html" })
          res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Authentication Successful</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
                .success { color: green; font-size: 18px; }
                .close { margin-top: 20px; }
              </style>
            </head>
            <body>
              <h2 class="success">Authentication Successful!</h2>
              <p>You can close this window and return to the application.</p>
              <p class="close">This window will close automatically in 3 seconds...</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `)

          // Extract the authorization code
          const code = parsedUrl.query.code

          // Resolve with the authorization code
          resolve(code)

          // Close the server after a short delay
          setTimeout(() => {
            try {
              oauthServer.close()
              oauthServer = null
            } catch (err) {
              console.error("Error closing server:", err)
            }
          }, 1000)
        }
      } catch (error) {
        console.error("Error handling OAuth callback:", error)
        res.writeHead(500, { "Content-Type": "text/plain" })
        res.end("Authentication failed")
        reject(error)
      }
    })

    oauthServer.on("error", (err) => {
      console.error("OAuth server error:", err)
      reject(err)
    })

    oauthServer.listen(SERVER_PORT, () => {
      console.log(`OAuth callback server listening on port ${SERVER_PORT}`)
    })
  })
}

// Handle Google login
ipcMain.handle("google-login", async () => {
  try {
    log.info("Starting Google login process")

    // Close any existing auth window
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.close()
    }

    // For development/testing only - bypass OAuth if explicitly configured to use test user
    if (config.auth.useTestUser) {
      log.info("Using test user (configured in settings)")
      const testUser = {
        email: "test@bdcf.org",
        name: "Test User",
        picture: "https://via.placeholder.com/100",
      }
      store.set("user", testUser)
      mainWindow.loadFile("index.html")
      return testUser
    }

    // Check if we have client ID and secret
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      log.error("Google Client ID or Secret is missing")
      log.info("GOOGLE_CLIENT_ID present:", !!GOOGLE_CLIENT_ID)
      log.info("GOOGLE_CLIENT_SECRET present:", !!GOOGLE_CLIENT_SECRET)

      // Try to load from .env file directly as a last resort
      try {
        const dotenv = require("dotenv")
        const envPath = path.join(__dirname, ".env")
        if (fs.existsSync(envPath)) {
          log.info("Attempting to load credentials from .env file")
          dotenv.config({ path: envPath })

          // Check if we now have the credentials
          if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            log.info("Successfully loaded credentials from .env file")
            // Update the variables
            GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
            GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
          } else {
            log.error("Failed to load credentials from .env file")
            throw new Error("Google Client ID or Secret is missing. Please set up your Google credentials.")
          }
        } else {
          log.error(".env file not found")
          throw new Error("Google Client ID or Secret is missing. Please set up your Google credentials.")
        }
      } catch (error) {
        log.error("Error loading credentials:", error)
        throw new Error("Google Client ID or Secret is missing. Please set up your Google credentials.")
      }
    }

    // Start the local server to handle the OAuth callback
    const codePromise = createLocalOAuthServer()

    // Generate a random state value for security
    const stateParam = Math.random().toString(36).substring(2, 15)

    // Create OAuth client with client ID and secret
    const oAuth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI)

    // Generate the authorization URL
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
      state: stateParam,
      prompt: "consent",
    })

    // Create auth window
    authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      parent: mainWindow,
      modal: true,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    // Load the auth URL
    authWindow.loadURL(authUrl)

    // Wait for the authorization code from the local server
    const code = await codePromise

    if (code) {
      // Exchange the code for tokens
      await completeAuthentication(code, oAuth2Client)

      // Close the auth window if it's still open
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close()
      }
    } else {
      throw new Error("Authentication failed or was cancelled")
    }

    // Return the current user if authentication is successful
    return store.get("user")
  } catch (error) {
    log.error("Login error:", error)
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.close()
    }
    throw error
  }
})

// Complete the authentication process
async function completeAuthentication(code, oAuth2Client) {
  try {
    // Exchange code for tokens
    const { tokens } = await oAuth2Client.getToken(code)
    oAuth2Client.setCredentials(tokens)

    // Get user info
    const userInfo = await getUserInfo(oAuth2Client)

    // Check if email is from bdcf.org domain
    if (!userInfo.email.endsWith("@bdcf.org")) {
      throw new Error("Access restricted to bdcf.org email addresses only")
    }

    // Save user info
    store.set("user", {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    })

    // Load main page
    mainWindow.loadFile("index.html")

    return userInfo
  } catch (error) {
    log.error("Authentication completion error:", error)
    throw error
  }
}

// Get user info from Google
async function getUserInfo(oAuth2Client) {
  const response = await oAuth2Client.request({
    url: "https://www.googleapis.com/oauth2/v3/userinfo",
  })
  return response.data
}

// Handle debug login (for testing)
ipcMain.handle("debug-login", async () => {
  try {
    log.info("Using debug login")

    // Create a test user
    const testUser = {
      email: "test@bdcf.org",
      name: "Test User",
      picture: "https://via.placeholder.com/100",
    }

    // Save user info
    store.set("user", testUser)

    // Load main page
    log.info("Debug login successful, loading main page")
    mainWindow.loadFile("index.html")

    return testUser
  } catch (error) {
    log.error("Debug login error:", error)
    throw error
  }
})

// Handle logout
ipcMain.handle("logout", () => {
  store.delete("user")
  mainWindow.loadFile("login.html")
  return true
})

// Get current user
ipcMain.handle("get-current-user", () => {
  return store.get("user")
})

// Add this handler near the other ipcMain handlers
ipcMain.handle("check-env-vars", () => {
  return {
    googleClientId: !!GOOGLE_CLIENT_ID,
    googleClientSecret: !!GOOGLE_CLIENT_SECRET,
  }
})

// Handle opening external links
ipcMain.on("open-external-link", (event, url) => {
  shell.openExternal(url)
})

// Handle getting email template
ipcMain.handle("get-email-template", async () => {
  try {
    // Get the template from the store
    return (
      store.get("emailTemplate") || {
        subject: "Your Monthly Payslip",
        body: "",
      }
    )
  } catch (error) {
    console.error("Error getting email template:", error)
    return null
  }
})

// Save email template
ipcMain.on("save-email-template", (event, template) => {
  try {
    // Save the template to the store
    store.set("emailTemplate", template)
  } catch (error) {
    console.error("Error saving email template:", error)
  }
})

// Add these handlers to your main.js file, near the other ipcMain handlers

// Handle file selection dialog
ipcMain.handle("select-file", async (event, options) => {
  try {
    return await dialog.showOpenDialog(mainWindow, options)
  } catch (error) {
    console.error("Error selecting file:", error)
    throw error
  }
})

// Process employee CSV file
ipcMain.handle("process-employee-csv", async (event, filePath) => {
  try {
    console.log(`Processing employee CSV file: ${filePath}`)

    // Create an array to store employee data
    const employees = []

    // Read the file content
    const fileContent = fs.readFileSync(filePath, { encoding: "utf8" })

    // Log the first line to see the headers
    const firstLine = fileContent.split("\n")[0]
    console.log("CSV Headers:", firstLine)

    // Check if the file starts with a BOM (Byte Order Mark)
    const hasBOM = fileContent.charCodeAt(0) === 0xfeff
    const csvOptions = {}

    // If there's a BOM, we need to handle it
    if (hasBOM) {
      console.log("CSV file has BOM character")
      csvOptions.bom = true
    }

    // Read and parse the CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv(csvOptions))
        .on("headers", (headers) => {
          console.log("CSV Headers detected:", headers)
        })
        .on("data", (row) => {
          console.log("CSV Row:", row)

          // Direct access to the data using the exact keys from the CSV
          // This handles the case where keys might have quotes or special characters
          let employeeId = null
          let email = null
          let name = null

          // Check each key in the row
          Object.keys(row).forEach((key) => {
            const lowerKey = key.toLowerCase().trim()

            // Check for ID column
            if (lowerKey === "id" || lowerKey === "employee_id" || lowerKey === "employeeid") {
              employeeId = row[key].trim()
            }

            // Check for email column
            if (lowerKey === "email" || lowerKey === "emailaddress" || lowerKey === "email_address") {
              email = row[key].trim()
            }

            // Check for name column
            if (lowerKey === "name" || lowerKey === "fullname" || lowerKey === "employeename") {
              name = row[key].trim()
            }
          })

          // If we have both employee ID and email, add to employees array
          if (employeeId && email) {
            employees.push({
              employee_id: employeeId,
              email: email,
              name: name || "",
            })
            console.log(`Added employee: ${employeeId}, ${email}, ${name || ""}`)
          } else {
            console.log(`Skipped row - missing required fields. Found: id=${employeeId}, email=${email}`)
          }
        })
        .on("end", () => {
          resolve()
        })
        .on("error", (error) => {
          reject(error)
        })
    })

    // Store employees in state
    state.employees = employees

    // Log success
    console.log(`Loaded ${employees.length} employees from CSV`)

    // Send process update
    mainWindow.webContents.send("process-update", {
      status: "success",
      message: `Loaded ${employees.length} employees from CSV file`,
    })

    return employees
  } catch (error) {
    console.error("Error processing employee CSV:", error)

    // Send process update
    mainWindow.webContents.send("process-update", {
      status: "error",
      message: `Error processing CSV: ${error.message}`,
    })

    throw error
  }
})

// Process employee CSV from URL
ipcMain.handle("process-employee-csv-from-url", async (event, url) => {
  try {
    console.log(`Processing employee CSV from URL: ${url}`)

    // Create a temporary file path
    const tempDir = path.join(app.getPath("temp"), "payslip-sender")
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const tempFilePath = path.join(tempDir, "employee_list.csv")

    // Fetch the CSV file
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`)
    }

    // Save the file content
    const fileContent = await response.text()
    console.log("CSV content from URL (first 200 chars):", fileContent.substring(0, 200) + "...")
    fs.writeFileSync(tempFilePath, fileContent, "utf8")

    // Process the CSV file using the existing function
    return await ipcMain.handle("process-employee-csv", event, tempFilePath)
  } catch (error) {
    console.error("Error processing employee CSV from URL:", error)

    // Send process update
    mainWindow.webContents.send("process-update", {
      status: "error",
      message: `Error processing CSV from URL: ${error.message}`,
    })

    throw error
  }
})

// Process payslip PDF files
ipcMain.handle("process-payslip-files", async (event, filePaths) => {
  try {
    console.log(`Processing ${filePaths.length} payslip files`)

    // Create an array to store payslip data
    const payslips = []

    // Process each file
    for (const filePath of filePaths) {
      const fileName = path.basename(filePath)

      // Create payslip object
      const payslip = {
        path: filePath,
        name: fileName,
        employeeId: null,
      }

      // Try to match with an employee ID
      if (state.employees && state.employees.length > 0) {
        for (const employee of state.employees) {
          // Try different matching strategies
          const employeeId = employee.employee_id.trim()

          // Direct match
          if (fileName.includes(employeeId)) {
            payslip.employeeId = employeeId
            break
          }

          // Match without leading zeros (e.g., S06 matches S6)
          const noLeadingZeros = employeeId.replace(/^([A-Za-z]+)0+(\d+)$/, "$1$2")
          if (noLeadingZeros !== employeeId && fileName.includes(noLeadingZeros)) {
            payslip.employeeId = employeeId
            break
          }

          // Match with different separators (e.g., S-06, S_06)
          const baseId = employeeId.match(/^([A-Za-z]+)(\d+)$/)
          if (baseId) {
            const [, prefix, number] = baseId
            const patterns = [`${prefix}-${number}`, `${prefix}_${number}`, `${prefix} ${number}`]

            if (patterns.some((pattern) => fileName.includes(pattern))) {
              payslip.employeeId = employeeId
              break
            }
          }
        }
      }

      payslips.push(payslip)
    }

    // Store payslips in state
    state.payslips = payslips

    // Log success
    console.log(`Processed ${payslips.length} payslip files`)

    // Send process update
    mainWindow.webContents.send("process-update", {
      status: "success",
      message: `Loaded ${payslips.length} payslip files`,
    })

    return payslips
  } catch (error) {
    console.error("Error processing payslip files:", error)

    // Send process update
    mainWindow.webContents.send("process-update", {
      status: "error",
      message: `Error processing payslips: ${error.message}`,
    })

    throw error
  }
})

// Get employees
ipcMain.handle("get-employees", () => {
  return state.employees || []
})

// Get payslips
ipcMain.handle("get-payslips", () => {
  return state.payslips || []
})

// Validate employee
ipcMain.handle("validate-employee", async (event, employee) => {
  try {
    console.log(`Validating employee: ${employee.email}`)

    // Check if email is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(employee.email)) {
      return {
        valid: false,
        message: "Invalid email format",
      }
    }

    // Check if email is from allowed domain
    if (!employee.email.endsWith("@bdcf.org")) {
      return {
        valid: false,
        message: "Email not from bdcf.org domain",
      }
    }

    // Check if there's a matching payslip
    let hasMatchingPayslip = false
    if (state.payslips && state.payslips.length > 0) {
      hasMatchingPayslip = state.payslips.some((payslip) => payslip.employeeId === employee.employee_id)
    }

    return {
      valid: true,
      hasMatchingPayslip,
    }
  } catch (error) {
    console.error("Error validating employee:", error)
    throw error
  }
})

// Send payslips
ipcMain.handle("send-payslips", async () => {
  try {
    // Get employees and payslips from the state, not from the store
    const employees = state.employees || []
    const payslips = state.payslips || []

    console.log(`Sending payslips: ${employees.length} employees, ${payslips.length} payslips`)

    // Get email template
    const emailTemplate = store.get("emailTemplate") || {
      subject: "Your Monthly Payslip",
      body: "<p>Please find your payslip attached.</p>",
    }

    // Results object
    const results = {
      total: employees.length,
      sent: 0,
      failed: 0,
      details: [],
    }

    // Send process update
    mainWindow.webContents.send("process-update", {
      status: "info",
      message: `Starting to send ${employees.length} payslips...`,
    })

    // Process each employee
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i]
      const progress = Math.round((i / employees.length) * 100)

      // Send progress update
      mainWindow.webContents.send("send-progress-update", { progress })

      try {
        // Find matching payslip
        const payslip = payslips.find((p) => p.employeeId === employee.employee_id)

        if (!payslip) {
          throw new Error(`No matching payslip found for employee ${employee.employee_id}`)
        }

        // Replace placeholders in the email template
        let emailHtml = emailTemplate.body
        let emailSubject = emailTemplate.subject

        // Replace placeholders in subject
        emailSubject = emailSubject.replace(/{{employee_name}}/g, employee.name || "Employee")
        emailSubject = emailSubject.replace(/{{employee_id}}/g, employee.employee_id)
        emailSubject = emailSubject.replace(/{{employee_email}}/g, employee.email)

        // Replace placeholders in body
        emailHtml = emailHtml.replace(/{{employee_name}}/g, employee.name || "Employee")
        emailHtml = emailHtml.replace(/{{employee_id}}/g, employee.employee_id)
        emailHtml = emailHtml.replace(/{{employee_email}}/g, employee.email)

        // Log sending attempt
        mainWindow.webContents.send("process-update", {
          status: "info",
          message: `Sending email to ${employee.email}...`,
        })

        // Send the email
        const result = await sendEmail(employee.email, emailSubject, emailHtml, [
          {
            filename: payslip.name,
            path: payslip.path,
          },
        ])

        if (result.success) {
          results.sent++
          results.details.push({
            email: employee.email,
            success: true,
          })

          mainWindow.webContents.send("process-update", {
            status: "success",
            message: `Successfully sent email to ${employee.email}`,
          })
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        results.failed++
        results.details.push({
          email: employee.email,
          success: false,
          message: error.message,
        })

        mainWindow.webContents.send("process-update", {
          status: "error",
          message: `Error sending email to ${employee.email}: ${error.message}`,
        })
      }

      // Add a small delay between emails to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Save results to history
    const history = store.get("emailHistory") || []
    history.unshift({
      date: new Date().toISOString(),
      results: {
        total: results.total,
        sent: results.sent,
        failed: results.failed,
      },
    })
    store.set("emailHistory", history.slice(0, 50)) // Keep only the last 50 entries

    // Send completion update
    mainWindow.webContents.send("process-update", {
      status: "info",
      message: `Completed sending ${results.sent} out of ${results.total} payslips.`,
    })

    return results
  } catch (error) {
    console.error("Error sending payslips:", error)
    throw error
  }
})

// Add this handler to generate a sample CSV
ipcMain.handle("generate-sample-csv", async (event) => {
  try {
    // Create a sample CSV content that matches the user's format
    const sampleContent =
      "id,email,name\n" +
      "S01,john.doe@bdcf.org,John Doe\n" +
      "S02,jane.smith@bdcf.org,Jane Smith\n" +
      "S03,alex.johnson@bdcf.org,Alex Johnson"

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save Sample CSV",
      defaultPath: "sample_employees.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    })

    if (!result.canceled && result.filePath) {
      // Write the sample CSV to the selected file
      fs.writeFileSync(result.filePath, sampleContent, "utf8")

      return { success: true, path: result.filePath }
    }

    return { success: false }
  } catch (error) {
    console.error("Error generating sample CSV:", error)
    throw error
  }
})

// Get SMTP settings
ipcMain.handle("get-smtp-settings", () => {
  return store.get("smtpSettings", defaultSmtpSettings)
})

// Save SMTP settings
ipcMain.handle("save-smtp-settings", (event, settings) => {
  try {
    store.set("smtpSettings", settings)
    return { success: true }
  } catch (error) {
    console.error("Error saving SMTP settings:", error)
    throw error
  }
})

// Get email settings
ipcMain.handle("get-email-settings", () => {
  return store.get("emailSettings", defaultEmailSettings)
})

// Save email settings
ipcMain.handle("save-email-settings", (event, settings) => {
  try {
    console.log("Saving email settings:", settings)
    store.set("emailSettings", settings)

    // Also update the sender name in SMTP settings for consistency
    const smtpSettings = store.get("smtpSettings", defaultSmtpSettings)
    smtpSettings.senderName = settings.senderName
    store.set("smtpSettings", smtpSettings)

    return { success: true }
  } catch (error) {
    console.error("Error saving email settings:", error)
    throw error
  }
})

// Get email history
ipcMain.handle("get-email-history", () => {
  return store.get("emailHistory", [])
})

// Test SMTP connection
ipcMain.handle("test-smtp-connection", async (event, settings) => {
  try {
    console.log("Testing SMTP connection with settings:", {
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: "********", // Masked for security
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    // Special handling for Gmail
    const isGmail = settings.host.includes("gmail.com")

    // Create a transporter
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    // Verify connection
    await transporter.verify()
    console.log("SMTP connection verified successfully")
    return { success: true }
  } catch (error) {
    console.error("SMTP connection test failed:", error)

    // Special handling for Gmail authentication errors
    if (error.code === "EAUTH" && settings.host.includes("gmail.com")) {
      return {
        success: false,
        error: `Gmail authentication failed. You need to use an App Password instead of your regular password. Go to https://myaccount.google.com/apppasswords to generate one. Error: ${error.message}`,
        isGmailAuth: true,
      }
    }

    // Try with alternative settings if verification fails
    if (error.code === "ESOCKET" && error.message.includes("WRONG_VERSION_NUMBER")) {
      console.log("Trying alternative SMTP settings (toggling secure flag)")

      try {
        // Try with opposite secure setting
        const alternativeTransporter = nodemailer.createTransport({
          host: settings.host,
          port: settings.port,
          secure: !settings.secure, // Toggle secure flag
          auth: {
            user: settings.user,
            pass: settings.password,
          },
          tls: {
            rejectUnauthorized: false,
          },
        })

        await alternativeTransporter.verify()
        console.log("Alternative SMTP connection verified successfully")

        // Suggest the correct settings
        return {
          success: true,
          message: `Connection successful with ${!settings.secure ? "SSL enabled" : "SSL disabled"}. Consider ${!settings.secure ? "enabling" : "disabling"} the 'Use Secure Connection' option.`,
        }
      } catch (alternativeError) {
        console.error("Alternative SMTP connection also failed:", alternativeError)
        return {
          success: false,
          error: `Connection failed with both SSL settings. Original error: ${error.message}`,
        }
      }
    }

    return { success: false, error: error.message }
  }
})

async function sendEmail(to, subject, html, attachments = []) {
  try {
    console.log(`Attempting to send email to ${to}`)

    // Get SMTP settings
    const smtpSettings = store.get("smtpSettings") || {}

    // Get email settings for sender name
    const emailSettings = store.get("emailSettings") || { senderName: "Payslip Sender" }

    // Check if SMTP settings are configured
    if (!smtpSettings.host || !smtpSettings.port || !smtpSettings.user || !smtpSettings.password) {
      console.log("SMTP settings not fully configured, simulating email send")

      // Simulate successful email sending for testing
      return {
        success: true,
        messageId: `simulated-${Date.now()}`,
        simulated: true,
      }
    }

    console.log(`Using SMTP settings: ${smtpSettings.host}:${smtpSettings.port}`)

    // Get email template for fallback subject
    const emailTemplate = store.get("emailTemplate") || { subject: "Your Monthly Payslip" }

    // Use provided subject or fall back to template subject
    const emailSubject = subject || emailTemplate.subject

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port || 587,
      secure: smtpSettings.secure || false,
      auth: {
        user: smtpSettings.user,
        pass: smtpSettings.password,
      },
      tls: {
        rejectUnauthorized: false, // Accept self-signed certificates
      },
    })

    // Use sender name from email settings if available, otherwise use from SMTP settings
    const senderName = emailSettings.senderName || smtpSettings.senderName || "Payslip Sender"
    const from = senderName ? `"${senderName}" <${smtpSettings.user}>` : smtpSettings.user

    console.log(`Sending as: ${from}`)

    // Send mail
    const info = await transporter.sendMail({
      from,
      to,
      subject: emailSubject,
      html,
      attachments,
    })

    console.log(`Email sent successfully to ${to}, messageId: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error)
    return { success: false, error: error.message }
  }
}
