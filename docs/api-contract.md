# API Contract

**Base URL (Local):** `http://localhost:5000/api`  
**Content-Type:** `application/json`  
**Timestamps:** ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`)  
**Correlation Header:** Every response returns an `X-Request-Id` header (and accepts an incoming `X-Request-Id` header if provided).

---

## 1. Health Check

### `GET /api/health`
Verifies that the Express API server and SQLite database connection are healthy.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "GitSummarizer API is running"
}
```

**Possible Errors:**
- `503 SERVICE_UNAVAILABLE` — Database connectivity check failed.

---

## 2. Generate Repository Summary

### `POST /api/summaries`
Validates a public GitHub repository URL, fetches repository metadata, README content, and recent commits from the GitHub REST API, generates a structured summary via the AI adapter (OpenAI or automatic heuristic fallback when `OPENAI_API_KEY` is not set), and persists the result in SQLite.

**Authentication:** Optional (`Authorization: Bearer <token>`).  
- If authenticated, the generated summary is linked to the user's account (`user_id`).  
- If unauthenticated, the summary is stored in anonymous mode (`user_id = null`) so frontend workflows operate without requiring login.

**Request Body:**
```json
{
  "repositoryUrl": "https://github.com/owner/repository",
  "commitRef": null,
  "commitLimit": 20
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `repositoryUrl` | `string` | Yes | Canonical public GitHub URL (`https://github.com/{owner}/{repo}`). Also accepts `.git` suffix, trailing slash, or `/commit/{sha}` URLs. (`url` and `repoUrl` are also accepted as convenience aliases.) |
| `commitRef` | `string \| null` | No | Optional branch or commit SHA (`7-40` hex chars). Omit or pass `null` for repository-level summary. |
| `commitLimit` | `number` | No | Number of recent commits to analyze (default: `20`, min: `1`, capped server-side at `50`). |

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": "8e3b92c0-7a1b-4c5d-9e2f-123456789abc",
    "repository": {
      "owner": "vishal-rathod-02",
      "name": "gitsummarizer",
      "fullName": "vishal-rathod-02/gitsummarizer",
      "url": "https://github.com/vishal-rathod-02/gitsummarizer",
      "description": "AI-powered GitHub repository summarization and release notes generation.",
      "defaultBranch": "main",
      "stars": 42,
      "language": "JavaScript"
    },
    "summary": {
      "overview": "A concise 2-4 sentence overview of the repository.",
      "features": [
        "Fast public GitHub repository overviews",
        "Structured prerequisites and feature extraction",
        "Readable commit digest and release notes generation"
      ],
      "prerequisites": [
        "Node.js LTS (v22+)",
        "npm and Git"
      ],
      "commitDigest": "Recent activity across 20 commit(s) includes Express backend initialization and project scaffolding."
    },
    "source": {
      "readmeAvailable": true,
      "commitCount": 20,
      "commitLimit": 20
    },
    "commits": [
      {
        "sha": "5a0e5821234567890abcdef1234567890abcdef1",
        "message": "feat(backend): initialize Express server",
        "authorName": "Vishal Rathod",
        "committedAt": "2026-10-30T12:00:00Z"
      }
    ],
    "ai": {
      "provider": "openai",
      "model": "gpt-4o-mini"
    },
    "commitRef": null,
    "createdAt": "2026-11-05T10:00:00.000Z"
  }
}
```

**Possible Errors:**
- `400 INVALID_REPOSITORY_URL` — Missing, non-HTTPS, non-`github.com`, or malformed repository URL.
- `400 VALIDATION_ERROR` — Invalid `commitLimit` or `commitRef` parameter.
- `404 REPOSITORY_NOT_FOUND` — Repository does not exist on GitHub or is private.
- `422 REPOSITORY_NOT_PUBLIC_OR_ACCESSIBLE` — Repository is restricted or private.
- `429 RATE_LIMITED` — GitHub API, AI provider, or server rate limit reached.
- `502 GITHUB_UPSTREAM_ERROR` — GitHub REST API timeout or upstream `5xx` error.
- `502 AI_PROVIDER_ERROR` — AI provider timeout, upstream error, or malformed JSON output.
- `503 SERVICE_UNAVAILABLE` — Database unavailable or strict AI key missing.

---

## 3. List Summary History

### `GET /api/summaries?page=1&limit=10`
Returns a paginated list of previously generated summaries ordered by `createdAt DESC`.

**Authentication:** Optional (`Authorization: Bearer <token>`).  
- If a valid Bearer token is provided, returns only summaries belonging to that authenticated user.  
- If omitted, returns anonymous summaries (`user_id IS NULL`).

**Query Parameters:**
- `page` (optional, default `1`, positive integer)
- `limit` (optional, default `10`, max `50`)

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "8e3b92c0-7a1b-4c5d-9e2f-123456789abc",
      "repository": {
        "owner": "vishal-rathod-02",
        "name": "gitsummarizer",
        "fullName": "vishal-rathod-02/gitsummarizer",
        "url": "https://github.com/vishal-rathod-02/gitsummarizer",
        "description": "AI-powered GitHub repository summarization and release notes generation.",
        "stars": 42,
        "language": "JavaScript"
      },
      "overviewPreview": "A concise 2-4 sentence overview of the repository...",
      "createdAt": "2026-11-05T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 4. Get Single Summary Detail

### `GET /api/summaries/:id`
Returns the full stored summary, repository metadata, source stats, and saved commits for a given summary UUID.

**Authentication:** Optional (`Authorization: Bearer <token>`).  
If the summary belongs to an authenticated user account, only that owner can access it (returns `404 SUMMARY_NOT_FOUND` otherwise).

**Response `200 OK`:**
Returns `{ "success": true, "data": { ... } }` with the same `data` object structure as `POST /api/summaries`.

**Possible Errors:**
- `404 SUMMARY_NOT_FOUND` — Summary ID does not exist or belongs to another user.

---

## 5. Delete Summary

### `DELETE /api/summaries/:id`
Deletes a summary and cascades deletion to its `summary_commits` records while preserving the shared `repositories` metadata record.

**Authentication:** Optional (`Authorization: Bearer <token>`). Enforces user ownership if the summary belongs to an account.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Summary deleted."
}
```

