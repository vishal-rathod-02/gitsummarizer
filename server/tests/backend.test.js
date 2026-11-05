process.env.NODE_ENV = "test";
process.env.DB_FILE = ":memory:";
process.env.AI_PROVIDER = "mock";
process.env.JWT_SECRET = "test-jwt-secret-key-for-automated-tests";

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Duplex } from "node:stream";

import app from "../src/app.js";
import { getDb, closeDb } from "../src/config/db.js";
import { parseRepositoryUrl } from "../src/services/github/urlParser.js";
import { decodeAndTruncateReadme } from "../src/services/github/githubClient.js";
import { validateSummaryOutput } from "../src/services/ai/outputValidator.js";

const originalFetch = global.fetch;

/**
 * Dispatches an HTTP request directly through the Express `app` in-memory
 * (similar to supertest, without requiring TCP port binding).
 */
function apiRequest(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({
      read() {},
      write(_chunk, _enc, cb) {
        cb();
      }
    });
    socket.remoteAddress = "127.0.0.1";

    const req = new http.IncomingMessage(socket);
    req.method = method.toUpperCase();
    req.url = path;
    req.originalUrl = path;

    const rawBody = body !== undefined ? JSON.stringify(body) : "";
    const normalizedHeaders = {
      "content-type": "application/json",
      ...Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])
      )
    };
    if (rawBody) {
      normalizedHeaders["content-length"] = String(Buffer.byteLength(rawBody));
    }
    req.headers = normalizedHeaders;

    const res = new http.ServerResponse(req);
    res.assignSocket(socket);

    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = (chunk, encoding, cb) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      return origWrite(chunk, encoding, cb);
    };

    res.end = (chunk, encoding, cb) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      origEnd(chunk, encoding, cb);

      const responseText = Buffer.concat(chunks).toString("utf8");
      let parsedData = null;
      try {
        parsedData = responseText ? JSON.parse(responseText) : null;
      } catch (_err) {
        parsedData = responseText;
      }

      const rawHeaders = res.getHeaders();
      resolve({
        status: res.statusCode,
        headers: {
          get(name) {
            const val = rawHeaders[String(name).toLowerCase()];
            return val !== undefined ? String(val) : null;
          }
        },
        data: parsedData
      });
    };

    app(req, res, (err) => {
      if (err) reject(err);
    });

    process.nextTick(() => {
      if (rawBody) {
        req.push(Buffer.from(rawBody));
      }
      req.push(null);
    });
  });
}

/**
 * Installs a mock global.fetch for GitHub REST API calls during integration tests.
 */
