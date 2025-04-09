const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron")
const path = require("path")
const fs = require("fs")
const csv = require("csv-parser")
const nodemailer = require("nodemailer")
const Store = require("electron-store")
const log = require("electron-log")
const { OAuth2Client } = require("google-auth-library")

// Configure logging
log.transports.file.level = "info"
log.transports.console.level = "debug"

// Create a store for saving settings and user data
const store = new Store({
  encryptionKey: "your-encryption-key", // For better security in production
})

// Load environment variables for SMTP settings
const defaultSmtpSettings = {
  host: process.env.SMTP_HOST || "",
  port: Number.parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER || "",
  password: process.env.SMTP_PASSWORD || "",
}

// Google OAuth client ID
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID" // Replace with your actual client ID

let mainWindow
let authWindow

// Declare state variable
const state = {}

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
    mainWindow.loadFile("index.html")
  } else {
    mainWindow.loadFile("login.html")
  }

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// Handle getting email template
ipcMain.handle("get-email-template", () => {
  return store.get("emailTemplate", "")
})

// Handle saving email template
ipcMain.on("save-email-template", (event, template) => {
  store.set("emailTemplate", template)
})

// Handle getting employees
ipcMain.handle("get-employees", () => {
  return state.employees || []
})

// Handle validating employee
ipcMain.handle("validate-employee", async (event, employee) => {
  try {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(employee.email)) {
      return {
        valid: false,
        message: "Invalid email format",
      }
    }

    // Domain validation (must be @bdcf.org)
    if (!employee.email.endsWith("@bdcf.org")) {
      return {
        valid: false,
        message: "Email must be from the bdcf.org domain",
      }
    }

    // Username validation (must match name if provided)
    if (employee.name) {
      const nameParts = employee.name.toLowerCase().split(" ")
      const emailUsername = employee.email.split("@")[0].toLowerCase()

      // Check if email contains first name or last name
      const containsFirstName = nameParts[0] && emailUsername.includes(nameParts[0])
      const containsLastName =
        nameParts[nameParts.length - 1] && emailUsername.includes(nameParts[nameParts.length - 1])

      if (!containsFirstName && !containsLastName) {
        return {
          valid: false,
          message: "Email username doesn't match employee name",
        }
      }
    }

    // All validations passed
    return {
      valid: true,
    }
  } catch (error) {
    log.error("Error validating employee:", error)
    return {
      valid: false,
      message: error.message || "Validation failed",
    }
  }
})

// Handle Google login
ipcMain.handle("google-login", async () => {
  authWindow = new BrowserWindow({
    width: 600,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    title: "Sign in with Google",
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
  })

  // Google OAuth2 URL
  const redirectUri = "https://localhost/callback"
  const oAuth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    "", // No client secret needed for desktop apps
    redirectUri,
  )

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
  })

  authWindow.loadURL(authUrl)

  return new Promise((resolve, reject) => {
    authWindow.webContents.on("will-redirect", async (event, url) => {
      if (url.startsWith(redirectUri)) {
        const urlParams = new URL(url)
        const code = urlParams.searchParams.get("code")

        if (code) {
          try {
            const { tokens } = await oAuth2Client.getToken(code)
            oAuth2Client.setCredentials(tokens)

            // Get user info
            const userInfo = await getUserInfo(oAuth2Client)

            // Check if email is from bdcf.org domain
            if (!userInfo.email.endsWith("@bdcf.org")) {
              authWindow.close()
              const error = new Error("Access restricted to bdcf.org email addresses only")
              mainWindow.webContents.send("login-error", error.message)
              reject(error)
              return
            }

            // Save user info
            store.set("user", {
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
            })

            authWindow.close()
            resolve(userInfo)
          } catch (error) {
            log.error("Authentication error:", error)
            authWindow.close()
            mainWindow.webContents.send("login-error", error.message || "Authentication failed")
            reject(error)
          }
        } else {
          authWindow.close()
          reject(new Error("Authentication failed"))
        }
      }
    })

    authWindow.on("closed", () => {
      if (!store.get("user")) {
        const error = new Error("Authentication window was closed")
        mainWindow.webContents.send("login-error", error.message)
        reject(error)
      }
    })
  })
})

