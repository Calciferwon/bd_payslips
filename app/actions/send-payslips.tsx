"use server"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"

// This is a server action that processes the uploaded files and sends emails
export async function sendPayslips(formData: FormData) {
  try {
    // Parse employee data
    const employeeDataJson = formData.get("employeeData") as string
    const employeeData = JSON.parse(employeeDataJson)

    // Get all payslip files
    const payslipFiles = formData.getAll("payslips") as File[]

    // Create a temporary directory to store the files
    const tempDir = join(process.cwd(), "tmp", uuidv4())

    // In a real implementation, you would:
    // 1. Create the temp directory
    // 2. Save the files to the temp directory
    // 3. Match payslips to employees by employee_id in the filename
    // 4. Send emails with attachments
    // 5. Clean up the temp directory

    // For demo purposes, we'll simulate the process
    const results = {
      total: employeeData.length,
      sent: 0,
      failed: 0,
      details: [] as Array<{ email: string; success: boolean; message?: string }>,
    }

    // Map of employee_id to payslip file
    const payslipMap = new Map<string, File>()

    // Match payslips to employees based on filename
    for (const file of payslipFiles) {
      // Extract employee_id from filename
      // Assuming filename format like "payslip_EMP001.pdf" or contains the employee_id somewhere
      for (const employee of employeeData) {
        if (file.name.includes(employee.employee_id)) {
          payslipMap.set(employee.employee_id, file)
          break
        }
      }
    }

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate sending emails
    for (const employee of employeeData) {
      try {
        const payslip = payslipMap.get(employee.employee_id)

        if (!payslip) {
          throw new Error(`No matching payslip found for employee ${employee.employee_id}`)
        }

        // Simulate a 90% success rate for those with matching payslips
        const success = Math.random() > 0.1

        if (success) {
          // In a real implementation, you would:
          // 1. Read the payslip file
          // 2. Send an email with the payslip attached
          // 3. Log the success

          results.sent++
          results.details.push({
            email: employee.email,
            success: true,
          })
        } else {
          throw new Error("Failed to send email")
        }
      } catch (error) {
        results.failed++
        results.details.push({
          email: employee.email,
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        })
      }

      // Add a small delay between each email to simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // In a real implementation, you would clean up the temp directory here

    return results
  } catch (error) {
    console.error("Error in sendPayslips:", error)
    throw error
  }
}
