# Setup and Initialization Guide

This guide walks teammates through setting up, configuring, running, and testing **GitSummarizer** locally.

---

## 1. Prerequisites

Ensure the following tools are installed on your machine:
- **Node.js LTS (`v22.5.0` or newer recommended)** — includes built-in `node:sqlite`, `fetch`, and `node:test`.
- **npm** (`v10+`)
- **Git**
- **Code Editor** (VS Code recommended)

Verify your versions in a terminal:
```bash
node --version
npm --version
git --version
```

---

## 2. Clone the Repository & Project Layout

```bash
git clone https://github.com/vishal-rathod-02/gitsummarizer.git
cd gitsummarizer
```

### Repository Structure
```text
gitsummarizer/
├── client/                  # React + Vite + Tailwind CSS frontend
├── server/                  # Node.js + Express REST API backend (ES Modules)
│   ├── src/                 # Controllers, services, repositories, routes, middleware
│   ├── tests/               # Automated unit & integration tests
│   ├── .env.example         # Backend environment variable template
│   └── package.json
├── docs/                    # Architecture, API contract, and setup documentation
│   ├── api-contract.md
│   ├── architecture.md
│   └── setup-guide.md
├── .gitignore
└── README.md
```

---

## 3. Backend Setup (`server/`)

1. Navigate to the `server` directory and install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Create your local `.env` file from `.env.example`:
   ```bash
   # On Windows PowerShell:
   Copy-Item .env.example .env

   # On macOS / Linux / Git Bash:
   cp .env.example .env
   ```

3. Review `server/.env`:
   ```env
   PORT=5000
   CLIENT_URL=http://localhost:5173
   NODE_ENV=development

   # Database (SQLite local file created automatically at startup)
   DB_FILE=./data/gitsummarizer.sqlite

   # GitHub REST API (optional Personal Access Token to raise rate limit from 60/hr to 5000/hr)
   GITHUB_TOKEN=
   DEFAULT_COMMIT_LIMIT=20
   MAX_COMMIT_LIMIT=50

   # AI Provider ("openai" or "mock"; automatically falls back if OPENAI_API_KEY is left empty)
   AI_PROVIDER=openai
   OPENAI_API_KEY=
   OPENAI_MODEL=gpt-4o-mini

   # Authentication (JWT secret)
   JWT_SECRET=gitsummarizer-local-dev-secret-key
   ```

   > **Note for Frontend Collaborators:** You do **not** need to configure an `OPENAI_API_KEY` or install an external database server to run the backend locally. SQLite initializes `server/data/gitsummarizer.sqlite` automatically, and when `OPENAI_API_KEY` is blank, the backend fetches real GitHub repository metadata, README, and commits and synthesizes a structured summary automatically.

4. Start the backend development server:
   ```bash
   npm run dev
   ```
   The API will start at `http://localhost:5000`.

5. Run the automated backend test suite (unit + integration tests):
   ```bash
   npm test
   ```

---

## 4. Frontend Setup (`client/`)

1. Open a second terminal from the repository root and navigate to `client/`:
   ```bash
   cd client
   npm install
   ```

2. Create `client/.env` (or copy from `client/.env.example`):
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```
   > **Security Rule:** Only public configuration belongs in `VITE_*` variables. Never place `OPENAI_API_KEY`, `GITHUB_TOKEN`, or `JWT_SECRET` in the frontend `.env`.

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open the local URL printed by Vite (default: `http://localhost:5173`).

---

## 5. Manual API Verification Commands

With the backend running (`npm run dev` inside `server/`), you can test all endpoints from a terminal:

### 1. Health Check (`GET /api/health`)
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get | ConvertTo-Json

# curl
curl http://localhost:5000/api/health
```

### 2. Generate a Repository Summary (`POST /api/summaries`)
```powershell
# PowerShell
$body = @{
  repositoryUrl = "https://github.com/vishal-rathod-02/gitsummarizer"
  commitLimit   = 10
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5000/api/summaries" -Method Post -ContentType "application/json" -Body $body
$response | ConvertTo-Json -Depth 6
```

### 3. List Summary History (`GET /api/summaries?page=1&limit=10`)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/summaries?page=1&limit=10" -Method Get | ConvertTo-Json -Depth 5
```

### 4. Fetch Single Summary Detail (`GET /api/summaries/:id`)
```powershell
$summaryId = $response.data.id
Invoke-RestMethod -Uri "http://localhost:5000/api/summaries/$summaryId" -Method Get | ConvertTo-Json -Depth 6
```

### 5. Delete a Summary (`DELETE /api/summaries/:id`)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/summaries/$summaryId" -Method Delete | ConvertTo-Json
```

---

## 6. Team Git Workflow

We use feature branches and Pull Requests into `main`:
- `feature/backend-setup` — Express backend architecture, GitHub/AI adapters, SQLite persistence, and API endpoints.
- `feature/frontend-layout` — React + Vite UI components, API integration, and state handling.
- `docs/setup-guide` — Project documentation, architecture, and setup guides.

```bash
# 1. Sync with main before starting work
git switch main
git pull origin main

# 2. Switch to your assigned branch
git switch feature/backend-setup

# 3. Stage, commit, and push your changes
git add .
git commit -m "feat(backend): implement summary pipeline and API endpoints"
git push -u origin feature/backend-setup
```

---

## 7. Troubleshooting Quick Reference

| Issue | Solution |
|---|---|
| **CORS error in browser** | Ensure `CLIENT_URL` in `server/.env` matches your frontend origin (`http://localhost:5173`). Multiple origins can be comma-separated (`http://localhost:5173,http://localhost:5174`). |
| **`429 RATE_LIMITED` from GitHub** | Unauthenticated GitHub API requests are capped at 60/hr per IP. Add a personal access token to `GITHUB_TOKEN` in `server/.env` and restart the server. |
| **`ExperimentalWarning: SQLite`** | Expected informational message from Node.js v22 built-in `node:sqlite`; does not affect functionality. |
| **Port `5000` already in use** | Stop the other process using port `5000` or change `PORT=5001` in `server/.env` and update `VITE_API_BASE_URL=http://localhost:5001/api` in `client/.env`. |
