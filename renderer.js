window.addEventListener("error", (event) => {
  console.error("Renderer error:", event.error)
})

const { ipcRenderer } = require("electron")
const path = require("path")
const fs = require("fs")

// Initialize the application
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Check if app element exists
    const app = document.getElementById("app")
    if (!app) {
      console.error("App element not found!")
      document.body.innerHTML =
        '<div style="padding: 20px; color: red;">Error: App element not found. Please check the console for more details.</div>'
      return
    }

    // Get current user
    const user = await ipcRenderer.invoke("get-current-user")
    if (!user) {
      window.location.href = "login.html"
      return
    }

    // Initialize the UI
    initUI(user)

    // Check for environment variables
    checkEnvironmentVariables()

    // Initialize process log
    initProcessLog()

    // Initialize notifications
    initNotifications()

    // Set up tab navigation
    setupTabs()

    // Set up file upload buttons
    setupFileUploadButtons()

    // Set up send payslips functionality
    setupSendPayslips()

    // Set up SMTP settings form
    setupSmtpSettingsForm()

    // Set up email settings form
    setupEmailSettingsForm()

    // Load email history
    loadEmailHistory()

    // Update summary when the app loads
    updateSendEmailsSummary()
  } catch (error) {
    console.error("Initialization error:", error)
    document.body.innerHTML += `<div style="padding: 20px; color: red;">Initialization error: ${error.message}</div>`
  }
})

// Initialize the UI with user information
function initUI(user) {
  // Set user info in the header
  const userEmail = document.getElementById("user-email")
  if (userEmail) {
    userEmail.textContent = user.email
  }

  // Set user avatar if available
  const userAvatar = document.querySelector(".user-avatar")
  if (userAvatar && user.picture) {
    userAvatar.src = user.picture
  }

  // Set up logout button
  const logoutButton = document.getElementById("logout-button")
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await ipcRenderer.invoke("logout")
      } catch (error) {
        console.error("Logout error:", error)
      }
    })
  }
}

// Check for environment variables
function checkEnvironmentVariables() {
  const envNotice = document.createElement("div")
  envNotice.className = "env-notice"

  if (process.env.SMTP_HOST) {
    envNotice.innerHTML = `
      <p><strong>Notice:</strong> Using SMTP settings from environment variables.</p>
    `
    document.querySelector(".container").insertBefore(envNotice, document.querySelector(".tabs"))
  }
}

// Initialize process log
function initProcessLog() {
  const processLog = document.getElementById("process-log")
  const toggleLogButton = document.getElementById("toggle-log")
  const processLogContainer = document.getElementById("process-log-container")

  if (toggleLogButton && processLogContainer) {
    toggleLogButton.addEventListener("click", () => {
      if (processLogContainer.style.display === "none") {
        processLogContainer.style.display = "flex"
        toggleLogButton.textContent = "Hide"
      } else {
        processLogContainer.style.display = "none"
        toggleLogButton.textContent = "Show"
      }
    })
  }

  // Listen for process updates
  ipcRenderer.on("process-update", (event, update) => {
    if (processLog) {
      const logEntry = document.createElement("div")
      logEntry.className = `log-entry ${update.status || "info"}`

      const timestamp = new Date().toLocaleTimeString()
      logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${update.message}`

      processLog.appendChild(logEntry)
      processLog.scrollTop = processLog.scrollHeight

      // Update the summary after each process update
      updateSendEmailsSummary()
    }
  })
}

// Initialize notifications
function initNotifications() {
  const notificationContainer = document.getElementById("notification-container")

  // Function to show notification
  window.showNotification = (message, type = "info") => {
    if (!notificationContainer) return

    const notification = document.createElement("div")
    notification.className = `notification ${type}`

    let icon = "🔔"
    if (type === "success") icon = "✅"
    if (type === "error") icon = "❌"
    if (type === "warning") icon = "⚠️"

    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
      <span class="notification-close">✕</span>
    `

    notificationContainer.appendChild(notification)

    // Add click event to close button
    notification.querySelector(".notification-close").addEventListener("click", () => {
      notification.remove()
    })

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.remove()
    }, 5000)
  }
}

