import { PayslipSender } from "@/components/payslip-sender"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Payslip Email Automation</h1>
      <p className="mb-8 text-gray-600">Upload your employee data and payslips to send them with just a few clicks.</p>
      <PayslipSender />
    </main>
  )
}
