const { ipcRenderer } = require("electron")

// State management
const state = {
  activeTab: "setup",
  employees: [],
  payslips: [],
  isLoading: false,
  progress: {
    current: 0,
    total: 0,
    currentEmail: "",
  },
  results: null,
  smtpSettings: {
    host: "",
    port: 587,
    secure: false,
    user: "",
    password: "",
  },
  user: null,
  processLog: [],
  logVisible: true,
}

// DOM elements
const app = document.getElementById("app")
const processLog = document.getElementById("process-log")
const processLogContainer = document.getElementById("process-log-container")
const toggleLogButton = document.getElementById("toggle-log")

// Initialize the application
async function init() {
  // Get current user
  try {
    state.user = await ipcRenderer.invoke("get-current-user")
  } catch (error) {
    console.error("Failed to get current user:", error)
  }

  // Load SMTP settings
  try {
    state.smtpSettings = await ipcRenderer.invoke("get-smtp-settings")
  } catch (error) {
    console.error("Failed to load SMTP settings:", error)
    addToProcessLog("error", "Failed to load SMTP settings: " + error.message)
  }

  // Render the initial UI
  render()

  // Set up event listeners for progress updates
  ipcRenderer.on("send-progress", (event, progress) => {
    state.progress = progress
    updateProgress()
  })

  ipcRenderer.on("smtp-settings-saved", (event, success) => {
    if (success) {
      showNotification("success", "SMTP settings saved successfully")
    } else {
      showNotification("error", "Failed to save SMTP settings")
    }
  })

  // Set up process update listener
  ipcRenderer.on("process-update", (event, update) => {
    addToProcessLog(update.status, update.message, update.details)

    if (update.status === "error") {
      showNotification("error", update.message)
    } else if (update.status === "warning") {
      showNotification("warning", update.message)
    } else if (update.status === "success" && update.step !== "email") {
      // Don't show success notifications for individual emails to avoid spam
      showNotification("success", update.message)
    }
  })

  // Set up log toggle
  toggleLogButton.addEventListener("click", () => {
    state.logVisible = !state.logVisible
    if (state.logVisible) {
      processLog.style.display = "block"
      toggleLogButton.textContent = "Hide"
    } else {
      processLog.style.display = "none"
      toggleLogButton.textContent = "Show"
    }
  })
}

