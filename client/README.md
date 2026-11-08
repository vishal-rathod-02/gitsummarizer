# GitSummarizer frontend

A responsive React and Tailwind CSS frontend for exploring GitHub repository and commit summaries. This project intentionally contains no backend, database, or API credentials.

## Run locally

```bash
npm install
npm run dev
```

Create a `.env` file from `.env.example` when a backend is available:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
VITE_SUMMARIZE_ENDPOINT=/api/summaries
```

The frontend sends a `POST` request to the configured endpoint with JSON describing the target:

```json
{
  "kind": "repository",
  "repository": "owner/repository",
  "url": "https://github.com/owner/repository"
}
```

For commit targets, the request also includes `commit`. The response can contain `description` (or `overview`), `highlights` (or `keyFeatures`), `prerequisites`, `releaseNotes`, `techStack`, and `files`, with an optional `summary` or `data` wrapper. Configure the separate backend to return these fields; no backend routes are implemented here.

Until a backend is configured, the dashboard displays clearly labeled example content and explains that live analysis is unavailable. Generated history and saved summaries are stored in browser `localStorage`.