// Get user info from Google
async function getUserInfo(oAuth2Client) {
  const response = await oAuth2Client.request({
    url: "https://www.googleapis.com/oauth2/v3/userinfo",
  })
  return response.data
}

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

// Handle selecting employee CSV file
ipcMain.handle("select-employee-file", async () => {
  try {
    mainWindow.webContents.send("process-update", {
      step: "employee-file",
      status: "selecting",
      message: "Selecting employee file...",
    })

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    })

    if (result.canceled) {
      mainWindow.webContents.send("process-update", {
        step: "employee-file",
        status: "cancelled",
        message: "Employee file selection cancelled",
      })
      return null
    }

    const filePath = result.filePaths[0]

    mainWindow.webContents.send("process-update", {
      step: "employee-file",
      status: "processing",
      message: "Processing employee file...",
    })

    const employees = []

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => {
          if (data.employee_id && data.email) {
            employees.push({
              employee_id: data.employee_id,
              email: data.email,
              name: data.name || "",
            })
          }
        })
        .on("end", () => {
          if (employees.length === 0) {
            mainWindow.webContents.send("process-update", {
              step: "employee-file",
              status: "error",
              message: "No valid employee data found in the file",
            })
            reject(new Error("No valid employee data found in the file"))
          } else {
            mainWindow.webContents.send("process-update", {
              step: "employee-file",
              status: "success",
              message: `Successfully loaded ${employees.length} employees`,
            })
            resolve(employees)
          }
        })
        .on("error", (error) => {
          mainWindow.webContents.send("process-update", {
            step: "employee-file",
            status: "error",
            message: `Error processing employee file: ${error.message}`,
          })
          reject(error)
        })
    })
  } catch (error) {
    mainWindow.webContents.send("process-update", {
      step: "employee-file",
      status: "error",
      message: `Error selecting employee file: ${error.message}`,
    })
    throw error
  }
})

// Handle selecting payslip files
ipcMain.handle("select-payslip-files", async () => {
  try {
    mainWindow.webContents.send("process-update", {
      step: "payslip-files",
      status: "selecting",
      message: "Selecting payslip files...",
    })

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    })

    if (result.canceled) {
      mainWindow.webContents.send("process-update", {
        step: "payslip-files",
        status: "cancelled",
        message: "Payslip file selection cancelled",
      })
      return []
    }

    mainWindow.webContents.send("process-update", {
      step: "payslip-files",
      status: "processing",
      message: "Processing payslip files...",
    })

    // Validate that files are actually PDFs
    const validFiles = []
    const invalidFiles = []

    for (const filePath of result.filePaths) {
      try {
        const stats = fs.statSync(filePath)
        if (stats.isFile() && path.extname(filePath).toLowerCase() === ".pdf") {
          validFiles.push({
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
          })
        } else {
          invalidFiles.push(path.basename(filePath))
        }
      } catch (error) {
        log.error(`Error processing file ${filePath}:`, error)
        invalidFiles.push(path.basename(filePath))
      }
    }

    if (invalidFiles.length > 0) {
      mainWindow.webContents.send("process-update", {
        step: "payslip-files",
        status: "warning",
        message: `${invalidFiles.length} invalid files were skipped`,
        details: invalidFiles,
      })
    }

    if (validFiles.length === 0) {
      mainWindow.webContents.send("process-update", {
        step: "payslip-files",
        status: "error",
        message: "No valid PDF files were selected",
      })
      throw new Error("No valid PDF files were selected")
    }

    mainWindow.webContents.send("process-update", {
      step: "payslip-files",
      status: "success",
      message: `Successfully loaded ${validFiles.length} payslip files`,
    })

    return validFiles
  } catch (error) {
    mainWindow.webContents.send("process-update", {
      step: "payslip-files",
      status: "error",
      message: `Error selecting payslip files: ${error.message}`,
    })
    throw error
  }
})

