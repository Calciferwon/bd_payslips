"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { sendPayslips } from "@/app/actions/send-payslips"
import { UploadEmployeeList } from "@/components/upload-employee-list"
import { UploadPayslips } from "@/components/upload-payslips"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertCircle } from "lucide-react"

export function PayslipSender() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<{
    total: number
    sent: number
    failed: number
    details: Array<{ email: string; success: boolean; message?: string }>
  } | null>(null)
  const [employeeData, setEmployeeData] = useState<Array<{ employee_id: string; email: string; name?: string }>>([])
  const [payslipFiles, setPayslipFiles] = useState<File[]>([])

  const handleSendPayslips = async () => {
    if (employeeData.length === 0) {
      toast({
        title: "No employee data",
        description: "Please upload your employee list first.",
        variant: "destructive",
      })
      return
    }

    if (payslipFiles.length === 0) {
      toast({
        title: "No payslips uploaded",
        description: "Please upload your payslip PDF files first.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      setProgress(0)
      setResults(null)

      // Create FormData to send files
      const formData = new FormData()

      // Add employee data as JSON
      formData.append("employeeData", JSON.stringify(employeeData))

      // Add all payslip files
      payslipFiles.forEach((file) => {
        formData.append("payslips", file)
      })

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 5
          return newProgress > 90 ? 90 : newProgress
        })
      }, 300)

      const result = await sendPayslips(formData)

      clearInterval(progressInterval)
      setProgress(100)
      setResults(result)

      toast({
        title: "Process completed",
        description: `Successfully sent ${result.sent} out of ${result.total} payslips.`,
        variant: result.failed > 0 ? "destructive" : "default",
      })
    } catch (error) {
      toast({
        title: "Error sending payslips",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetProcess = () => {
    setResults(null)
    setProgress(0)
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Payslip Email Sender</CardTitle>
        <CardDescription>
          Send password-protected payslips to your employees in bulk with just a few clicks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="setup" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="send" disabled={employeeData.length === 0 || payslipFiles.length === 0}>
              Send Emails
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!results}>
              Results
            </TabsTrigger>
          </TabsList>
          <TabsContent value="setup" className="space-y-6 pt-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Step 1: Upload Employee List</h3>
                <p className="text-sm text-gray-500 mb-4">Upload a CSV file with employee_id and email columns.</p>
                <UploadEmployeeList onUpload={setEmployeeData} />
                {employeeData.length > 0 && (
                  <div className="mt-2 text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {employeeData.length} employees loaded
                  </div>
                )}
              </div>

              <div className="pt-4">
                <h3 className="text-lg font-medium mb-2">Step 2: Upload Payslips</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Upload your PDF payslips. File names should include the employee_id (e.g., "payslip_EMP001.pdf").
                </p>
                <UploadPayslips onUpload={setPayslipFiles} />
                {payslipFiles.length > 0 && (
                  <div className="mt-2 text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {payslipFiles.length} payslips uploaded
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="send" className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Summary</h3>
                <ul className="text-sm space-y-1">
                  <li>Employees: {employeeData.length}</li>
                  <li>Payslips: {payslipFiles.length}</li>
                </ul>
              </div>

              {isLoading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sending emails...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <div className="pt-4">
                <Button onClick={handleSendPayslips} disabled={isLoading} className="w-full">
                  {isLoading ? "Sending..." : "Send Payslips"}
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="results" className="space-y-6 pt-4">
            {results && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold">{results.total}</div>
                    <div className="text-sm text-gray-500">Total</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{results.sent}</div>
                    <div className="text-sm text-green-600">Sent</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 font-medium">Details</div>
                  <div className="max-h-60 overflow-y-auto">
                    {results.details.map((item, index) => (
                      <div key={index} className="px-4 py-2 border-t flex items-center">
                        {item.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                        )}
                        <span className="text-sm">{item.email}</span>
                        {!item.success && item.message && (
                          <span className="text-xs text-red-600 ml-2">({item.message})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={resetProcess} variant="outline" className="w-full">
                  Start New Process
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
