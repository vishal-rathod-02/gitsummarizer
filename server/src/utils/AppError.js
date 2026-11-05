export class AppError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Stable machine-readable error code (e.g., INVALID_REPOSITORY_URL)
   * @param {string} message - Safe user-facing error message
   * @param {object} [details] - Optional internal or validation metadata
   */
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
