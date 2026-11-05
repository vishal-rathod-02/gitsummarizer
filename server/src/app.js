import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import env from "./config/env.js";
import { getDb } from "./config/db.js";
import requestContext from "./middleware/requestContext.js";
import { securityHeaders, createRateLimiter } from "./middleware/security.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

const app = express();

// 1. Security headers & request correlation ID
app.use(securityHeaders);
app.use(requestContext);

// 2. CORS configuration (supports comma-separated origins in CLIENT_URL for local Vite ports)
const allowedOrigins = (process.env.CLIENT_URL || env.CLIENT_URL)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server/curl requests with no Origin header or matching origins
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true
  })
);

// 3. Bounded JSON body parser
app.use(express.json({ limit: "1mb" }));

// 4. Global baseline rate limiter
app.use("/api", createRateLimiter());

// 5. Mount API routes under /api
app.use("/api", apiRoutes);

// 6. 404 & central error handler
app.use(notFoundHandler);
app.use(errorHandler);

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  // Initialize SQLite database & run migrations at startup
  getDb();
  const PORT = process.env.PORT || env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`GitSummarizer API listening on port ${PORT}`);
  });
}

export default app;
