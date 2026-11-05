import AppError from "../utils/AppError.js";

export function notFoundHandler(req, _res, next) {
  next(
    new AppError(
      404,
      "ROUTE_NOT_FOUND",
      `Route ${req.method} ${req.originalUrl} does not exist.`
    )
  );
}

/**
 * Central Express error-handling middleware.
 * Returns the standardized error envelope defined in API.md Section 7.
 * Never leaks raw stack traces or upstream provider secrets.
 */
export function errorHandler(err, req, res, _next) {
  const requestId = req.requestId || "unknown-request";

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message
      },
      requestId
    });
  }

  // Handle malformed JSON body from express.json()
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body contains malformed JSON."
      },
      requestId
    });
  }

  // Handle payload size limit exceeded
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the maximum allowed size."
      },
      requestId
    });
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(`[${requestId}] Unhandled error:`, err && err.message ? err.message : err);
  }

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred."
    },
    requestId
  });
}
