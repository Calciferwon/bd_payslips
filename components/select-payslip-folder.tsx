"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Folder } from "lucide-react"

interface SelectPayslipFolderProps {
  onSelect: (folderId: string) => void
}

export function SelectPayslipFolder({ onSelect }: SelectPayslipFolderProps) {
  const [folderId, setFolderId] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    if (!folderId) return

    setIsConnecting(true)
    try {
      // In a real implementation, you would verify the folder exists
      // and that it contains payslips
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call
      onSelect(folderId)
    } catch (error) {
      console.error("Error connecting to folder:", error)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <Input
          placeholder="Enter Google Drive folder ID"
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
        />
        <Button onClick={handleConnect} disabled={!folderId || isConnecting}>
          {isConnecting ? "Connecting..." : "Connect"}
        </Button>
      </div>
      <div className="flex items-center text-sm text-gray-500">
        <Folder className="h-4 w-4 mr-1" />
        <span>Find the folder ID in the URL when you open the folder in Google Drive</span>
      </div>
    </div>
  )
}
