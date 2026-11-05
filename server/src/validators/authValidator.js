import AppError from "../utils/AppError.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterInput(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid registration payload.");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : null;

  if (!email || email.length > 255 || !EMAIL_REGEX.test(email)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Please provide a valid email address."
    );
  }

  if (!password || password.length < 8 || password.length > 128) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Password must be between 8 and 128 characters long."
    );
  }

  if (name && name.length > 100) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Name must not exceed 100 characters."
    );
  }

  return { name, email, password };
}

export function validateLoginInput(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid login payload.");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Email and password are required."
    );
  }

  return { email, password };
}