// Handle saving SMTP settings
ipcMain.on("save-smtp-settings", (event, settings) => {
  try {
    store.set("smtp", settings)
    mainWindow.webContents.send("process-update", {
      step: "smtp-settings",
      status: "success",
      message: "SMTP settings saved successfully",
    })
    event.reply("smtp-settings-saved", true)
  } catch (error) {
    mainWindow.webContents.send("process-update", {
      step: "smtp-settings",
      status: "error",
      message: `Error saving SMTP settings: ${error.message}`,
    })
    event.reply("smtp-settings-saved", false)
  }
})

// Handle getting SMTP settings
ipcMain.handle("get-smtp-settings", () => {
  return store.get("smtp", defaultSmtpSettings)
})

// Handle sending payslips
ipcMain.handle("send-payslips", async (event, { employees, payslips }) => {
  try {
    const smtpSettings = store.get("smtp")

    if (!smtpSettings || !smtpSettings.host || !smtpSettings.user) {
      mainWindow.webContents.send("process-update", {
        step: "send-payslips",
        status: "error",
        message: "SMTP settings not configured",
      })
      throw new Error("SMTP settings not configured")
    }

    mainWindow.webContents.send("process-update", {
      step: "send-payslips",
      status: "mapping",
      message: "Mapping payslips to employees...",
    })

    // Map of employee_id to payslip file
    const payslipMap = new Map()
    const unmatchedEmployees = []
    const unmatchedPayslips = []

    // Match payslips to employees based on filename
    for (const payslip of payslips) {
      let matched = false
      for (const employee of employees) {
        if (payslip.name.toLowerCase().includes(employee.employee_id.toLowerCase())) {
          payslipMap.set(employee.employee_id, payslip)
          matched = true
          break
        }
      }
      if (!matched) {
        unmatchedPayslips.push(payslip.name)
      }
    }

    // Find employees without payslips
    for (const employee of employees) {
      if (!payslipMap.has(employee.employee_id)) {
        unmatchedEmployees.push(employee.employee_id)
      }
    }

    // Report mapping results
    if (unmatchedPayslips.length > 0) {
      mainWindow.webContents.send("process-update", {
        step: "send-payslips",
        status: "warning",
        message: `${unmatchedPayslips.length} payslips could not be matched to any employee`,
        details: unmatchedPayslips,
      })
    }

    if (unmatchedEmployees.length > 0) {
      mainWindow.webContents.send("process-update", {
        step: "send-payslips",
        status: "warning",
        message: `${unmatchedEmployees.length} employees do not have matching payslips`,
        details: unmatchedEmployees,
      })
    }

    const matchedCount = payslipMap.size
    if (matchedCount === 0) {
      mainWindow.webContents.send("process-update", {
        step: "send-payslips",
        status: "error",
        message: "No payslips could be matched to employees",
      })
      throw new Error("No payslips could be matched to employees")
    }

    mainWindow.webContents.send("process-update", {
      step: "send-payslips",
      status: "success",
      message: `Successfully matched ${matchedCount} payslips to employees`,
    })

    // Configure email transporter
    mainWindow.webContents.send("process-update", {
      step: "send-payslips",
      status: "configuring",
      message: "Configuring email service...",
    })

    let transporter
    try {
      transporter = nodemailer.createTransport({
        host: smtpSettings.host,
        port: smtpSettings.port,
        secure: smtpSettings.secure,
        auth: {
          user: smtpSettings.user,
          password: smtpSettings.password,
        },
      })

      // Verify connection
      await transporter.verify()

      mainWindow.webContents.send("process-update", {
        step: "send-payslips",
        status: "success",
        message: "Email service configured successfully",
      })
    } catch (error) {
      mainWindow.webContents.send("process-update", {
        step: "send-payslips",
        status: "error",
        message: `Email configuration failed: ${error.message}`,
      })
      throw new Error(`Email configuration failed: ${error.message}`)
    }

    // Get email template
    const emailTemplate = store.get("emailTemplate", "")
    const defaultTemplate = `<p>Dear {{employee_name}},</p>
<p>Please find attached your payslip for this month.</p>
<p>Employee ID: {{employee_id}}</p>
<p>If you have any questions regarding your payslip, please contact the HR department.</p>
<p>Regards,<br>HR Department</p>`

    const template = emailTemplate || defaultTemplate

    // Start sending emails
    mainWindow.webContents.send("process-update", {
      step: "send-payslips",
      status: "sending",
      message: "Starting to send emails...",
    })

    const results = {
      total: employees.length,
      matched: matchedCount,
      sent: 0,
      failed: 0,
      details: [],
    }

    // Only process employees with matching payslips
    const employeesToProcess = employees.filter((emp) => payslipMap.has(emp.employee_id))

    // Send emails
    for (let i = 0; i < employeesToProcess.length; i++) {
      const employee = employeesToProcess[i]

      try {
        const payslip = payslipMap.get(employee.employee_id)

        // Update progress
        mainWindow.webContents.send("send-progress", {
          current: i + 1,
          total: employeesToProcess.length,
          currentEmail: employee.email,
        })

        // Process email template with employee data
        let emailContent = template
        emailContent = emailContent.replace(/{{employee_name}}/g, employee.name || "Employee")
        emailContent = emailContent.replace(/{{employee_id}}/g, employee.employee_id)
        emailContent = emailContent.replace(/{{employee_email}}/g, employee.email)

        // Convert HTML to plain text for text version
        const plainText = emailContent.replace(/<[^>]*>?/gm, "")

        // Send email with attachment
        const info = await transporter.sendMail({
          from: smtpSettings.user,
          to: employee.email,
          subject: "Your Monthly Payslip",
          text: plainText,
          html: emailContent,
          attachments: [
            {
              filename: path.basename(payslip.path),
              path: payslip.path,
            },
          ],
        })

        results.sent++
        results.details.push({
          email: employee.email,
          employee_id: employee.employee_id,
          success: true,
          messageId: info.messageId,
        })

        mainWindow.webContents.send("process-update", {
          step: "email",
          status: "success",
          message: `Email sent to ${employee.email}`,
        })
      } catch (error) {
        results.failed++
        results.details.push({
          email: employee.email,
          employee_id: employee.employee_id,
          success: false,
          message: error.message,
        })

        mainWindow.webContents.send("process-update", {
          step: "email",
          status: "error",
          message: `Failed to send email to ${employee.email}: ${error.message}`,
        })
      }

      // Small delay to prevent overwhelming the SMTP server
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Final status update
    if (results.failed > 0) {
      mainWindow.webContents.send("process-update", {
        step: "send-payslips",
        status: "warning",
        message: `Completed with ${results.failed} failures. Sent ${results.sent} out of ${results.matched} payslips.`,
      })
    } else {
      mainWindow.webContents.send("process-update", {
        step: "send-payslips",
        status: "success",
        message: `Successfully sent all ${results.sent} payslips.`,
      })
    }

    // Save results to history
    const history = store.get("history", [])
    history.unshift({
      date: new Date().toISOString(),
      results: results,
    })
    store.set("history", history.slice(0, 10)) // Keep only the last 10 runs

    return results
  } catch (error) {
    log.error("Error in sendPayslips:", error)
    mainWindow.webContents.send("process-update", {
      step: "send-payslips",
      status: "error",
      message: `Process failed: ${error.message}`,
    })
    throw error
  }
})

// Handle viewing email history
ipcMain.handle("get-email-history", () => {
  return store.get("history", [])
})

// Handle opening log file
ipcMain.handle("open-log-file", () => {
  shell.openPath(log.transports.file.getFile().path)
})