// Render the application UI
function render() {
  app.innerHTML = `
    <div class="container">
      <div class="header">
        <h1>Payslip Sender</h1>
        <p>Send payslips to your employees with just a few clicks</p>
        
        ${
          state.user
            ? `
          <div class="user-info">
            ${state.user.picture ? `<img src="${state.user.picture}" alt="Avatar" class="user-avatar">` : ""}
            <span class="user-email">${state.user.email}</span>
            <button class="logout-button" onclick="logout()">Logout</button>
          </div>
        `
            : ""
        }
      </div>
      
      <div class="tabs">
        <div class="tab ${state.activeTab === "setup" ? "active" : ""}" onclick="switchTab('setup')">Setup</div>
        <div class="tab ${state.activeTab === "send" ? "active" : ""}" onclick="switchTab('send')" ${
          state.employees.length === 0 || state.payslips.length === 0
            ? 'style="opacity: 0.5; cursor: not-allowed;"'
            : ""
        }>Send Emails</div>
        <div class="tab ${state.activeTab === "results" ? "active" : ""}" onclick="switchTab('results')" ${
          !state.results ? 'style="opacity: 0.5; cursor: not-allowed;"' : ""
        }>Results</div>
        <div class="tab ${state.activeTab === "settings" ? "active" : ""}" onclick="switchTab('settings')">Settings</div>
        <div class="tab ${state.activeTab === "history" ? "active" : ""}" onclick="switchTab('history')">History</div>
      </div>
      
      <div class="tab-content ${state.activeTab === "setup" ? "active" : ""}">
        <div class="section">
          <h2 class="section-title">Step 1: Upload Employee List</h2>
          <p class="section-description">Upload a CSV file with employee_id and email columns.</p>
          <button class="button" onclick="selectEmployeeFile()">Select Employee CSV</button>
          ${
            state.employees.length > 0
              ? `
            <div style="margin-top: 10px; color: #52c41a; font-size: 14px;">
              ✓ ${state.employees.length} employees loaded
            </div>
          `
              : ""
          }
        </div>
        
        <div class="section">
          <h2 class="section-title">Step 2: Select Payslips</h2>
          <p class="section-description">Select PDF payslips. File names should include the employee_id.</p>
          <button class="button" onclick="selectPayslipFiles()">Select Payslip PDFs</button>
          ${
            state.payslips.length > 0
              ? `
            <div style="margin-top: 10px; color: #52c41a; font-size: 14px;">
              ✓ ${state.payslips.length} payslips loaded
            </div>
            <div class="file-list">
              ${state.payslips
                .map(
                  (file, index) => `
                <div class="file-item">
                  <span>${file.name}</span>
                  <span class="remove" onclick="removePayslip(${index})">✕</span>
                </div>
              `,
                )
                .join("")}
            </div>
          `
              : ""
          }
        </div>
      </div>
      
      <div class="tab-content ${state.activeTab === "send" ? "active" : ""}">
        <div class="summary-box">
          <div class="summary-item">Employees: ${state.employees.length}</div>
          <div class="summary-item">Payslips: ${state.payslips.length}</div>
        </div>
        
        ${
          state.isLoading
            ? `
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(state.progress.current / state.progress.total) * 100}%"></div>
            </div>
            <div class="progress-text">
              <span>Sending email to: ${state.progress.currentEmail || "..."}</span>
              <span>${state.progress.current} / ${state.progress.total}</span>
            </div>
          </div>
        `
            : ""
        }
        
        <button class="button full-width" onclick="sendPayslips()" ${state.isLoading ? "disabled" : ""}>
          ${state.isLoading ? "Sending..." : "Send Payslips"}
        </button>
      </div>
      
      <div class="tab-content ${state.activeTab === "results" ? "active" : ""}">
        ${
          state.results
            ? `
          <div class="stats-container">
            <div class="stat-box total">
              <div class="stat-value">${state.results.total}</div>
              <div class="stat-label">Total Employees</div>
            </div>
            <div class="stat-box success">
              <div class="stat-value">${state.results.sent}</div>
              <div class="stat-label">Sent</div>
            </div>
            <div class="stat-box error">
              <div class="stat-value">${state.results.failed}</div>
              <div class="stat-label">Failed</div>
            </div>
          </div>
          
          <div class="details-container">
            <div class="details-header">Details</div>
            <div class="details-body">
              ${state.results.details
                .map(
                  (item) => `
                <div class="detail-item">
                  <span class="icon ${item.success ? "success-icon" : "error-icon"}">
                    ${item.success ? "✓" : "✕"}
                  </span>
                  <span>${item.email}</span>
                  ${item.success ? "" : `<span class="error-message">(${item.message})</span>`}
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
          
          <button class="button full-width" style="margin-top: 20px;" onclick="resetProcess()">
            Start New Process
          </button>
        `
            : `
          <p style="text-align: center; padding: 40px;">No results to display. Send payslips first.</p>
        `
        }
      </div>
      
      <div class="tab-content ${state.activeTab === "settings" ? "active" : ""}">
        <div class="section">
          <h2 class="section-title">SMTP Settings</h2>
          <p class="section-description">Configure your email server settings for sending payslips.</p>
          
          <div class="form-group">
            <label for="smtp-host">SMTP Host</label>
            <input type="text" id="smtp-host" value="${state.smtpSettings.host}" placeholder="e.g., smtp.gmail.com">
          </div>
          
          <div class="form-group">
            <label for="smtp-port">SMTP Port</label>
            <input type="number" id="smtp-port" value="${state.smtpSettings.port}" placeholder="e.g., 587">
          </div>
          
          <div class="form-group">
            <label>
              <input type="checkbox" id="smtp-secure" ${state.smtpSettings.secure ? "checked" : ""}>
              Use Secure Connection (SSL/TLS)
            </label>
          </div>
          
          <div class="form-group">
            <label for="smtp-user">Email Address</label>
            <input type="email" id="smtp-user" value="${state.smtpSettings.user}" placeholder="your.email@company.com">
          </div>
          
          <div class="form-group">
            <label for="smtp-password">Password</label>
            <input type="password" id="smtp-password" value="${state.smtpSettings.password}" placeholder="Your email password">
          </div>
          
          <button class="button" onclick="saveSmtpSettings()">Save Settings</button>
        </div>
        
        <div class="section">
          <h2 class="section-title">Application</h2>
          <p class="section-description">Application settings and tools.</p>
          
          <button class="button secondary" onclick="openLogFile()">Open Log File</button>
        </div>
      </div>
      
      <div class="tab-content ${state.activeTab === "history" ? "active" : ""}">
        <div class="section">
          <h2 class="section-title">Email History</h2>
          <p class="section-description">View history of previous email sending operations.</p>
          
          <button class="button secondary" onclick="loadHistory()">Load History</button>
          
          <div id="history-container" style="margin-top: 20px;">
            Loading...
          </div>
        </div>
      </div>
    </div>
  `
}

// Switch between tabs
window.switchTab = (tab) => {
  if (tab === "send" && (state.employees.length === 0 || state.payslips.length === 0)) {
    return
  }

  if (tab === "results" && !state.results) {
    return
  }

  state.activeTab = tab
  render()

  if (tab === "history") {
    loadHistory()
  }
}

// Select employee CSV file
window.selectEmployeeFile = async () => {
  try {
    const employees = await ipcRenderer.invoke("select-employee-file")
    if (employees) {
      state.employees = employees
      render()
    }
  } catch (error) {
    console.error("Error loading employee file:", error)
    // The notification will be shown by the process-update event
  }
}

// Select payslip PDF files
window.selectPayslipFiles = async () => {
  try {
    const files = await ipcRenderer.invoke("select-payslip-files")
    if (files && files.length > 0) {
      state.payslips = [...state.payslips, ...files]
      render()
    }
  } catch (error) {
    console.error("Error selecting payslip files:", error)
    // The notification will be shown by the process-update event
  }
}

// Remove a payslip from the list
window.removePayslip = (index) => {
  state.payslips.splice(index, 1)
  render()
}

// Send payslips
window.sendPayslips = async () => {
  if (state.employees.length === 0 || state.payslips.length === 0) {
    showNotification("error", "Please upload employee data and payslips first")
    return
  }

  state.isLoading = true
  state.progress = { current: 0, total: state.employees.length, currentEmail: "" }
  render()

  try {
    const results = await ipcRenderer.invoke("send-payslips", {
      employees: state.employees,
      payslips: state.payslips,
    })

    state.results = results

    // The notification will be shown by the process-update event

    // Switch to results tab
    state.activeTab = "results"
  } catch (error) {
    console.error("Error sending payslips:", error)
    // The notification will be shown by the process-update event
  } finally {
    state.isLoading = false
    render()
  }
}

// Reset the process
window.resetProcess = () => {
  state.results = null
  state.progress = { current: 0, total: 0, currentEmail: "" }
  state.activeTab = "setup"
  render()
}

// Save SMTP settings
window.saveSmtpSettings = () => {
  const host = document.getElementById("smtp-host").value
  const port = Number.parseInt(document.getElementById("smtp-port").value) || 587
  const secure = document.getElementById("smtp-secure").checked
  const user = document.getElementById("smtp-user").value
  const password = document.getElementById("smtp-password").value

  if (!host || !user || !password) {
    showNotification("error", "Please fill in all required SMTP fields")
    return
  }

  state.smtpSettings = { host, port, secure, user, password }
  ipcRenderer.send("save-smtp-settings", state.smtpSettings)
}

// Update progress bar
function updateProgress() {
  const progressFill = document.querySelector(".progress-fill")
  const progressText = document.querySelector(".progress-text span:last-child")
  const emailText = document.querySelector(".progress-text span:first-child")

  if (progressFill && progressText) {
    const percentage = (state.progress.current / state.progress.total) * 100
    progressFill.style.width = `${percentage}%`
    progressText.textContent = `${state.progress.current} / ${state.progress.total}`

    if (emailText && state.progress.currentEmail) {
      emailText.textContent = `Sending email to: ${state.progress.currentEmail}`
    }
  }
}

// Show notification
function showNotification(type, message) {
  const container = document.getElementById("notification-container")
  const id = Date.now()

  const notification = document.createElement("div")
  notification.className = `notification ${type}`
  notification.id = `notification-${id}`

  let icon = ""
  if (type === "success") icon = "✓"
  else if (type === "error") icon = "✕"
  else if (type === "warning") icon = "⚠"
  else icon = "ℹ"

  notification.innerHTML = `
    <span class="notification-icon">${icon}</span>
    <span class="notification-message">${message}</span>
    <span class="notification-close" onclick="closeNotification('${id}')">✕</span>
  `

  container.appendChild(notification)

  // Auto-remove after 5 seconds
  setTimeout(() => {
    closeNotification(id)
  }, 5000)
}

// Close notification
window.closeNotification = (id) => {
  const notification = document.getElementById(`notification-${id}`)
  if (notification) {
    notification.style.opacity = "0"
    notification.style.transform = "translateX(100%)"

    setTimeout(() => {
      notification.remove()
    }, 300)
  }
}

// Add to process log
function addToProcessLog(status, message, details) {
  const now = new Date()
  const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`

  const logEntry = document.createElement("div")
  logEntry.className = `log-entry ${status}`

  let detailsHtml = ""
  if (details && Array.isArray(details) && details.length > 0) {
    detailsHtml = `
      <div style="margin-top: 5px; margin-left: 15px; font-size: 11px;">
        ${details.map((d) => `- ${d}`).join("<br>")}
      </div>
    `
  }

  logEntry.innerHTML = `
    <span class="log-timestamp">[${timestamp}]</span>
    <span>${message}</span>
    ${detailsHtml}
  `

  processLog.appendChild(logEntry)
  processLog.scrollTop = processLog.scrollHeight

  // Keep only the last 100 log entries to prevent memory issues
  state.processLog.push({ status, message, timestamp, details })
  if (state.processLog.length > 100) {
    state.processLog.shift()
  }
}