function mockGitHubFetch({
  repoStatus = 200,
  repoBody = {
    id: 1001,
    name: "gitsummarizer",
    full_name: "vishal-rathod-02/gitsummarizer",
    owner: { login: "vishal-rathod-02" },
    html_url: "https://github.com/vishal-rathod-02/gitsummarizer",
    description: "AI-powered GitHub repository summarization",
    default_branch: "main",
    stargazers_count: 42,
    language: "JavaScript",
    private: false
  },
  readmeStatus = 200,
  readmeText = "# GitSummarizer\n\nUnderstand any GitHub repository in minutes.\n\n## Features\n- Fast repository overviews\n- Commit digest generation\n\n## Prerequisites\n- Node.js 20+\n- npm",
  commitsStatus = 200,
  commitsBody = [
    {
      sha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
      commit: {
        message: "feat(backend): initialize Express server",
        author: { name: "Vishal", date: "2026-10-30T12:00:00Z" }
      }
    },
    {
      sha: "b2c3d4e5f60718293a4b5c6d7e8f901234567890",
      commit: {
        message: "chore: add initial project scaffold",
        author: { name: "Teammate", date: "2026-10-29T10:00:00Z" }
      }
    }
  ],
  rateLimited = false
} = {}) {
  global.fetch = async (url, options) => {
    const urlStr = String(url);

    if (rateLimited) {
      return new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 403,
        headers: {
          "content-type": "application/json",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 600)
        }
      });
    }

    if (urlStr.endsWith("/readme")) {
      if (readmeStatus !== 200) {
        return new Response(JSON.stringify({ message: "Not Found" }), {
          status: readmeStatus,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response(
        JSON.stringify({
          encoding: "base64",
          content: Buffer.from(readmeText, "utf8").toString("base64")
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (urlStr.includes("/commits")) {
      if (commitsStatus !== 200) {
        return new Response(JSON.stringify({ message: "Git Repository is empty." }), {
          status: commitsStatus,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response(JSON.stringify(commitsBody), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (urlStr.includes("/repos/")) {
      return new Response(JSON.stringify(repoBody), {
        status: repoStatus,
        headers: { "content-type": "application/json" }
      });
    }

    return originalFetch(url, options);
  };
}

describe("GitSummarizer Backend Test Suite", () => {
  before(() => {
    getDb(":memory:");
  });

  after(() => {
    global.fetch = originalFetch;
    closeDb();
  });

  beforeEach(() => {
    global.fetch = originalFetch;
  });

  describe("1. Unit Tests — Repository URL Parser & Normalizers", () => {
    it("parses valid canonical GitHub URLs, trailing slashes, and .git suffixes", () => {
      const r1 = parseRepositoryUrl("https://github.com/facebook/react");
      assert.equal(r1.owner, "facebook");
      assert.equal(r1.repo, "react");
      assert.equal(r1.canonicalUrl, "https://github.com/facebook/react");
      assert.equal(r1.commitRef, null);

      const r2 = parseRepositoryUrl("https://github.com/expressjs/express.git/");
      assert.equal(r2.owner, "expressjs");
      assert.equal(r2.repo, "express");
      assert.equal(r2.canonicalUrl, "https://github.com/expressjs/express");
    });

    it("parses commit-specific GitHub URLs", () => {
      const r = parseRepositoryUrl(
        "https://github.com/owner/repo/commit/a1b2c3d4e5f60718"
      );
      assert.equal(r.owner, "owner");
      assert.equal(r.repo, "repo");
      assert.equal(r.commitRef, "a1b2c3d4e5f60718");
    });

    it("rejects non-HTTPS, wrong hosts, missing segments, and query strings", () => {
      const invalidUrls = [
        "",
        "not-a-url",
        "http://github.com/owner/repo",
        "https://gitlab.com/owner/repo",
        "https://github.com/only-owner",
        "https://github.com/owner/repo/issues/1",
        "https://github.com/owner/repo?tab=readme",
        "https://user:pass@github.com/owner/repo"
      ];

      for (const bad of invalidUrls) {
        assert.throws(
          () => parseRepositoryUrl(bad),
          (err) => err.statusCode === 400 && err.code === "INVALID_REPOSITORY_URL"
        );
      }
    });

    it("decodes Base64 README and handles missing README safely", () => {
      const encoded = Buffer.from("# Hello World\nSample README").toString("base64");
      const decoded = decodeAndTruncateReadme({ encoding: "base64", content: encoded });
      assert.equal(decoded.available, true);
      assert.equal(decoded.content, "# Hello World\nSample README");

      const missing = decodeAndTruncateReadme(null);
      assert.equal(missing.available, false);
      assert.equal(missing.content, "");
    });

    it("validates structured AI output and rejects malformed output", () => {
      const valid = validateSummaryOutput(
        JSON.stringify({
          overview: "A test repo overview.",
          features: ["Feature A", "Feature B"],
          prerequisites: ["Node.js 20"],
          commitDigest: "Added initial backend setup."
        })
      );
      assert.equal(valid.overview, "A test repo overview.");
      assert.deepEqual(valid.features, ["Feature A", "Feature B"]);

      assert.throws(
        () => validateSummaryOutput("not valid json"),
        (err) => err.statusCode === 502 && err.code === "AI_PROVIDER_ERROR"
      );
    });
  });

  describe("2. Integration Tests — Health & Summary Lifecycle", () => {
    it("GET /api/health returns 200 and expected contract", async () => {
      const { status, headers, data } = await apiRequest("GET", "/api/health");
      assert.equal(status, 200);
      assert.equal(data.success, true);
      assert.equal(data.message, "GitSummarizer API is running");
      assert.ok(headers.get("x-request-id"));
      assert.equal(headers.get("x-content-type-options"), "nosniff");
    });

    it("POST /api/summaries generates and persists a summary for a valid public repo", async () => {
      mockGitHubFetch();

      const { status, data } = await apiRequest("POST", "/api/summaries", {
        body: {
          repositoryUrl: "https://github.com/vishal-rathod-02/gitsummarizer",
          commitLimit: 10
        }
      });

      assert.equal(status, 201);
      assert.equal(data.success, true);
      assert.ok(data.data.id);
      assert.equal(
        data.data.repository.fullName,
        "vishal-rathod-02/gitsummarizer"
      );
      assert.equal(data.data.repository.stars, 42);
      assert.ok(data.data.summary.overview.length > 10);
      assert.ok(Array.isArray(data.data.summary.features));
      assert.ok(Array.isArray(data.data.summary.prerequisites));
      assert.ok(data.data.summary.commitDigest.length > 5);
      assert.equal(data.data.source.readmeAvailable, true);
      assert.equal(data.data.source.commitCount, 2);
      assert.equal(data.data.source.commitLimit, 10);
      assert.ok(data.data.createdAt);
    });

    it("POST /api/summaries handles missing README and empty commits gracefully", async () => {
      mockGitHubFetch({ readmeStatus: 404, commitsStatus: 409 });

      const { status, data } = await apiRequest("POST", "/api/summaries", {
        body: {
          repositoryUrl: "https://github.com/vishal-rathod-02/gitsummarizer"
        }
      });

      assert.equal(status, 201);
      assert.equal(data.data.source.readmeAvailable, false);
      assert.equal(data.data.source.commitCount, 0);
      assert.match(data.data.summary.commitDigest, /No recent commits/i);
    });

    it("POST /api/summaries returns standardized error envelope on invalid URL, 404, and rate limit", async () => {
      const invalidRes = await apiRequest("POST", "/api/summaries", {
        body: { repositoryUrl: "https://gitlab.com/foo/bar" }
      });
      assert.equal(invalidRes.status, 400);
      assert.equal(invalidRes.data.success, false);
      assert.equal(invalidRes.data.error.code, "INVALID_REPOSITORY_URL");
      assert.ok(invalidRes.data.requestId);

      mockGitHubFetch({ repoStatus: 404 });
      const notFoundRes = await apiRequest("POST", "/api/summaries", {
        body: { repositoryUrl: "https://github.com/nonexistent/repo" }
      });
      assert.equal(notFoundRes.status, 404);
      assert.equal(notFoundRes.data.error.code, "REPOSITORY_NOT_FOUND");

      mockGitHubFetch({ rateLimited: true });
      const rateLimitRes = await apiRequest("POST", "/api/summaries", {
        body: { repositoryUrl: "https://github.com/vishal-rathod-02/gitsummarizer" }
      });
      assert.equal(rateLimitRes.status, 429);
      assert.equal(rateLimitRes.data.error.code, "RATE_LIMITED");
    });

    it("GET /api/summaries, GET /api/summaries/:id, and DELETE /api/summaries/:id work end-to-end", async () => {
      mockGitHubFetch();
      const created = await apiRequest("POST", "/api/summaries", {
        body: { repositoryUrl: "https://github.com/vishal-rathod-02/gitsummarizer" }
      });
      const summaryId = created.data.data.id;

      // List history
      const listRes = await apiRequest("GET", "/api/summaries?page=1&limit=5");
      assert.equal(listRes.status, 200);
      assert.equal(listRes.data.success, true);
      assert.ok(listRes.data.data.length >= 1);
      assert.equal(listRes.data.pagination.page, 1);
      assert.equal(listRes.data.pagination.limit, 5);

      // Get single detail
      const detailRes = await apiRequest("GET", `/api/summaries/${summaryId}`);
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.data.data.id, summaryId);
      assert.equal(
        detailRes.data.data.repository.fullName,
        "vishal-rathod-02/gitsummarizer"
      );

      // Delete summary
      const delRes = await apiRequest("DELETE", `/api/summaries/${summaryId}`);
      assert.equal(delRes.status, 200);
      assert.equal(delRes.data.success, true);

      // Subsequent GET returns 404 SUMMARY_NOT_FOUND
      const afterDelRes = await apiRequest("GET", `/api/summaries/${summaryId}`);
      assert.equal(afterDelRes.status, 404);
      assert.equal(afterDelRes.data.error.code, "SUMMARY_NOT_FOUND");
    });
  });

  describe("3. Integration Tests — Authentication & User History Isolation", () => {
    it("registers users, logs in, and isolates user-owned summaries across accounts", async () => {
      const regA = await apiRequest("POST", "/api/auth/register", {
        body: {
          name: "Alice",
          email: "alice@example.com",
          password: "password123"
        }
      });
      assert.equal(regA.status, 201);
      assert.ok(regA.data.data.token);
      assert.equal(regA.data.data.user.email, "alice@example.com");
      assert.equal(regA.data.data.user.passwordHash, undefined);

      const regB = await apiRequest("POST", "/api/auth/register", {
        body: {
          name: "Bob",
          email: "bob@example.com",
          password: "password123"
        }
      });
      assert.equal(regB.status, 201);

      const tokenA = regA.data.data.token;
      const tokenB = regB.data.data.token;

      // Alice creates a summary under her account
      mockGitHubFetch();
      const aliceSummary = await apiRequest("POST", "/api/summaries", {
        headers: { Authorization: `Bearer ${tokenA}` },
        body: { repositoryUrl: "https://github.com/vishal-rathod-02/gitsummarizer" }
      });
      assert.equal(aliceSummary.status, 201);
      const aliceSummaryId = aliceSummary.data.data.id;

      // Alice can view her summary
      const aliceGet = await apiRequest("GET", `/api/summaries/${aliceSummaryId}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.equal(aliceGet.status, 200);

      // Bob cannot view or delete Alice's summary
      const bobGet = await apiRequest("GET", `/api/summaries/${aliceSummaryId}`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert.equal(bobGet.status, 404);

      const bobDelete = await apiRequest(
        "DELETE",
        `/api/summaries/${aliceSummaryId}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` }
        }
      );
      assert.equal(bobDelete.status, 404);

      // Bob's history list is empty
      const bobHistory = await apiRequest("GET", "/api/summaries", {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert.equal(bobHistory.data.data.length, 0);
    });
  });
});