// Set up tab navigation
function setupTabs() {
  const tabs = document.querySelectorAll(".tab")
  const tabContents = document.querySelectorAll(".tab-content")

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active class from all tabs
      tabs.forEach((t) => t.classList.remove("active"))

      // Add active class to clicked tab
      tab.classList.add("active")

      // Hide all tab contents
      tabContents.forEach((content) => content.classList.remove("active"))

      // Show the corresponding tab content
      const tabId = tab.getAttribute("data-tab")
      document.getElementById(tabId).classList.add("active")

      // Special handling for specific tabs
      if (tabId === "email-template-tab") {
        initEmailTemplateEditor()
      } else if (tabId === "validation-tab") {
        // Nothing special needed for validation tab initialization
      } else if (tabId === "send-tab") {
        // Update the summary when switching to the send emails tab
        updateSendEmailsSummary()
      } else if (tabId === "history-tab") {
        // Refresh history when switching to the history tab
        loadEmailHistory()
      } else if (tabId === "settings-tab") {
        // Load SMTP settings when switching to the settings tab
        loadSmtpSettings()
        loadEmailSettings()
      }
    })
  })

  // Initialize the first tab by default
  if (tabs.length > 0) {
    tabs[0].click()
  }
}

// Update the Send Emails tab summary
async function updateSendEmailsSummary() {
  try {
    console.log("Updating send emails summary")

    // Get employees and payslips
    const employees = await ipcRenderer.invoke("get-employees")
    const payslips = await ipcRenderer.invoke("get-payslips")

    console.log("Employees:", employees.length)
    console.log("Payslips:", payslips.length)

    // Count matched payslips
    let matchedCount = 0
    if (payslips && payslips.length > 0) {
      matchedCount = payslips.filter((p) => p.employeeId).length
    }

    console.log("Matched count:", matchedCount)

    // Update the summary elements
    const employeesCount = document.getElementById("summary-employees")
    const payslipsCount = document.getElementById("summary-payslips")
    const matchedCountEl = document.getElementById("summary-matched")

    if (employeesCount) employeesCount.textContent = employees ? employees.length : 0
    if (payslipsCount) payslipsCount.textContent = payslips ? payslips.length : 0
    if (matchedCountEl) matchedCountEl.textContent = matchedCount

    // Enable/disable the send button based on whether there are matched payslips
    const sendButton = document.getElementById("send-payslips")
    if (sendButton) {
      sendButton.disabled = matchedCount === 0
    }
  } catch (error) {
    console.error("Error updating send emails summary:", error)
  }
}

