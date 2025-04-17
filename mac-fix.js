const { execSync } = require("child_process")
const path = require("path")
const fs = require("fs")

console.log("=== Payslip Sender - macOS Fix Utility ===")
console.log('This script will help you fix the "app is damaged" error on macOS.')

try {
  // Get the application path
  const appPath = process.argv[2] || path.join(process.cwd(), "Payslip Sender.app")

  if (!fs.existsSync(appPath)) {
    console.error(`Error: Application not found at ${appPath}`)
    console.log("Please drag and drop the Payslip Sender.app onto this script.")
    process.exit(1)
  }

  console.log(`Fixing application at: ${appPath}`)

  // Remove quarantine attribute
  console.log("Removing quarantine attribute...")
  execSync(`xattr -d com.apple.quarantine "${appPath}"`, { stdio: "inherit" })

  console.log("\nFix applied successfully!")
  console.log("You should now be able to open the application normally.")
  console.log("\nIf you still encounter issues, try the following manual steps:")
  console.log("1. Open System Preferences > Security & Privacy")
  console.log('2. Click "Open Anyway" if prompted')
  console.log('3. Right-click the app and select "Open"')
} catch (error) {
  console.error("Error applying fix:", error.message)
  console.log("\nPlease try the manual method:")
  console.log("1. Open Terminal")
  console.log("2. Run this command (replace with your actual path):")
  console.log('   xattr -d com.apple.quarantine "/path/to/Payslip Sender.app"')
}