**Possible Errors:**
- `404 SUMMARY_NOT_FOUND` — Summary ID does not exist or belongs to another user.

---

## 6. Authentication Endpoints (Optional Account Mode)

### `POST /api/auth/register`
Creates a new user account with `scrypt` password hashing and returns an HS256 JWT access token.

**Request Body:**
```json
{
  "name": "Example User",
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "name": "Example User",
      "email": "user@example.com",
      "createdAt": "2026-11-05T10:00:00.000Z"
    },
    "token": "<jwt-access-token>",
    "expiresIn": 86400
  }
}
```

**Possible Errors:**
- `400 VALIDATION_ERROR` — Invalid email or password shorter than 8 characters.
- `409 EMAIL_ALREADY_EXISTS` — Email address is already registered.

---

### `POST /api/auth/login`
Authenticates an existing user and returns an HS256 JWT access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response `200 OK`:**
Same structure as `POST /api/auth/register`.

**Possible Errors:**
- `400 VALIDATION_ERROR` — Missing email or password.
- `401 INVALID_CREDENTIALS` — Email or password is incorrect.

---

### `POST /api/auth/logout`
Acknowledges client-side token disposal.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

---

### `GET /api/auth/me`
Returns the profile of the currently authenticated user. Requires `Authorization: Bearer <token>`.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "name": "Example User",
      "email": "user@example.com",
      "createdAt": "2026-11-05T10:00:00.000Z"
    }
  }
}
```

---

## 7. Standardized Error Envelope & Error Codes

All error responses across the API return a consistent JSON structure and never leak stack traces or upstream secrets:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REPOSITORY_URL",
    "message": "Enter a valid public GitHub repository URL."
  },
  "requestId": "c3d9b842-0d1a-4b11-9472-0192837465ab"
}
```

### Stable Error Codes Reference (For Frontend UI Mapping)

| HTTP Status | `error.code` | Recommended Frontend Handling |
|---|---|---|
| `400` | `INVALID_REPOSITORY_URL` | Highlight URL input and show accepted format (`https://github.com/owner/repo`). |
| `400` | `VALIDATION_ERROR` | Show field-level validation message. |
| `400` | `INVALID_JSON` | Show request formatting error. |
| `401` | `UNAUTHORIZED` | Prompt user to log in or clear expired token. |
| `401` | `INVALID_CREDENTIALS` | Show invalid email/password message on login form. |
| `404` | `REPOSITORY_NOT_FOUND` | Explain that the repository could not be found or is private. |
| `404` | `SUMMARY_NOT_FOUND` | Show empty/not-found state for the requested summary ID. |
| `404` | `ROUTE_NOT_FOUND` | API endpoint path does not exist. |
| `409` | `EMAIL_ALREADY_EXISTS` | Prompt user to sign in or use a different email address. |
| `422` | `REPOSITORY_NOT_PUBLIC_OR_ACCESSIBLE` | Explain that only public GitHub repositories are supported in MVP. |
| `429` | `RATE_LIMITED` | Show retry banner advising the user to wait before trying again. |
| `502` | `GITHUB_UPSTREAM_ERROR` | Offer retry action; GitHub API timed out or returned a server error. |
| `502` | `AI_PROVIDER_ERROR` | Offer retry action; AI summary service failed or returned invalid output. |
| `503` | `SERVICE_UNAVAILABLE` | Show temporary maintenance / service unavailable banner. |
| `500` | `INTERNAL_SERVER_ERROR` | Show generic unexpected error banner with `requestId` for debugging. |
