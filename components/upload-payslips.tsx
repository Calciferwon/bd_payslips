"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, File, X } from "lucide-react"

interface UploadPayslipsProps {
  onUpload: (files: File[]) => void
}

export function UploadPayslips({ onUpload }: UploadPayslipsProps) {
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter((file) => file.type === "application/pdf")

      setFiles((prev) => {
        const combined = [...prev, ...newFiles]
        onUpload(combined)
        return combined
      })
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      onUpload(updated)
      return updated
    })
  }

  return (
    <div className="space-y-2">
      <input type="file" accept=".pdf" onChange={handleFileChange} ref={fileInputRef} className="hidden" multiple />
      <Button
        onClick={handleButtonClick}
        variant="outline"
        className="w-full border-dashed h-24 flex flex-col items-center justify-center"
      >
        <Upload className="h-6 w-6 mb-2" />
        <span>Upload payslip PDFs</span>
        <span className="text-xs text-gray-500 mt-1">
          {files.length > 0 ? `${files.length} files selected - Click to add more` : "PDF files only"}
        </span>
      </Button>

      {files.length > 0 && (
        <div className="mt-4 border rounded-md overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 text-sm font-medium">Uploaded Files</div>
          <div className="max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between px-4 py-2 border-t">
                <div className="flex items-center">
                  <File className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-sm truncate max-w-[250px]">{file.name}</span>
                </div>
                <button onClick={() => removeFile(index)} className="text-gray-500 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
