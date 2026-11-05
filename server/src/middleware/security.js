import env from "../config/env.js";
import AppError from "../utils/AppError.js";

/**
 * Sets baseline HTTP security headers (Helmet-equivalent).
 * Follows AUTHENTICATION_SECURITY.md Section 6.
 */
export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.removeHeader("X-Powered-By");
  next();
}

/**
 * Creates a lightweight in-memory IP rate limiter.
 */
export function createRateLimiter({
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  maxRequests = env.RATE_LIMIT_MAX_REQUESTS
} = {}) {
  const hits = new Map();

  return function rateLimiter(req, res, next) {
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || "global";
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
      return next(
        new AppError(
          429,
          "RATE_LIMITED",
          "Too many requests. Please wait before trying again."
        )
      );
    }

    return next();
  };
}
