"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import Papa from "papaparse"

interface EmployeeData {
  employee_id: string
  email: string
  name?: string
}

interface UploadEmployeeListProps {
  onUpload: (data: EmployeeData[]) => void
}

export function UploadEmployeeList({ onUpload }: UploadEmployeeListProps) {
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      parseCSV(selectedFile)
    }
  }

  const parseCSV = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      complete: (results) => {
        const validData = results.data
          .filter((row) => row.employee_id && row.email)
          .map((row) => ({
            employee_id: row.employee_id,
            email: row.email,
            name: row.name || undefined,
          }))

        onUpload(validData)
      },
      error: (error) => {
        console.error("Error parsing CSV:", error)
      },
    })
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-2">
      <input type="file" accept=".csv" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
      <Button
        onClick={handleButtonClick}
        variant="outline"
        className="w-full border-dashed h-24 flex flex-col items-center justify-center"
      >
        <Upload className="h-6 w-6 mb-2" />
        <span>{file ? file.name : "Upload employee CSV"}</span>
        <span className="text-xs text-gray-500 mt-1">
          {file ? "Click to change file" : "Must include employee_id and email columns"}
        </span>
      </Button>
    </div>
  )
}
