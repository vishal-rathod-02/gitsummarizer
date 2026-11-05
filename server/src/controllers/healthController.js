import { checkDatabaseHealth } from "../config/db.js";
import AppError from "../utils/AppError.js";

export function getHealth(_req, res, next) {
  const dbHealthy = checkDatabaseHealth();
  if (!dbHealthy) {
    return next(
      new AppError(
        503,
        "SERVICE_UNAVAILABLE",
        "Database connectivity check failed."
      )
    );
  }

  return res.status(200).json({
    success: true,
    message: "GitSummarizer API is running"
  });
}