// Set up file upload buttons
function setupFileUploadButtons() {
  // Employee CSV upload
  const selectEmployeeButton = document.getElementById("select-employee-file")
  if (selectEmployeeButton) {
    // Add a button to load from URL
    const employeeFileInfo = document.getElementById("employee-file-info")
    if (employeeFileInfo) {
      const urlButton = document.createElement("button")
      urlButton.className = "button secondary"
      urlButton.style.marginTop = "10px"
      urlButton.style.marginRight = "10px"
      urlButton.textContent = "Load CSV from URL"
      urlButton.addEventListener("click", async () => {
        try {
          // URL to your CSV file
          const csvUrl =
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/list-QNKeQ9VgfbOFKxvuwySH41rRcWbSgY.csv"

          // Show loading state
          employeeFileInfo.innerHTML = '<div class="file-info">Loading CSV from URL...</div>'

          // Process the CSV file from URL
          const employees = await ipcRenderer.invoke("process-employee-csv-from-url", csvUrl)

          // Update UI
          if (employees.length > 0) {
            employeeFileInfo.innerHTML = `<div class="file-success">✓ Loaded ${employees.length} employees from URL</div>`
            window.showNotification(`Successfully loaded ${employees.length} employees from URL`, "success")

            // Update the send emails summary
            updateSendEmailsSummary()
          } else {
            employeeFileInfo.innerHTML = `
              <div class="file-error">⚠️ Loaded 0 employees from URL</div>
              <div class="csv-help">
                <p>Your CSV file should have these columns:</p>
                <ul>
                  <li><strong>employee_id</strong> (or id, employeeid)</li>
                  <li><strong>email</strong> (or email_address)</li>
                  <li><strong>name</strong> (optional)</li>
                </ul>
                <p>Please check your CSV headers and try again.</p>
              </div>
            `
            window.showNotification(`No employees found in CSV. Check column names.`, "warning")
          }
        } catch (error) {
          console.error("Error loading CSV from URL:", error)
          employeeFileInfo.innerHTML = `<div class="file-error">❌ Error loading CSV from URL: ${error.message}</div>`
          window.showNotification(`Error loading CSV: ${error.message}`, "error")
        }
      })

      // Add the button before any existing content
      employeeFileInfo.insertBefore(urlButton, employeeFileInfo.firstChild)

      // Add sample CSV button
      const sampleButton = document.createElement("button")
      sampleButton.className = "button secondary"
      sampleButton.style.marginTop = "10px"
      sampleButton.style.fontSize = "12px"
      sampleButton.textContent = "Download Sample CSV"
      sampleButton.addEventListener("click", async () => {
        try {
          const result = await ipcRenderer.invoke("generate-sample-csv")
          if (result.success) {
            window.showNotification("Sample CSV file created successfully", "success")
          }
        } catch (error) {
          console.error("Error generating sample CSV:", error)
          window.showNotification(`Error creating sample: ${error.message}`, "error")
        }
      })

      employeeFileInfo.appendChild(sampleButton)
    }

    selectEmployeeButton.addEventListener("click", async () => {
      try {
        const result = await ipcRenderer.invoke("select-file", {
          title: "Select Employee CSV File",
          filters: [
            { name: "CSV Files", extensions: ["csv"] },
            { name: "All Files", extensions: ["*"] },
          ],
          properties: ["openFile"],
        })

        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0]
          const fileName = filePath.split(/[\\/]/).pop()

          // Process the CSV file
          const employees = await ipcRenderer.invoke("process-employee-csv", filePath)

          // Update UI
          const fileInfo = document.getElementById("employee-file-info")
          if (fileInfo) {
            if (employees.length > 0) {
              fileInfo.innerHTML = `<div class="file-success">✓ Loaded ${employees.length} employees from ${fileName}</div>`

              // Update the send emails summary
              updateSendEmailsSummary()
            } else {
              fileInfo.innerHTML = `
                <div class="file-error">⚠️ Loaded 0 employees from ${fileName}</div>
                <div class="csv-help">
                  <p>Your CSV file should have these columns:</p>
                  <ul>
                    <li><strong>employee_id</strong> (or id, employeeid)</li>
                    <li><strong>email</strong> (or email_address)</li>
                    <li><strong>name</strong> (optional)</li>
                  </ul>
                  <p>Please check your CSV headers and try again.</p>
                </div>
              `
            }
          }

          // Show notification
          if (employees.length > 0) {
            window.showNotification(`Successfully loaded ${employees.length} employees from CSV`, "success")
          } else {
            window.showNotification(`No employees found in CSV. Check column names.`, "warning")
          }
        }
      } catch (error) {
        console.error("Error selecting employee file:", error)
        window.showNotification(`Error loading CSV: ${error.message}`, "error")
      }
    })
  }

  // Payslip PDFs upload
  const selectPayslipsButton = document.getElementById("select-payslip-files")
  if (selectPayslipsButton) {
    selectPayslipsButton.addEventListener("click", async () => {
      try {
        const result = await ipcRenderer.invoke("select-file", {
          title: "Select Payslip PDF Files",
          filters: [
            { name: "PDF Files", extensions: ["pdf"] },
            { name: "All Files", extensions: ["*"] },
          ],
          properties: ["openFile", "multiSelections"],
        })

        if (!result.canceled && result.filePaths.length > 0) {
          const filePaths = result.filePaths

          // Process the PDF files
          const payslips = await ipcRenderer.invoke("process-payslip-files", filePaths)

          // Update UI
          const filesList = document.getElementById("payslip-files-list")
          const filesInfo = document.getElementById("payslip-files-info")

          if (filesInfo) {
            filesInfo.innerHTML = `<div class="file-success">✓ Loaded ${payslips.length} payslip files</div>`
          }

          if (filesList) {
            filesList.innerHTML = payslips
              .map(
                (file) => `
              <div class="file-item">
                <span class="file-name">${file.name}</span>
                <span class="file-match ${file.employeeId ? "" : "no-match"}">${file.employeeId ? `Matched to employee ID: ${file.employeeId}` : "No employee match"}</span>
              </div>
            `,
              )
              .join("")
          }

          // Update the send emails summary
          updateSendEmailsSummary()

          // Show notification
          window.showNotification(`Successfully loaded ${payslips.length} payslip files`, "success")
        }
      } catch (error) {
        console.error("Error selecting payslip files:", error)
        window.showNotification(`Error loading payslips: ${error.message}`, "error")
      }
    })
  }
}

