# Payslip Sender

A desktop application for sending payslips to employees via email.

## Features

- Cross-platform support (Windows and macOS)
- Google login with domain restriction (hr@bdcf.org)
- Email template customization
- Email and username validation
- Detailed process logging
- Email sending history

## Environment Variables

The application supports the following environment variables:

- `SMTP_HOST`: Default SMTP server host
- `SMTP_PORT`: Default SMTP server port
- `SMTP_SECURE`: Whether to use secure connection (true/false)
- `SMTP_USER`: Default SMTP username/email
- `SMTP_PASSWORD`: Default SMTP password

## Building the Application

### Prerequisites

- Node.js 14 or higher
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

\`\`\`bash
npm install
\`\`\`

### Development

To run the application in development mode:

\`\`\`bash
npm start
\`\`\`

### Building for Production

To build for both Windows and macOS:

\`\`\`bash
npm run build:all
\`\`\`

To build for Windows only:

\`\`\`bash
npm run build:win
\`\`\`

To build for macOS only:

\`\`\`bash
npm run build:mac
\`\`\`

## Usage

1. **Login**: Sign in with your Google account (must be from the bdcf.org domain)
2. **Setup**: Upload employee CSV and select payslip PDFs
3. **Email Template**: Customize the email template with dynamic fields
4. **Validation**: Validate employee emails and usernames
5. **Send Emails**: Send payslips to employees
6. **Results**: View sending results
7. **Settings**: Configure SMTP settings
8. **History**: View email sending history

## CSV Format

The employee CSV file should have the following columns:
- `employee_id` (required): Unique identifier for the employee
- `email` (required): Employee's email address
- `name` (optional): Employee's name

## License

MIT
