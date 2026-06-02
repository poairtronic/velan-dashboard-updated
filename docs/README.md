# Velan Metrology – Production Command Center Dashboard

## 🚀 Quick Start (VS Code + Localhost)

### Option 1: Live Server Extension (Easiest)
1. Open **VS Code**
2. Install the extension: **Live Server** by Ritwick Dey
   - Go to Extensions (Ctrl+Shift+X) → Search "Live Server" → Install
3. Open the project folder in VS Code: `File → Open Folder → velan-dashboard`
4. Right-click on `index.html` → **"Open with Live Server"**
5. Dashboard opens at: `http://127.0.0.1:5500`

---

### Option 2: Node.js live-server
1. Make sure **Node.js** is installed: https://nodejs.org
2. Open terminal in VS Code (`Ctrl + ~`)
3. Run:
   ```bash
   npm install
   npm start
   ```
4. Dashboard opens at: `http://localhost:3000`

---

### Option 3: Python Simple Server (No install needed)
1. Open terminal in VS Code (`Ctrl + ~`)
2. Run:
   ```bash
   # Python 3
   python -m http.server 3000
   ```
3. Open browser → `http://localhost:3000`

---

## 🌐 Run on Company Network (Other Machines)
1. Start the server on your machine using any option above
2. Find your machine's IP address:
   - Windows: Open CMD → type `ipconfig` → look for IPv4 Address (e.g. `192.168.1.10`)
3. Other machines on the same network open: `http://192.168.1.10:3000`

---

## 📁 Project Structure
```
velan-dashboard/
├── index.html       ← Main dashboard (all-in-one)
├── package.json     ← Node.js config
└── README.md        ← This file
```

---

## 📤 Uploading New Data
- Click **"Upload Data"** in the left sidebar
- Drag & drop your Excel file (`.xlsx`, `.xls`, `.csv`) or JSON
- Column names required: `SC`, `PO NO`, `PO RECD DATE`, `Product Name`, `type`, `STATUS 1`, `STATUS 2`, `INHOUSE/ VENDOR`, `currentStage`, `timestamp`
- Click **"Download Template"** to get a pre-formatted Excel template

---

## 📊 Dashboard Sections
| Page | What it shows |
|------|--------------|
| Overview | KPIs, Stage chart, Inhouse vs Vendor, Bottleneck POs |
| Production | Daily output, Category breakdown, Ready items table |
| Stage / WIP | Queue per stage, WIP analysis, All items table |
| PO Analysis | Lead time per PO, On-time %, Delayed POs |
| SC Sets | Job set completion times, days taken |
| Vendor Eval | Vendor workload %, ranking, stage details |
| Upload Data | Upload Excel/CSV, export, template download |

---

## 🎯 KPI Targets
- **Delivery Target**: 21 days (3 weeks) per PO
- **On-Time**: PO completed within 21 days
- **Delayed**: PO exceeded 21 days (done or still in-progress)