// Set up send payslips functionality
function setupSendPayslips() {
  const sendButton = document.getElementById("send-payslips")
  if (!sendButton) {
    console.error("Send payslips button not found!")
    return
  }

  console.log("Setting up send payslips button")

  sendButton.addEventListener("click", async () => {
    try {
      console.log("Send payslips button clicked")

      // Show loading state
      sendButton.disabled = true
      sendButton.textContent = "Sending..."

      window.showNotification("Starting to send payslips...", "info")

      // Get the progress elements
      const progressContainer = document.getElementById("send-progress-container")
      const progressFill = document.getElementById("progress-fill")
      const progressStatus = document.getElementById("progress-status")
      const progressCount = document.getElementById("progress-count")

      if (progressContainer) progressContainer.style.display = "block"

      // Check SMTP settings before sending
      const smtpSettings = await ipcRenderer.invoke("get-smtp-settings")
      if (!smtpSettings.host || !smtpSettings.user || !smtpSettings.password) {
        // Show warning about SMTP settings
        window.showNotification("SMTP settings not configured. Emails will be simulated.", "warning")

        // Add log entry
        const processLog = document.getElementById("process-log")
        if (processLog) {
          const logEntry = document.createElement("div")
          logEntry.className = "log-entry warning"
          const timestamp = new Date().toLocaleTimeString()
          logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> SMTP settings not configured. Emails will be simulated.`
          processLog.appendChild(logEntry)
          processLog.scrollTop = processLog.scrollHeight
        }
      }

      // Start the sending process
      const result = await ipcRenderer.invoke("send-payslips")

      console.log("Send payslips result:", result)

      // Update UI with results
      if (progressFill) progressFill.style.width = "100%"
      if (progressStatus) progressStatus.textContent = "Completed"
      if (progressCount) progressCount.textContent = `${result.sent}/${result.total}`

      // Show results
      const resultsTab = document.querySelector('.tab[data-tab="results-tab"]')
      if (resultsTab) {
        resultsTab.click()

        // Update results UI
        const resultsContainer = document.getElementById("results-container")
        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="results-summary">
              <div class="result-stat total">
                <div class="result-number">${result.total}</div>
                <div class="result-label">Total</div>
              </div>
              <div class="result-stat sent">
                <div class="result-number">${result.sent}</div>
                <div class="result-label">Sent</div>
              </div>
              <div class="result-stat failed">
                <div class="result-number">${result.failed}</div>
                <div class="result-label">Failed</div>
              </div>
            </div>
            
            <div class="results-details">
              <h3>Details</h3>
              <div class="results-list">
                ${result.details
                  .map(
                    (item) => `
                  <div class="result-item ${item.success ? "success" : "error"}">
                    <div class="result-status">${item.success ? "✓" : "✕"}</div>
                    <div class="result-info">
                      <div class="result-email">${item.email}</div>
                      ${item.message ? `<div class="result-message">${item.message}</div>` : ""}
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            </div>
            
            <button id="new-process" class="button full-width">Start New Process</button>
          `

          // Add event listener to the new process button
          const newProcessButton = document.getElementById("new-process")
          if (newProcessButton) {
            newProcessButton.addEventListener("click", () => {
              // Go back to setup tab
              const setupTab = document.querySelector('.tab[data-tab="setup-tab"]')
              if (setupTab) setupTab.click()
            })
          }
        }
      }

      // Refresh the history tab
      loadEmailHistory()

      // Show notification
      window.showNotification(
        `Sent ${result.sent} out of ${result.total} payslips`,
        result.failed > 0 ? "warning" : "success",
      )
    } catch (error) {
      console.error("Error sending payslips:", error)
      window.showNotification(`Error sending payslips: ${error.message}`, "error")
    } finally {
      // Reset button state
      sendButton.disabled = false
      sendButton.textContent = "Send Payslips"
    }
  })

  // Listen for send progress updates
  ipcRenderer.on("send-progress-update", (event, data) => {
    const progressFill = document.getElementById("progress-fill")
    const progressStatus = document.getElementById("progress-status")
    const progressCount = document.getElementById("progress-count")

    if (progressFill) {
      progressFill.style.width = `${data.progress}%`
    }

    if (progressStatus) {
      progressStatus.textContent = `Sending... ${data.progress}%`
    }
  })
}

// Initialize the email template editor
let quill
function initEmailTemplateEditor() {
  // Check if Quill is already initialized
  if (quill) return

  // Check if the editor container exists
  const editorContainer = document.getElementById("editor-container")
  if (!editorContainer) return

  // Load the line-height module if it exists
  try {
    const lineHeightModulePath = path.join(__dirname, "line-height-module.js")
    if (fs.existsSync(lineHeightModulePath)) {
      require(lineHeightModulePath)
    }
  } catch (error) {
    console.error("Error loading line-height module:", error)
  }

  // Register custom font formats
  const Quill = window.Quill
  const Font = Quill.import("formats/font")
  // Add font whitelist
  Font.whitelist = ["verdana", "arial", "times", "georgia", "tahoma", "calibri", "helvetica", "courier"]
  Quill.register(Font, true)

  // Define font name translations
  const fontNames = {
    verdana: "Verdana",
    arial: "Arial",
    times: "Times New Roman",
    georgia: "Georgia",
    tahoma: "Tahoma",
    calibri: "Calibri",
    helvetica: "Helvetica",
    courier: "Courier New",
  }

  // Initialize Quill
  quill = new Quill("#editor-container", {
    modules: {
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          [{ font: ["verdana", "arial", "times", "georgia", "tahoma", "calibri", "helvetica", "courier"] }],
          [{ size: ["small", false, "large", "huge"] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ lineheight: ["1.0", "1.2", "1.5", "2.0"] }],
          [{ align: [] }],
          ["link"],
          ["clean"],
        ],
        handlers: {},
      },
    },
    placeholder: "Compose your email template...",
    theme: "snow",
  })

  // Set default font to Verdana
  quill.format("font", "verdana")

  // Apply font name translations to the dropdown
  setTimeout(() => {
    const fontPickerItems = document.querySelectorAll(".ql-font .ql-picker-item")
    fontPickerItems.forEach((item) => {
      const fontValue = item.getAttribute("data-value")
      if (fontValue && fontNames[fontValue]) {
        item.textContent = fontNames[fontValue]
        // Also apply the actual font to the item for preview
        item.style.fontFamily = fontNames[fontValue]
      }
    })

    // Update the font picker label
    const fontPickerLabel = document.querySelector(".ql-font .ql-picker-label")
    if (fontPickerLabel) {
      fontPickerLabel.addEventListener("DOMSubtreeModified", function () {
        const fontValue = this.getAttribute("data-value")
        if (fontValue && fontNames[fontValue]) {
          // Set the displayed text to the font name
          const nameSpan = this.querySelector("span")
          if (nameSpan) {
            nameSpan.textContent = fontNames[fontValue]
            // Also apply the font to the label for preview
            nameSpan.style.fontFamily = fontNames[fontValue]
          }
        }
      })

      // Trigger once to set initial value
      const initialFontValue = fontPickerLabel.getAttribute("data-value")
      if (initialFontValue && fontNames[initialFontValue]) {
        const nameSpan = fontPickerLabel.querySelector("span")
        if (nameSpan) {
          nameSpan.textContent = fontNames[initialFontValue]
          nameSpan.style.fontFamily = fontNames[initialFontValue]
        }
      }
    }
  }, 100) // Small delay to ensure the DOM is ready

  // Load saved template
  loadEmailTemplate()

  // Save template when content changes
  quill.on("text-change", saveEmailTemplate)

  // Add event listener for subject field
  const subjectField = document.getElementById("email-subject")
  if (subjectField) {
    subjectField.addEventListener("input", saveEmailTemplate)
  }
}

// Load saved email template
async function loadEmailTemplate() {
  try {
    if (!quill) return

    const savedTemplate = await ipcRenderer.invoke("get-email-template")
    const defaultTemplate = {
      subject: "Your Monthly Payslip",
      body: `<p>Dear {{employee_name}},</p>
<p>Please find attached your payslip for this month.</p>
<p>Employee ID: {{employee_id}}</p>
<p>If you have any questions regarding your payslip, please contact the HR department.</p>
<p>Regards,<br>HR Department</p>`,
    }

    // Set the subject field
    const subjectField = document.getElementById("email-subject")
    if (subjectField) {
      subjectField.value = savedTemplate?.subject || defaultTemplate.subject
    }

    // Set the body in Quill editor
    if (savedTemplate?.body) {
      quill.clipboard.dangerouslyPasteHTML(savedTemplate.body)
    } else {
      quill.clipboard.dangerouslyPasteHTML(defaultTemplate.body)
    }

    updateEmailPreview()
  } catch (error) {
    console.error("Error loading template:", error)
    window.showNotification("Failed to load email template", "error")
  }
}

// Add a new function to save the email template
function saveEmailTemplate() {
  const content = quill.root.innerHTML
  const subjectField = document.getElementById("email-subject")
  const subject = subjectField ? subjectField.value : "Your Monthly Payslip"

  ipcRenderer.send("save-email-template", { subject, body: content })
  updateEmailPreview()
}

// Update email preview
function updateEmailPreview() {
  const previewContainer = document.getElementById("preview-container")
  const previewSubject = document.getElementById("preview-subject")
  if (!previewContainer || !quill) return

  const content = quill.root.innerHTML
  const subjectField = document.getElementById("email-subject")
  const subject = subjectField ? subjectField.value : "Your Monthly Payslip"

  const sampleData = {
    employee_name: "John Doe",
    employee_id: "EMP001",
    employee_email: "john.doe@bdcf.org",
  }

  // Replace placeholders in subject
  let previewSubjectText = subject
  for (const [key, value] of Object.entries(sampleData)) {
    previewSubjectText = previewSubjectText.replace(new RegExp(`{{${key}}}`, "g"), value)
  }

  // Replace placeholders in body
  let previewContent = content
  for (const [key, value] of Object.entries(sampleData)) {
    previewContent = previewContent.replace(new RegExp(`{{${key}}}`, "g"), value)
  }

  // Update the preview
  if (previewSubject) {
    previewSubject.textContent = previewSubjectText
  }
  previewContainer.innerHTML = previewContent
}

// Set up email settings form
function setupEmailSettingsForm() {
  const emailSettingsForm = document.getElementById("email-settings-form")
  if (!emailSettingsForm) return

  // Handle form submission
  emailSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault()

    try {
      const formData = new FormData(emailSettingsForm)
      const settings = {
        senderName: formData.get("senderName") || "Payslip Sender",
      }

      console.log("Saving email settings:", settings)

      // Save settings using the new IPC handler
      const result = await ipcRenderer.invoke("save-email-settings", settings)

      if (result.success) {
        // Show success notification
        window.showNotification("Email settings saved successfully", "success")

        // Also update the SMTP sender name field for consistency
        const smtpSenderNameField = document.getElementById("smtp-sender-name")
        if (smtpSenderNameField) {
          smtpSenderNameField.value = settings.senderName
        }
      } else {
        throw new Error("Failed to save email settings")
      }
    } catch (error) {
      console.error("Error saving email settings:", error)
      window.showNotification("Failed to save email settings: " + error.message, "error")
    }
  })
}

// Load email settings
async function loadEmailSettings() {
  try {
    // Use the new IPC handler to get email settings
    const settings = await ipcRenderer.invoke("get-email-settings")
    console.log("Loaded email settings:", settings)

    // Update form fields
    const senderNameField = document.getElementById("sender-name")
    if (senderNameField) {
      senderNameField.value = settings.senderName || "Payslip Sender"
    }
  } catch (error) {
    console.error("Error loading email settings:", error)
    window.showNotification("Failed to load email settings", "error")
  }
}

// Start validation process
document.addEventListener("click", (event) => {
  if (event.target && event.target.id === "start-validation") {
    startValidation()
  }
})

// Start validation process
async function startValidation() {
  try {
    const resultsBody = document.getElementById("validation-results-body")
    if (!resultsBody) return

    resultsBody.innerHTML =
      '<div class="validation-item"><div class="validation-status pending">⏳</div><div class="validation-details"><div class="validation-name">Loading employees...</div></div></div>'

    // Get employees
    const employees = await ipcRenderer.invoke("get-employees")

    if (!employees || employees.length === 0) {
      resultsBody.innerHTML =
        '<div class="validation-item"><div class="validation-status error">❌</div><div class="validation-details"><div class="validation-name">No employees found</div><div class="validation-message error">Please upload an employee list first</div></div></div>'
      return
    }

    // Show pending status for all employees
    resultsBody.innerHTML = employees
      .map(
        (employee, index) => `
      <div class="validation-item" id="validation-item-${index}">
        <div class="validation-status pending" id="validation-status-${index}">⏳</div>
        <div class="validation-details">
          <div class="validation-name">${employee.name || "Employee"} (${employee.employee_id})</div>
          <div class="validation-email">${employee.email}</div>
          <div class="validation-message" id="validation-message-${index}">Validating...</div>
        </div>
      </div>
    `,
      )
      .join("")

    // Validate each employee
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i]
      const statusEl = document.getElementById(`validation-status-${i}`)
      const messageEl = document.getElementById(`validation-message-${i}`)

      try {
        const result = await ipcRenderer.invoke("validate-employee", employee)

        if (result.valid) {
          statusEl.textContent = "✓"
          statusEl.className = "validation-status success"
          messageEl.textContent = "Valid"
          messageEl.className = "validation-message"
        } else {
          statusEl.textContent = "✕"
          statusEl.className = "validation-status error"
          messageEl.textContent = result.message || "Invalid"
          messageEl.className = "validation-message error"
        }
      } catch (error) {
        statusEl.textContent = "✕"
        statusEl.className = "validation-status error"
        messageEl.textContent = error.message || "Validation failed"
        messageEl.className = "validation-message error"
      }
    }
  } catch (error) {
    console.error("Validation error:", error)
    window.showNotification("Validation failed: " + error.message, "error")
  }
}

// Set up SMTP settings form
function setupSmtpSettingsForm() {
  const smtpForm = document.getElementById("smtp-form")
  if (!smtpForm) return

  // Handle form submission
  smtpForm.addEventListener("submit", async (event) => {
    event.preventDefault()

    try {
      const formData = new FormData(smtpForm)
      const settings = {
        host: formData.get("host"),
        port: Number.parseInt(formData.get("port") || "587"),
        secure: formData.get("secure") === "on",
        user: formData.get("user"),
        password: formData.get("password"),
        senderName: formData.get("senderName") || "Payslip Sender",
      }

      // Add guidance about SSL/TLS settings
      let guidance = ""
      if (settings.port === 465) {
        guidance = "Port 465 typically requires SSL to be enabled."
        if (!settings.secure) {
          guidance += " Consider enabling the 'Use Secure Connection' option."
        }
      } else if (settings.port === 587) {
        guidance = "Port 587 typically uses STARTTLS (not SSL)."
        if (settings.secure) {
          guidance += " Consider disabling the 'Use Secure Connection' option."
        }
      }

      // Save settings
      await ipcRenderer.invoke("save-smtp-settings", settings)

      // Show success notification with guidance if applicable
      if (guidance) {
        window.showNotification(`SMTP settings saved. ${guidance}`, "info")
      } else {
        window.showNotification("SMTP settings saved successfully", "success")
      }
    } catch (error) {
      console.error("Error saving SMTP settings:", error)
      window.showNotification("Failed to save SMTP settings: " + error.message, "error")
    }
  })

  // Handle test connection button
  const testButton = document.getElementById("test-smtp")
  if (testButton) {
    testButton.addEventListener("click", async () => {
      try {
        // Get form data
        const formData = new FormData(smtpForm)
        const settings = {
          host: formData.get("host"),
          port: Number.parseInt(formData.get("port") || "587"),
          secure: formData.get("secure") === "on",
          user: formData.get("user"),
          password: formData.get("password"),
        }

        // Validate required fields
        if (!settings.host || !settings.user || !settings.password) {
          window.showNotification("Please fill in all required fields", "warning")
          return
        }

        // Show testing notification
        window.showNotification("Testing SMTP connection...", "info")
        testButton.disabled = true
        testButton.textContent = "Testing..."

        // Test connection
        const result = await ipcRenderer.invoke("test-smtp-connection", settings)

        if (result.success) {
          if (result.message) {
            window.showNotification(`SMTP connection successful! ${result.message}`, "success")
          } else {
            window.showNotification("SMTP connection successful!", "success")
          }
        } else {
          // Special handling for Gmail authentication errors
          if (result.isGmailAuth) {
            // Create a more detailed notification for Gmail auth issues
            const notificationContainer = document.getElementById("notification-container")
            if (notificationContainer) {
              const notification = document.createElement("div")
              notification.className = "notification error"
              notification.innerHTML = `
                <span class="notification-icon">❌</span>
                <div class="notification-message">
                  <strong>Gmail Authentication Failed</strong>
                  <p>You need to use an App Password instead of your regular password.</p>
                  <ol style="margin-top: 5px; padding-left: 20px;">
                    <li>Go to <a href="#" class="gmail-link">Google Account Settings</a></li>
                    <li>Enable 2-Step Verification if not already enabled</li>
                    <li>Go to App Passwords and generate a new password</li>
                    <li>Use that password instead of your regular Gmail password</li>
                  </ol>
                </div>
                <span class="notification-close">✕</span>
              `

              notificationContainer.appendChild(notification)

              // Add click event to close button
              notification.querySelector(".notification-close").addEventListener("click", () => {
                notification.remove()
              })

              // Add click event to the Gmail link
              notification.querySelector(".gmail-link").addEventListener("click", (e) => {
                e.preventDefault()
                ipcRenderer.send("open-external-link", "https://myaccount.google.com/apppasswords")
              })

              // Don't auto-remove this notification as it contains important instructions
            } else {
              window.showNotification(`SMTP connection failed: ${result.error}`, "error")
            }
          } else {
            window.showNotification(`SMTP connection failed: ${result.error}`, "error")
          }
        }
      } catch (error) {
        console.error("Error testing SMTP connection:", error)
        window.showNotification(`Connection test failed: ${error.message}`, "error")
      } finally {
        testButton.disabled = false
        testButton.textContent = "Test Connection"
      }
    })
  }

  // Add event listener for Gmail account link
  const gmailAccountLink = document.getElementById("gmail-account-link")
  if (gmailAccountLink) {
    gmailAccountLink.addEventListener("click", (e) => {
      e.preventDefault()
      ipcRenderer.send("open-external-link", "https://myaccount.google.com/apppasswords")
    })
  }
}

// Load SMTP settings
async function loadSmtpSettings() {
  try {
    const settings = await ipcRenderer.invoke("get-smtp-settings")

    // Update form fields
    document.getElementById("smtp-host").value = settings.host || ""
    document.getElementById("smtp-port").value = settings.port || 587
    document.getElementById("smtp-secure").checked = settings.secure || false
    document.getElementById("smtp-user").value = settings.user || ""
    document.getElementById("smtp-password").value = settings.password || ""
    document.getElementById("smtp-sender-name").value = settings.senderName || ""
  } catch (error) {
    console.error("Error loading SMTP settings:", error)
    window.showNotification("Failed to load SMTP settings", "error")
  }
}

// Load email history
async function loadEmailHistory() {
  try {
    const historyContainer = document.getElementById("history-container")
    if (!historyContainer) return

    const history = await ipcRenderer.invoke("get-email-history")

    if (!history || history.length === 0) {
      historyContainer.innerHTML = '<div class="no-history">No email history available.</div>'
      return
    }

    historyContainer.innerHTML = `
      <div class="history-list">
        ${history
          .map(
            (entry) => `
          <div class="history-item">
            <div class="history-date">${new Date(entry.date).toLocaleString()}</div>
            <div class="history-summary">Sent ${entry.results.sent} out of ${entry.results.total} emails</div>
            <div class="history-details">
              <span class="history-stat sent">✓ ${entry.results.sent} sent</span>
              <span class="history-stat failed">✕ ${entry.results.failed} failed</span>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `
  } catch (error) {
    console.error("Error loading email history:", error)
    window.showNotification("Failed to load email history", "error")
  }
}
