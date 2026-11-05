import crypto from "node:crypto";
import env from "../config/env.js";

/**
 * Attaches a unique requestId to every request/response and logs sanitized request telemetry.
 * Follows DEBUGGING.md Section 3.
 */
export function requestContext(req, res, next) {
  const incomingId = req.headers["x-request-id"];
  const requestId =
    typeof incomingId === "string" && incomingId.trim().length <= 64
      ? incomingId.trim()
      : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const startTime = Date.now();
  res.on("finish", () => {
    if (env.NODE_ENV !== "test" && process.env.NODE_ENV !== "test") {
      const durationMs = Date.now() - startTime;
      console.log(
        `[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
      );
    }
  });

  next();
}

export default requestContext;