// Load email history
window.loadHistory = async () => {
  const historyContainer = document.getElementById("history-container")
  historyContainer.innerHTML = "Loading..."

  try {
    const history = await ipcRenderer.invoke("get-email-history")

    if (history.length === 0) {
      historyContainer.innerHTML = "<p>No history available.</p>"
      return
    }

    let html = `
      <div class="details-container">
        <div class="details-header">Email Sending History</div>
        <div class="details-body" style="max-height: 400px;">
    `

    history.forEach((entry, index) => {
      const date = new Date(entry.date)
      const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`

      html += `
        <div style="padding: 15px; border-bottom: 1px solid #eee;">
          <div style="font-weight: 500; margin-bottom: 5px;">${formattedDate}</div>
          <div style="display: flex; margin-bottom: 10px;">
            <div style="flex: 1; text-align: center;">
              <div style="font-size: 18px; font-weight: bold;">${entry.results.total}</div>
              <div style="font-size: 12px; color: #666;">Total</div>
            </div>
            <div style="flex: 1; text-align: center;">
              <div style="font-size: 18px; font-weight: bold; color: #52c41a;">${entry.results.sent}</div>
              <div style="font-size: 12px; color: #666;">Sent</div>
            </div>
            <div style="flex: 1; text-align: center;">
              <div style="font-size: 18px; font-weight: bold; color: #ff4d4f;">${entry.results.failed}</div>
              <div style="font-size: 12px; color: #666;">Failed</div>
            </div>
          </div>
          <button class="button secondary" style="width: 100%;" onclick="toggleHistoryDetails(${index})">
            Show Details
          </button>
          <div id="history-details-${index}" style="display: none; margin-top: 10px;">
            ${entry.results.details
              .map(
                (item) => `
              <div style="padding: 5px; display: flex; align-items: center;">
                <span style="margin-right: 10px; color: ${item.success ? "#52c41a" : "#ff4d4f"}">
                  ${item.success ? "✓" : "✕"}
                </span>
                <span>${item.email}</span>
                ${item.success ? "" : `<span style="color: #ff4d4f; margin-left: 10px; font-size: 12px;">(${item.message})</span>`}
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `
    })

    html += `
        </div>
      </div>
    `

    historyContainer.innerHTML = html
  } catch (error) {
    historyContainer.innerHTML = `<p style="color: #ff4d4f;">Error loading history: ${error.message}</p>`
  }
}

// Toggle history details
window.toggleHistoryDetails = (index) => {
  const detailsElement = document.getElementById(`history-details-${index}`)
  const button = detailsElement.previousElementSibling

  if (detailsElement.style.display === "none") {
    detailsElement.style.display = "block"
    button.textContent = "Hide Details"
  } else {
    detailsElement.style.display = "none"
    button.textContent = "Show Details"
  }
}

// Open log file
window.openLogFile = async () => {
  await ipcRenderer.invoke("open-log-file")
}

// Logout
window.logout = async () => {
  try {
    await ipcRenderer.invoke("logout")
  } catch (error) {
    console.error("Error logging out:", error)
  }
}

// Initialize the application
init()
