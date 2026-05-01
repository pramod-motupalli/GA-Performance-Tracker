# 🚀 GA Performance Tracker

**The Ultimate AI-Powered Performance Summarizer**

A premium, enterprise-grade React application designed to transform raw Google Sheets work logs into high-impact, professional performance reports using Llama AI.

![Premium UI Snapshot](https://img.shields.io/badge/UI-Premium_White-indigo)
![Tech Stack](https://img.shields.io/badge/Stack-Vite_%7C_React_%7C_Tailwind_v4-blue)
![AI](https://img.shields.io/badge/AI-Llama_3.3_70B-orange)

---

## ✨ Features

- **🧠 Intelligent Synthesis**: leverages Llama AI to distill complex activity logs into 6 professional categories.
- **📊 Precise Analytics**: Deterministic calculation of active working days, leave balance, and primary project focus.
- **💎 Premium Design System**: A "Premium White" aesthetic built with Tailwind CSS v4, Glassmorphism, and Shadcn-inspired components.
- **📄 Pro Export**: One-click PDF generation with a bulletproof compatibility layer for modern CSS.
- **🔍 Smart Filtering**: Case-insensitive resource selection and optional project-wide analysis.
- **📧 Insightful Broadcasts**: Instant generation of professional email drafts for management updates.

---

## 🛠️ Technology Stack

- **Core**: React 18 + Vite
- **AI Engine**: Groq Cloud (Llama 3.3 70B)
- **Styling**: Tailwind CSS v4 (PostCSS)
- **Components**: Radix UI + Framer Motion (Shadcn-style)
- **PDF Engine**: html2pdf.js + html2canvas
- **Data Fetch**: Google Sheets (CSV Export API)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- A Llama API Key from [Groq](https://groq.com/)
- A Google Sheet with columns: `Date`, `Resource`, `Project`, `Planned Activity for the Day`, and `Total Hours`.

### 2. Installation
```powershell
# Clone the repository
# git clone https://github.com/pramod-motupalli/GA-Performance-Tracker.git

# Install dependencies
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:
```env
VITE_GROQ_API_KEY=your_groq_api_key
VITE_SHEET_URL=your_google_sheet_csv_url
VITE_SHEET_NAME=Sheet1
```

### 4. Development
```powershell
npm run dev
```

---

## 📈 Data Structure
The application uses a robust `findValue` logic that searches for column headers case-insensitively. For best results, ensure your sheet has:
- `Date`: Format YYYY-MM-DD
- `Resource`: The employee name
- `Project`: The client or project name
- `Planned Activity for the Day`: The main work content (Column F)
- `Total Hours`: Numeric effort (e.g., 8.0 or 08:30:00)

---

## 🔒 Security & Performance
- **Cost Controlled**: Minimalist payload structure strips redundant metadata to save up to 70% in token costs.
- **Isolated PDF Engine**: Custom sanitization layer ensures `oklch` color codes never crash your PDF exports.
- **Local Settings**: Preferences (API keys/Sheet URLs) are persisted in `localStorage` for convenience.

---

Built with ❤️ for **G A**