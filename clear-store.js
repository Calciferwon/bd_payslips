const { app } = require("electron")
const fs = require("fs")
const path = require("path")

// This script will run without launching the full app
// It will delete the corrupted store file

// Initialize app to get the userData path
app.whenReady().then(() => {
  const userDataPath = app.getPath("userData")
  const storePath = path.join(userDataPath, "config.json")

  console.log(`Looking for store file at: ${storePath}`)

  if (fs.existsSync(storePath)) {
    try {
      // Create a backup just in case
      const backupPath = `${storePath}.backup-${Date.now()}`
      fs.copyFileSync(storePath, backupPath)
      console.log(`Created backup at: ${backupPath}`)

      // Delete the corrupted file
      fs.unlinkSync(storePath)
      console.log(`Successfully deleted store file at: ${storePath}`)
      console.log("You can now start the application normally.")
    } catch (error) {
      console.error("Failed to delete store file:", error)
    }
  } else {
    console.log("Store file not found. No action needed.")
  }

  app.quit()
})
